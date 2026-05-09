const { API_BASE_URL, DEFAULT_SHARE_IMAGE_URL, TENCENT_LOCATION_KEY } = require('../../utils/constants.js');
const { processContactInfo, processImageUrl, getCategoryType, processApiResponse, normalizeVenueData, haversineDistanceMeters, formatDistanceMeters, pickVenueShareImageUrl, shareCardImageUrl } = require('../../utils/commonUtils');
const { generateProvinceCityDataSmart } = require('../../utils/provinceCityUtil');
const favoriteUtil = require('../../utils/favoriteUtil.js');

const DEBOUNCE_DELAY = 500
const DEFAULT_CATEGORY = '酒吧'
const MIN_SEARCH_LENGTH = 1

const geocodeCache = require('../../utils/geocodeCache.js');

let qqmapsdk = null;

/** 搜索页一批最多地理编码条数（其余条目仅在有后端经纬度时显示距离） */
const SEARCH_GEOCODE_BATCH_MAX = 48;

Page({
  data: {
    categories: [],
    selectedCategory: DEFAULT_CATEGORY,
    provinces: [],
    cities: [],
    selectedProvince: '',
    selectedCity: '',
    searchText: '',
    barList: [],
    listTitle: '请选择省份和地区',
    showLeisureCategory: true,
    disableScroll: true,
    allData: [],
    dataLoaded: false,
    provinceCityData: {},
    rawResponseData: null,
    provinceField: 'province',
    cityField: 'city',
    loadError: false,
    errorMessage: '',
    showAddressBook: true,
    userLocation: null
  },

  loadUserFavorites: function(callback) {
    callback({});
  },

  fetchAllData: function(callback) {
    const currentProvince = this.data.selectedProvince;
    const currentCity = this.data.selectedCity;
    const that = this;
    
    this.setData({ loadError: false, errorMessage: '', dataLoaded: false });
    
    this.loadUserFavorites(function(favoritedBars) {
      const apiUrl = `${API_BASE_URL}/api/info?_t=${Date.now()}`;

      wx.request({
        url: apiUrl,
        method: 'GET',
        timeout: 10000,
        success: function(res) {
          if (res.statusCode !== 200) {
            that.handleDataFetchError(`HTTP ${res.statusCode}: ${JSON.stringify(res.data)}`);
            if (callback) callback({});
            return;
          }

          that.setData({ rawResponseData: res.data });
          const allData = processApiResponse(res.data);

          if (allData.length === 0) {
            that.setData({ loadError: true, errorMessage: '后端数据为空' });
            if (callback) callback({});
            return;
          }

          that.setData({ allData: allData, dataLoaded: true, favoritedBars: favoritedBars });

          const result = generateProvinceCityDataSmart(allData);
          const provinceCityData = result.provinceCityData;
          const provinceField = result.provinceField;
          const cityField = result.cityField;
          const provinces = result.orderedProvinces || Object.keys(provinceCityData);
          const updateData = {
            provinces: provinces,
            provinceCityData: provinceCityData,
            cities: [],
            provinceField: provinceField,
            cityField: cityField
          };
          
          if (!that.data.selectedProvince && provinces.length > 0) {
            updateData.selectedProvince = provinces[0];
          }
          
          if (currentProvince && provinces.includes(currentProvince)) {
            updateData.selectedProvince = currentProvince;
            updateData.cities = provinceCityData[currentProvince] || [];
            
            if (currentCity && (provinceCityData[currentProvince] || []).includes(currentCity)) {
              updateData.selectedCity = currentCity;
            }
          }
          
          that.setData(updateData, function() {
            if (currentProvince && currentCity && updateData.selectedCity) {
              that.updateAvailableCategories(currentProvince, currentCity);
              that.getBarsByRegion(currentProvince, currentCity);
            } else if (currentProvince && updateData.selectedProvince) {
              that.updateAvailableCategories(currentProvince, null);
              that.getBarsByProvince(currentProvince);
            } else if (updateData.selectedProvince) {
              that.updateAvailableCategories(updateData.selectedProvince, null);
              that.getBarsByProvince(updateData.selectedProvince);
            }
          });

          if (callback) callback(provinceCityData);
        },
        fail: function(err) {
          that.handleDataFetchError(err.errMsg);
          if (callback) callback({});
        }
      });
    });
  },

  retryFetchData: function() {
    this.setData({
      loadError: false,
      errorMessage: '',
      dataLoaded: false
    });
    this.fetchAllData();
  },

  toggleAddressBook: function() {
    const newState = !this.data.showAddressBook;
    this.setData({ showAddressBook: newState });
  },

  handleDataFetchError: function(errorMessage) {
    this.setData({
      loadError: true,
      errorMessage: errorMessage,
      allData: [],
      dataLoaded: false,
      provinces: [],
      provinceCityData: {},
      cities: [],
      barList: [],
      listTitle: ''
    });
  },
  
  showToast: function(message, icon = 'none') {
    wx.showToast({
      title: message,
      icon: icon,
      duration: 3000
    });
  },

  onLoad: function (options) {
    const systemInfo = wx.getSystemInfoSync()
    const statusBarHeight = systemInfo.statusBarHeight
    const menuButton = wx.getMenuButtonBoundingClientRect()
    
    const searchBarTop = menuButton.top + 25
    const searchBarHeight = menuButton.height
    const searchBarRight = (systemInfo.screenWidth - menuButton.left) + 10

    this.setData({
      statusBarHeight: statusBarHeight,
      searchBarTop: searchBarTop,
      searchBarHeight: searchBarHeight,
      searchBarRight: searchBarRight,
      categories: [],
      barList: [],
      listTitle: '请选择省份和地区',
      provinces: [],
      cities: [],
      provinceCityData: {}
    })
    
    // 初始化腾讯地图 SDK（带错误处理）
    try {
      const QQMapWX = require('../../utils/qqmap-wx-jssdk.min.js');
      qqmapsdk = new QQMapWX({
        key: TENCENT_LOCATION_KEY
      });
    } catch (err) {
      console.error('腾讯地图 SDK 加载失败:', err);
      qqmapsdk = null;
    }

    this.fetchAllData((provinceCityData) => {
      this.handleProvinceCityParams(options.province, options.city, provinceCityData);
      
      // 处理分类参数（来自首页快捷查询）
      if (options.category) {
        const category = decodeURIComponent(options.category);
        this.handleCategoryParam(category);
      }
    });
  },

  onShow: function() {
    if (this.tabBarUpdateTimer) {
      clearTimeout(this.tabBarUpdateTimer);
    }
    
    this.tabBarUpdateTimer = setTimeout(() => {
      if (typeof this.getTabBar === 'function') {
        const tabBar = this.getTabBar();
        if (tabBar && typeof tabBar.setData === 'function') {
          tabBar.setData({ selected: 1 });
        }
      }
    }, 50);

    if (this.data.selectedProvince && this.data.selectedCity) {
      this.fetchAllData();
    }
    
    // 获取用户位置并计算距离
    this.getUserLocation();
  },

  getUserLocation: function() {
    const that = this;
    wx.getLocation({
      type: 'gcj02',
      success: function(res) {
        that.setData({
          userLocation: {
            latitude: res.latitude,
            longitude: res.longitude
          }
        });
        if (that.data.barList && that.data.barList.length > 0) {
          that.calculateDistances();
        }
      },
      fail: function(err) {
        console.error('获取位置失败:', err);
      }
    });
  },

  calculateDistances: function() {
    const that = this;
    const userLocation = this.data.userLocation;
    const barList = this.data.barList;
    
    if (!userLocation || !barList || barList.length === 0) {
      return;
    }
    
    that.calculateDistancesWithGeocoder();
  },

  calculateStraightDistances: function() {
    const userLocation = this.data.userLocation;
    const barList = this.data.barList;
    
    if (!userLocation || !barList || barList.length === 0) {
      return;
    }
    
    const updatedBarList = barList.map(bar => {
      if (bar.latitude && bar.longitude) {
        const meters = haversineDistanceMeters(
          userLocation.latitude,
          userLocation.longitude,
          parseFloat(bar.latitude),
          parseFloat(bar.longitude)
        );
        if (!isFinite(meters)) return bar;
        const distanceInMeters = Math.round(meters);
        const distanceText = formatDistanceMeters(meters);
        return { ...bar, distance: distanceInMeters, distanceText };
      }
      return bar;
    });

    this.setData({ barList: updatedBarList });
  },

  // 使用腾讯地图 SDK 进行地址解析并计算距离
  calculateDistancesWithGeocoder: function() {
    const that = this;
    const userLocation = this.data.userLocation;
    const barList = this.data.barList;
    
    // 先计算有经纬度的地点
    const needGeocodingBars = [];
    const updatedBarList = barList.map(bar => {
      const fullAddress = `${bar.province || ''}${bar.city || ''}${bar.district || ''}${bar.address || ''}`;
      
      const cachedLocation = geocodeCache.get(fullAddress);
      if (cachedLocation) {
        const meters = haversineDistanceMeters(
          userLocation.latitude,
          userLocation.longitude,
          cachedLocation.latitude,
          cachedLocation.longitude
        );
        if (!isFinite(meters)) return bar;
        const distanceInMeters = Math.round(meters);
        const distanceText = formatDistanceMeters(meters);
        return { ...bar, distance: distanceInMeters, distanceText };
      }

      if (bar.latitude && bar.longitude) {
        const meters = haversineDistanceMeters(
          userLocation.latitude,
          userLocation.longitude,
          parseFloat(bar.latitude),
          parseFloat(bar.longitude)
        );
        if (!isFinite(meters)) return bar;
        const distanceInMeters = Math.round(meters);
        const distanceText = formatDistanceMeters(meters);
        return { ...bar, distance: distanceInMeters, distanceText };
      }
      
      if (fullAddress && fullAddress.trim()) {
        needGeocodingBars.push(bar);
      }
      
      return bar;
    });
    
    this.setData({ barList: updatedBarList });
    
    if (needGeocodingBars.length > 0 && qqmapsdk) {
      this.geocodeBars(needGeocodingBars, userLocation);
    }
  },

  // 批量地址解析
  geocodeBars: function(bars, userLocation) {
    const that = this;
    if (geocodeCache.isGeocoderDisabledByKey()) return;

    let processedCount = 0;

    const batch = bars.slice(0, SEARCH_GEOCODE_BATCH_MAX);

    batch.forEach((bar, index) => {
      const fullAddress = `${bar.province}${bar.city}${bar.district}${bar.address}`;

      if (!fullAddress || geocodeCache.get(fullAddress)) {
        processedCount++;
        return;
      }

      console.log(`正在解析地址 ${index + 1}/${batch.length}: ${fullAddress}`);
      
      qqmapsdk.geocoder({
        address: fullAddress,
        success: function(res) {
          processedCount++;
          if (geocodeCache.isUnauthorizedGeocoderResponse(res)) return;
          if (res.result && res.result.location) {
            const latitude = res.result.location.lat;
            const longitude = res.result.location.lng;
            
            geocodeCache.set(fullAddress, latitude, longitude);
            
            const meters = haversineDistanceMeters(
              userLocation.latitude,
              userLocation.longitude,
              latitude,
              longitude
            );
            if (!isFinite(meters)) return;
            const distanceInMeters = Math.round(meters);
            const distanceText = formatDistanceMeters(meters);

            console.log(`地址解析成功 - "${bar.name}" - 距离：${distanceText}`);
            
            // 更新列表
            const currentBarList = that.data.barList;
            const barIndex = currentBarList.findIndex(b => b.id === bar.id);
            if (barIndex !== -1) {
              currentBarList[barIndex].distance = distanceInMeters;
              currentBarList[barIndex].distanceText = distanceText;
              that.setData({ barList: currentBarList });
            }
          } else {
            console.log(`地址解析失败 - "${bar.name}": 无结果`);
          }
        },
        fail: function(err) {
          processedCount++;
          if (geocodeCache.tryMarkKeyUnauthorized(err)) return;
          console.warn(`地址解析失败 - "${bar.name}":`, err);
        }
      });
    });
  },

  refreshFavoriteStatus: function() {
    if (!this.data.barList || this.data.barList.length === 0) return;
    
    const barList = this.data.barList.map(bar => {
      if (bar && bar.id) {
        const isFavorited = favoriteUtil.isFavorited(bar.id);
        return { ...bar, isFavorited: isFavorited };
      }
      return bar;
    });
    
    this.setData({ barList: barList });
  },

  handleProvinceCityParams: function(province, city, provinceCityData) {
    if (province) {
      const selectedProvince = decodeURIComponent(province);
      this.setData({ selectedProvince: selectedProvince });
      
      const cities = provinceCityData[selectedProvince] || [];
      this.setData({ cities: cities });
      
      this.updateAvailableCategories(selectedProvince, null);
      
      if (city) {
        const selectedCity = decodeURIComponent(city);
        this.setData({ selectedCity: selectedCity });
        this.updateAvailableCategories(selectedProvince, selectedCity);
        setTimeout(() => {
          this.getBarsByRegion(selectedProvince, selectedCity);
        }, 100);
      } else {
        setTimeout(() => {
          this.getBarsByProvince(selectedProvince);
        }, 100);
      }
    } else {
      this.setData({
        selectedProvince: '',
        selectedCity: '',
        barList: [],
        listTitle: Object.keys(provinceCityData).length > 0 ? '请选择省份和地区' : '暂无地区数据'
      });
    }
  },

  // 处理分类参数（来自首页快捷查询）
  handleCategoryParam: function(category) {
    const that = this;
    
    // 等待数据加载完成
    if (!this.data.dataLoaded || !this.data.provinces || this.data.provinces.length === 0) {
      setTimeout(() => {
        this.handleCategoryParam(category);
      }, 300);
      return;
    }
    
    // 检查该分类是否在可用分类中
    const allCategories = this.data.categories || [];
    
    if (allCategories.includes(category)) {
      // 分类已存在，直接选中
      this.setData({ selectedCategory: category });
      this.showCategoryHint(category);
    } else {
      // 分类不存在，尝试找到第一个有该分类的城市
      this.findCategoryInData(category);
    }
  },

  // 在数据中查找指定分类
  findCategoryInData: function(targetCategory) {
    const allData = this.data.allData || [];
    const provinceCityData = this.data.provinceCityData || {};
    
    // 遍历所有数据，找到包含该分类的省份和城市
    for (let i = 0; i < allData.length; i++) {
      const item = allData[i];
      const itemCategory = getCategoryType(item.tags || item.Tags || item.tag || item.Tag, item);
      
      if (itemCategory === targetCategory) {
        const province = item[this.data.provinceField || 'province'];
        const city = item[this.data.cityField || 'city'];
        
        if (province && provinceCityData[province]) {
          // 找到匹配的省份和城市
          this.setData({
            selectedProvince: province,
            selectedCity: city || ''
          });
          
          // 更新城市列表
          const cities = provinceCityData[province] || [];
          this.setData({ cities: cities });
          
          // 更新分类列表
          this.updateAvailableCategories(province, city);
          
          // 选中该分类
          setTimeout(() => {
            this.setData({ selectedCategory: targetCategory });
            this.getBarsByRegion(province, city);
            this.showCategoryHint(targetCategory, province, city);
          }, 100);
          
          return;
        }
      }
    }
    
    // 如果没找到，显示提示
    wx.showToast({
      title: '该分类暂无数据',
      icon: 'none',
      duration: 2000
    });
  },

  // 显示分类提示
  showCategoryHint: function(category, province, city) {
    let message = `已为您筛选"${category}"`;
    if (province && city) {
      message = `${province}${city}的"${category}"`;
    }
    
    wx.showToast({
      title: message,
      icon: 'success',
      duration: 1500
    });
  },

  selectCategory: function (e) {
    const category = e.currentTarget.dataset.category
    this.setData({ selectedCategory: category })
    
    if (this.data.selectedProvince && this.data.selectedCity) {
      this.getBarsByRegion(this.data.selectedProvince, this.data.selectedCity);
    } else if (this.data.selectedProvince) {
      this.getBarsByProvince(this.data.selectedProvince);
    }
  },
  
  selectProvince: function (e) {
    const province = e.currentTarget.dataset.province;
    
    if (!this.data.dataLoaded || !this.data.allData || this.data.allData.length === 0) {
      this.showToast('数据加载中，请稍后再试', 'none');
      if (!this.data.dataLoaded) {
        this.fetchAllData(() => {
          if (this.data.dataLoaded) {
            this.selectProvince(e);
          }
        });
      }
      return;
    }

    const showLeisureCategory = province === '香港特别行政区';
    const provinceCities = this.data.provinceCityData ? this.data.provinceCityData[province] : [];

    this.setData({
      selectedProvince: province,
      selectedCity: '',
      cities: provinceCities,
      showLeisureCategory: showLeisureCategory
    })

    this.updateAvailableCategories(province, null);
    this.getBarsByProvince(province);

    if (provinceCities.length === 1) {
      const city = provinceCities[0]
      this.setData({ selectedCity: city })
      this.updateAvailableCategories(province, city)
      this.getBarsByRegion(province, city)
    }
  },

  selectCity: function (e) {
    const city = e.currentTarget.dataset.city;

    if (!this.data.dataLoaded || !this.data.allData || this.data.allData.length === 0) {
      this.showToast('数据加载中，请稍后再试', 'none');
      if (!this.data.dataLoaded) {
        this.fetchAllData(() => {
          if (this.data.dataLoaded) {
            this.selectCity(e);
          }
        });
      }
      return;
    }

    this.setData({ selectedCity: city })
    this.updateAvailableCategories(this.data.selectedProvince, city)
    this.getBarsByRegion(this.data.selectedProvince, city)
  },

  updateAvailableCategories: function(province, city) {
    const allData = this.data.allData || [];
    if (allData.length === 0) {
      this.setData({ categories: [] });
      return;
    }

    let scopeData = allData;
    const provinceField = this.data.provinceField || 'province';
    const cityField = this.data.cityField || 'city';

    if (province) {
      scopeData = allData.filter(item => {
        const itemProv = (item[provinceField] || '').trim();
        const itemCity = (item[cityField] || '').trim();
        if (city) {
          return itemProv === province && itemCity === city;
        }
        return itemProv === province;
      });
    }

    const targetData = scopeData;
    const categorySet = new Set();
    targetData.forEach(item => {
      const cat = getCategoryType(item.tags || item.Tags || item.tag || item.Tag, item);
      if (cat) {
        categorySet.add(cat);
      }
    });

    const categories = Array.from(categorySet).sort((a, b) => {
      const order = { '酒吧': 1, '民宿': 2, '公园': 3, '休闲': 4 };
      return (order[a] || 99) - (order[b] || 99);
    });

    this.setData({ categories: categories });

    if (categories.length > 0 && !categories.includes(this.data.selectedCategory)) {
      this.setData({ selectedCategory: categories[0] });
      if (this.data.selectedProvince) {
        if (this.data.selectedCity) {
          this.getBarsByRegion(this.data.selectedProvince, this.data.selectedCity);
        } else {
          this.getBarsByProvince(this.data.selectedProvince);
        }
      }
    } else if (categories.length === 0) {
      this.setData({ 
        selectedCategory: '',
        barList: [],
        listTitle: province ? `${province}${city || ''}暂无数据` : ''
      });
    }
  },

  getBarsByRegion: function (province, city) {
    if (!this.data.dataLoaded || !this.data.allData || this.data.allData.length === 0) {
      this.showToast('数据加载中，请稍后再试', 'none');
      if (!this.data.dataLoaded) {
        this.fetchAllData(() => {
          if (this.data.dataLoaded) {
            this.getBarsByRegion(province, city);
          }
        });
      }
      return;
    }

    const currentCategory = this.data.selectedCategory;
    const allData = this.data.allData || [];
    const provinceField = this.data.provinceField || 'province';
    const cityField = this.data.cityField || 'city';

    const filteredData = allData.filter(item => {
      if (!item || typeof item !== 'object') return false;
      const itemProvince = (item[provinceField] || '').trim();
      const itemCity = (item[cityField] || '').trim();
      if (itemProvince !== province || itemCity !== city) return false;
      const itemCategory = getCategoryType(
        item.tags || item.Tags || item.tag || item.Tag,
        item
      );
      return itemCategory === currentCategory;
    });

    const bars = filteredData.map(bar => {
      return this.prepareBarData(bar);
    });
    
    const listTitle = `${province}${city}${currentCategory}`;
    
    this.setData({
      barList: bars,
      listTitle: listTitle,
      disableScroll: bars.length === 0
    }, () => {
      if (this.data.userLocation) {
        this.calculateDistances();
      }
    });
    
    if (wx.setPageMeta) {
      wx.setPageMeta({ scroll: bars.length > 0 });
    }

    if (bars.length === 0) {
      this.showToast(`${province}${city}暂无${currentCategory}数据`, 'none');
    }
  },
  
  getBarsByProvince: function (province) {
    if (!this.data.dataLoaded || !this.data.allData || this.data.allData.length === 0) {
      this.showToast('数据加载中，请稍后再试', 'none');
      if (!this.data.dataLoaded) {
        this.fetchAllData(() => {
          if (this.data.dataLoaded) {
            this.getBarsByProvince(province);
          }
        });
      }
      return;
    }

    const currentCategory = this.data.selectedCategory;
    const allData = this.data.allData || [];
    const provinceField = this.data.provinceField || 'province';
    const cityField = this.data.cityField || 'city';

    const filteredData = allData.filter(item => {
      if (!item || typeof item !== 'object') return false;
      const itemProvince = (item[provinceField] || '').trim();
      if (itemProvince !== province) return false;
      const itemCategory = getCategoryType(
        item.tags || item.Tags || item.tag || item.Tag,
        item
      );
      return itemCategory === currentCategory;
    });

    const bars = filteredData.map(bar => {
      return this.prepareBarData(bar);
    });

    const listTitle = `${province}${currentCategory}`;
    this.setData({
      barList: bars,
      listTitle: listTitle,
      disableScroll: bars.length === 0
    }, () => {
      // 数据加载完成后计算距离
      if (this.data.userLocation) {
        this.calculateDistances();
      }
    });

    if (wx.setPageMeta) {
      wx.setPageMeta({ scroll: bars.length > 0 });
    }

    if (bars.length === 0) {
      this.showToast(`${province}暂无${currentCategory}数据`, 'none');
    }
  },

  prepareBarData: function(bar) {
    const favoritedBars = this.data.favoritedBars || {};
    return normalizeVenueData(bar, favoritedBars);
  },
  
  onImageError: function(e) {
    const index = e.currentTarget.dataset.index;
    const barList = this.data.barList || [];
    
    if (index === undefined || !barList[index]) return;
    const bar = barList[index];
    if (bar.listImage && bar.listImage !== bar.image) {
      this.setData({ [`barList[${index}].listImage`]: '' });
      return;
    }
    this.setData({ [`barList[${index}].imageError`]: true });
  },

  onSearchInput: function (e) {
    const searchText = e.detail.value
    this.setData({ searchText: searchText })
    
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer)
    }
    
    if (searchText.trim().length >= MIN_SEARCH_LENGTH) {
      this.debounceTimer = setTimeout(() => {
        this.setData({
          barList: [],
          listTitle: '',
          disableScroll: true
        })
        
        if (wx.setPageMeta) {
          wx.setPageMeta({ scroll: false })
        }
        
        this.performSearch(searchText.trim());
      }, DEBOUNCE_DELAY)
    } else if (searchText.trim().length === 0) {
      this.setData({
        barList: [],
        listTitle: '',
        disableScroll: true
      })
      
      if (wx.setPageMeta) {
        wx.setPageMeta({ scroll: false })
      }
      
      if (this.data.selectedProvince) {
        this.updateAvailableCategories(this.data.selectedProvince, null);
        if (this.data.selectedCity) {
          this.updateAvailableCategories(this.data.selectedProvince, this.data.selectedCity);
          this.getBarsByRegion(this.data.selectedProvince, this.data.selectedCity);
        } else {
          this.getBarsByProvince(this.data.selectedProvince);
        }
      }
    }
  },

  onSearchConfirm: function () {
    const searchText = this.data.searchText.trim()
    
    if (!searchText) {
      this.setData({
        barList: [],
        listTitle: '',
        selectedProvince: '',
        selectedCity: '',
        disableScroll: true
      })
      
      if (wx.setPageMeta) {
        wx.setPageMeta({ scroll: false })
      }
      
      return
    }
    
    this.setData({
      barList: [],
      listTitle: '',
      selectedProvince: '',
      selectedCity: '',
      disableScroll: true
    })
    
    if (wx.setPageMeta) {
      wx.setPageMeta({ scroll: false })
    }
    
    this.performSearch(searchText);
  },
  
  performSearch: function(searchText) {
    if (!this.data.dataLoaded || !this.data.allData || this.data.allData.length === 0) {
      wx.hideLoading();
      wx.showToast({
        title: '数据加载中，请稍后再试',
        icon: 'none',
        duration: 2000
      });
      
      if (!this.data.dataLoaded) {
        this.fetchAllData(() => {
          if (this.data.searchText && this.data.searchText.trim() === searchText.trim()) {
            this.performSearch(searchText);
          }
        });
      }
      return;
    }
    
    const localData = this.data.allData || [];
    let localBars = [];
    
    const searchLower = searchText.toLowerCase();
    localBars = localData.filter(bar => {
      if (!bar || typeof bar !== 'object') return false;
      
      const normalized = normalizeVenueData(bar);
      const name = normalized.name.toLowerCase();
      const province = (normalized.province || '').toLowerCase();
      const city = (normalized.city || '').toLowerCase();
      const address = (normalized.address || '').toLowerCase();
      const district = (normalized.district || '').toLowerCase();
      
      return name.includes(searchLower) || 
             province.includes(searchLower) || 
             city.includes(searchLower) || 
             district.includes(searchLower) ||
             address.includes(searchLower);
    }).map(bar => {
      return this.prepareBarData(bar);
    });
    
    this.setData({
      barList: localBars,
      listTitle: localBars.length === 0 ? '' : `搜索"${searchText}"的结果(${localBars.length}条)`,
      selectedProvince: '',
      selectedCity: '',
      disableScroll: localBars.length === 0
    }, () => {
      // 搜索结果加载完成后计算距离
      if (this.data.userLocation) {
        this.calculateDistances();
      }
    });
    
    if (wx.setPageMeta) {
      wx.setPageMeta({ scroll: localBars.length > 0 });
    }
    
    if (localBars.length === 0) {
      wx.showToast({
        title: `未找到与"${searchText}"相关的信息`,
        icon: 'none',
        duration: 2000
      });
    }
  },

  viewMap: function(e) {
    const bar = e.currentTarget.dataset.bar;
    
    if (bar) {
      if (!bar.latitude || !bar.longitude) {
        wx.showToast({
          title: '该地点缺少精确位置信息',
          icon: 'none'
        });
        return;
      }
      
      const latitude = Number(bar.latitude);
      const longitude = Number(bar.longitude);
      
      if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
        wx.showToast({
          title: '坐标数据异常',
          icon: 'none'
        });
        return;
      }
      
      const fullAddress = `${bar.province}${bar.city}${bar.district}${bar.address}`;
      const navLatitude = parseFloat(latitude);
      const navLongitude = parseFloat(longitude);
      
      wx.openLocation({
        latitude: navLatitude,
        longitude: navLongitude,
        scale: 16,
        name: bar.name || '',
        address: fullAddress || '',
        success: function() {},
        fail: function(err) {
          wx.showToast({
            title: '导航失败',
            icon: 'none'
          });
        }
      });
    } else {
      wx.showToast({
        title: '酒吧信息不存在',
        icon: 'none'
      });
    }
  },

  viewDetail: function(e) {
    const id = e.currentTarget.dataset.id
    if (id) {
      wx.navigateTo({
        url: '/pages/detail/detail?id=' + id
      })
    }
  },

  copyAddress: function(e) {
    const address = e.currentTarget.dataset.address;
    if (!address) {
      wx.showToast({
        title: '无效的地址',
        icon: 'none'
      });
      return;
    }
    wx.setClipboardData({
      data: address,
      success: function() {
        wx.showToast({
          title: '地址已复制到剪贴板',
          icon: 'success',
          duration: 1500
        });
      },
      fail: function(err) {
        wx.showToast({
          title: '复制地址失败',
          icon: 'none'
        });
      }
    });
  },

  makePhoneCall: function(e) {
    const phoneNumber = e.currentTarget.dataset.phone;
    if (!phoneNumber) {
      wx.showToast({
        title: '电话号码无效',
        icon: 'none'
      });
      return;
    }
    wx.makePhoneCall({
      phoneNumber: phoneNumber
    });
  },
  
  onPullDownRefresh: function () {
    if (this.data.selectedProvince && this.data.selectedCity) {
      this.updateAvailableCategories(this.data.selectedProvince, this.data.selectedCity);
      this.getBarsByRegion(this.data.selectedProvince, this.data.selectedCity)
    } else if (this.data.selectedProvince) {
      this.updateAvailableCategories(this.data.selectedProvince, null);
      this.getBarsByProvince(this.data.selectedProvince)
    } else {
      this.setData({
        barList: [],
        disableScroll: true
      })
      
      if (wx.setPageMeta) {
        wx.setPageMeta({ scroll: false })
      }
    }
    
    wx.stopPullDownRefresh()
  },
  
  toggleFavorite: function(e) {
    const index = e.currentTarget.dataset.index;
    const barList = this.data.barList;
    const bar = barList[index];
    if (!bar || !bar.id) {
      wx.showToast({ title: '操作失败', icon: 'none' });
      return;
    }
    
    favoriteUtil.toggleFavorite(bar.id);
    this.refreshFavoriteStatus();
    this.refreshOtherPages();
  },

  refreshOtherPages: function() {
    try {
      const pages = getCurrentPages();
      for (let i = pages.length - 1; i >= 0; i--) {
        const page = pages[i];
        if (page.route && (page.route.includes('home/home') || page.route.includes('detail/detail') || page.route.includes('favorites/favorites'))) {
          if (typeof page.loadFiveStarBars === 'function') {
            page.setData({ dataLoaded: false });
            page.loadFiveStarBars();
          }
          if (typeof page.loadBarDetail === 'function' && page.barId) {
            page.loadBarDetail(page.barId);
          }
          if (typeof page.loadFavoriteBars === 'function') {
            page.loadFavoriteBars();
          }
        }
      }
    } catch (err) {}
  },

  toggleAddressExpand: function(e) {
    const index = e.currentTarget.dataset.index;
    const barList = this.data.barList;
    const bar = barList[index];
    if (!bar) return;
    bar.addressExpanded = !bar.addressExpanded;
    this.setData({ barList: barList });
  },

  buildIndexSharePayload: function(title, path, queryStr) {
    const barList = this.data.barList || [];
    let preferred = '';
    for (let i = 0; i < barList.length && !preferred; i++) {
      preferred = pickVenueShareImageUrl(barList[i]) || '';
    }
    const imageUrl = shareCardImageUrl(preferred);
    if (queryStr !== undefined) {
      return { title: title, query: queryStr, imageUrl: imageUrl };
    }
    return { title: title, path: path, imageUrl: imageUrl };
  },

  onShareAppMessage: function() {
    const safeTitle = '发现优质酒吧和民宿';
    const safePath = '/pages/index/index';
    const safe = { title: safeTitle, path: safePath, imageUrl: DEFAULT_SHARE_IMAGE_URL };
    try {
      const { selectedProvince, selectedCity, selectedCategory, searchText } = this.data;
      let title = safeTitle;
      if (searchText) {
        title = `搜索"${searchText}"的结果`;
      } else if (selectedCity && selectedCategory) {
        title = `${selectedCity}${selectedCategory}推荐`;
      } else if (selectedProvince && selectedCategory) {
        title = `${selectedProvince}${selectedCategory}推荐`;
      }

      let path = safePath;
      const params = [];
      if (selectedCategory) params.push(`category=${encodeURIComponent(selectedCategory)}`);
      if (selectedProvince) params.push(`province=${encodeURIComponent(selectedProvince)}`);
      if (selectedCity) params.push(`city=${encodeURIComponent(selectedCity)}`);

      if (params.length > 0) {
        path += '?' + params.join('&');
      }

      return this.buildIndexSharePayload(title, path);
    } catch (err) {
      console.error('onShareAppMessage', err);
      return safe;
    }
  },

  onShareTimeline: function() {
    const safeTitle = '发现优质酒吧和民宿';
    try {
      const { selectedProvince, selectedCity, selectedCategory, searchText } = this.data;
      let title = safeTitle;
      if (searchText) {
        title = `搜索"${searchText}"的结果`;
      } else if (selectedCity && selectedCategory) {
        title = `${selectedCity}${selectedCategory}推荐`;
      } else if (selectedProvince && selectedCategory) {
        title = `${selectedProvince}${selectedCategory}推荐`;
      }
      const q = [];
      if (selectedCategory) q.push('category=' + encodeURIComponent(selectedCategory));
      if (selectedProvince) q.push('province=' + encodeURIComponent(selectedProvince));
      if (selectedCity) q.push('city=' + encodeURIComponent(selectedCity));
      const queryStr = q.join('&');
      return this.buildIndexSharePayload(title, null, queryStr);
    } catch (err) {
      console.error('onShareTimeline', err);
      return { title: safeTitle, query: '', imageUrl: DEFAULT_SHARE_IMAGE_URL };
    }
  },

  onHide: function() {
    if (this.tabBarUpdateTimer) {
      clearTimeout(this.tabBarUpdateTimer);
      this.tabBarUpdateTimer = null;
    }
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = null;
    }
  },

  onUnload: function() {
    if (this.tabBarUpdateTimer) {
      clearTimeout(this.tabBarUpdateTimer);
      this.tabBarUpdateTimer = null;
    }
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = null;
    }
  }
});
