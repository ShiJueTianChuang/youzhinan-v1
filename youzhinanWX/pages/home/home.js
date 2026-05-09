const app = getApp()
const { API_BASE_URL, DEFAULT_SHARE_IMAGE_URL, TENCENT_LOCATION_KEY } = require('../../utils/constants.js');
const { processContactInfo, processImageUrl, processApiResponse, getCategoryType, normalizeVenueData, haversineDistanceMeters, formatDistanceMeters, pickVenueShareImageUrl, shareCardImageUrl } = require('../../utils/commonUtils');
const favoriteUtil = require('../../utils/favoriteUtil.js');
const geocodeCache = require('../../utils/geocodeCache.js');

let qqmapsdk = null

/** 首页单列表最多补地理编码条数，避免与搜索页叠加时爆配额 */
const HOME_GEOCODE_MAX_PER_LIST = 20

/** 「附近」Tab：对全量数据按地址走腾讯地图 geocoder 的上限（与列表 geocoder 错峰 stagger） */
const HOME_GEOCODE_MAX_NEARBY = 150

/** 「附近」：只扫接口全量列表 allBackendVenues，绝不使用 barList / newDiscoveredList */
const NEARBY_RADIUS_KM = 300
const NEARBY_RADIUS_METERS = NEARBY_RADIUS_KM * 1000

function barHasValidCoords(bar) {
  if (!bar) return false
  const la = parseFloat(bar.latitude)
  const lo = parseFloat(bar.longitude)
  return isFinite(la) && isFinite(lo)
}

function fullAddressFromBar(bar) {
  if (!bar) return ''
  const street = (bar.address || bar.detail_address || bar.detailAddress || '').trim()
  return `${bar.province || ''}${bar.city || ''}${bar.district || ''}${street}`.trim()
}

function normalizeRegionName(s) {
  if (!s || typeof s !== 'string') return ''
  return s.trim().replace(/\s+/g, '')
}

/** 用户逆解析得到的省、市 与 场所 province/city 是否一致（同城降级用） */
function regionMatchesBar(bar, userRegion) {
  if (!bar || !userRegion) return false
  const bp = normalizeRegionName(bar.province)
  const bc = normalizeRegionName(bar.city)
  const up = normalizeRegionName(userRegion.province)
  const uc = normalizeRegionName(userRegion.city)
  if (!up || !bp) return false
  const provinceOk =
    bp === up || bp.indexOf(up) !== -1 || up.indexOf(bp) !== -1
  if (!provinceOk) return false
  if (!uc || uc === '市辖区' || uc === '县') return true
  if (!bc) return true
  return bc === uc || bc.indexOf(uc) !== -1 || uc.indexOf(bc) !== -1
}

Page({
  data: {
    barList: [],
    listTitle: '',
    newDiscoveredList: [],
    newListTitle: '',
    dataLoaded: false,
    unreadCount: 0,
    activeTab: 'new', // Tab 顺序：新发现 → 高评分 → 附近（附近需定位）
    userLocation: null,
    /** 接口 /api/info 返回的全部场所（规范化后），仅「附近」按距离筛选用，与高评分/新发现子集无关 */
    allBackendVenues: [],
    nearbyList: [],
    nearbyListTitle: '',
    /** 逆地址解析得到的用户行政区，用于「同城」降级 */
    userRegion: null,
    /** 当前附近列表是否为同城降级（无精确距离） */
    nearbyUseCityFallback: false,
    loadError: false,
    errorMessage: ''
  },

  onLoad: function(options) {
    try {
      const QQMapWX = require('../../utils/qqmap-wx-jssdk.min.js')
      qqmapsdk = new QQMapWX({
        key: TENCENT_LOCATION_KEY
      })
    } catch (e) {
      qqmapsdk = null
    }

    this.setData({
      barList: [],
      newDiscoveredList: [],
      dataLoaded: false,
      loadError: false,
      errorMessage: ''
    });

    this.onFavoriteChange = this.onFavoriteChange.bind(this);
    favoriteUtil.subscribe(this.onFavoriteChange);
    
    this.recordVisit();
    this.loadUnreadCount();
    
    setTimeout(() => {
      this.loadFiveStarBars();
    }, 100);
  },

  onUnload: function() {
    favoriteUtil.unsubscribe(this.onFavoriteChange);
  },

  onFavoriteChange: function() {
    this.updateFavoriteStatus();
  },

  updateFavoriteStatus: function() {
    const barList = this.data.barList.map(bar => ({
      ...bar,
      isFavorited: favoriteUtil.isFavorited(bar.id)
    }));
    const newDiscoveredList = this.data.newDiscoveredList.map(bar => ({
      ...bar,
      isFavorited: favoriteUtil.isFavorited(bar.id)
    }));
    const nearbyList = this.data.nearbyList.map(bar => ({
      ...bar,
      isFavorited: favoriteUtil.isFavorited(bar.id)
    }));
    this.setData({ barList, newDiscoveredList, nearbyList });
  },
  


  onReady: function() {
    
  },

  onShow: function() {
    if (this.tabBarUpdateTimer) {
      clearTimeout(this.tabBarUpdateTimer);
    }
    
    this.tabBarUpdateTimer = setTimeout(() => {
      if (typeof this.getTabBar === 'function') {
        const tabBar = this.getTabBar();
        if (tabBar && typeof tabBar.setData === 'function') {
          tabBar.setData({
            selected: 0
          });
        }
      }
    }, 50);
    
    this.loadUnreadCount();
    
    if (!this.data.dataLoaded) {
      favoriteUtil.initFavorites(() => {
        this.setData({ dataLoaded: false });
        this.loadFiveStarBars();
      });
    } else {
      favoriteUtil.initFavorites();
      this.updateFavoriteStatus();
    }
    
    // 获取用户位置并计算距离
    this.getUserLocation();
  },

  // 获取用户位置；fromUserTap 为 true 时（用户点了「开启定位」）失败会弹出说明，避免「点了没反应」
  getUserLocation: function(fromUserTap) {
    const that = this;
    const requestLocation = function () {
      wx.getLocation({
        type: 'gcj02',
        success: function (res) {
          that.setData(
            {
              userLocation: {
                latitude: res.latitude,
                longitude: res.longitude
              }
            },
            function () {
              if (that.data.barList && that.data.barList.length > 0) {
                that.calculateDistancesForList('barList');
              }
              if (that.data.newDiscoveredList && that.data.newDiscoveredList.length > 0) {
                that.calculateDistancesForList('newDiscoveredList');
              }
              that.buildNearbyListFromCache();
              that.scheduleGeocoderForNearbyAllBars();
              that.requestUserRegionAndRefreshNearby();
            }
          );
        },
        fail: function (err) {
          const msg = (err && err.errMsg) ? String(err.errMsg) : '';
          const isAuthDeny =
            msg.indexOf('auth deny') !== -1 || msg.indexOf('authorize') !== -1;
          if (!fromUserTap) {
            if (!isAuthDeny) {
              console.warn('获取位置失败:', err);
            }
            return;
          }
          console.error('获取位置失败:', err);
          if (isAuthDeny) {
            wx.showModal({
              title: '需要位置权限',
              content:
                '请在下一步设置中打开「位置信息」，或到 微信-设置-个人信息与权限 中允许本小程序使用位置。',
              confirmText: '去设置',
              success: function (r) {
                if (r.confirm) wx.openSetting({});
              }
            });
          } else {
            wx.showToast({
              title: '无法获取位置，请打开手机定位与微信的位置权限',
              icon: 'none',
              duration: 2800
            });
          }
        }
      });
    };

    if (fromUserTap) {
      requestLocation();
      return;
    }

    wx.getSetting({
      success: function (res) {
        if (res.authSetting['scope.userLocation'] === false) {
          return;
        }
        requestLocation();
      },
      fail: function () {
        requestLocation();
      }
    });
  },

  /**
   * 逆解析用户坐标得到省/市，用于「同城」降级（场所无经纬度且 geocoder 失败时仍能展示）
   */
  requestUserRegionAndRefreshNearby: function () {
    const that = this;
    const loc = that.data.userLocation;
    if (!qqmapsdk || !loc) return;

    if (that._lastReverseLoc && that.data.userRegion) {
      const moved =
        Math.abs(that._lastReverseLoc.lat - loc.latitude) +
        Math.abs(that._lastReverseLoc.lng - loc.longitude);
      if (moved < 0.02) {
        that.buildNearbyListFromCache();
        return;
      }
      that.setData({ userRegion: null });
    }

    qqmapsdk.reverseGeocoder({
      location: {
        latitude: loc.latitude,
        longitude: loc.longitude
      },
      success: function (res) {
        if (geocodeCache.isUnauthorizedGeocoderResponse(res)) {
          that.buildNearbyListFromCache();
          return;
        }
        const ad = res.result && res.result.ad_info;
        if (!ad) {
          that.buildNearbyListFromCache();
          return;
        }
        that._lastReverseLoc = { lat: loc.latitude, lng: loc.longitude };
        that.setData(
          {
            userRegion: {
              province: ad.province || '',
              city: ad.city || ''
            }
          },
          function () {
            that.buildNearbyListFromCache();
          }
        );
      },
      fail: function (err) {
        geocodeCache.tryMarkKeyUnauthorized(err);
        that.buildNearbyListFromCache();
      }
    });
  },

  buildSameCityNearbyList: function (allBars, userRegion) {
    const out = [];
    for (let i = 0; i < allBars.length; i++) {
      const bar = allBars[i];
      if (!regionMatchesBar(bar, userRegion)) continue;
      out.push({
        ...bar,
        distance: 0,
        distanceText: '同城',
        isCityFallback: true,
        isFavorited: favoriteUtil.isFavorited(bar.id)
      });
    }
    out.sort(function (a, b) {
      return (a.name || '').localeCompare(b.name || '', 'zh-CN');
    });
    return out;
  },

  /**
   * 「附近」列表：只遍历 allBackendVenues（接口全量），不读取 barList、newDiscoveredList
   */
  buildNearbyListFromCache: function () {
    const userLocation = this.data.userLocation;
    const allBars = this.data.allBackendVenues || [];
    if (!userLocation || allBars.length === 0) {
      this.setData({
        nearbyList: [],
        nearbyListTitle: '',
        nearbyUseCityFallback: false
      });
      return;
    }
    const out = [];
    for (let i = 0; i < allBars.length; i++) {
      const bar = allBars[i];
      let lat;
      let lng;
      if (barHasValidCoords(bar)) {
        lat = parseFloat(bar.latitude);
        lng = parseFloat(bar.longitude);
      } else {
        const addr = fullAddressFromBar(bar);
        if (!addr) continue;
        const cached = geocodeCache.get(addr);
        if (!cached) continue;
        lat = cached.latitude;
        lng = cached.longitude;
      }
      const meters = haversineDistanceMeters(
        userLocation.latitude,
        userLocation.longitude,
        lat,
        lng
      );
      if (!isFinite(meters) || meters > NEARBY_RADIUS_METERS) continue;
      const distanceInMeters = Math.round(meters);
      const distanceText = formatDistanceMeters(meters);
      out.push({
        ...bar,
        latitude: bar.latitude != null ? bar.latitude : lat,
        longitude: bar.longitude != null ? bar.longitude : lng,
        distance: distanceInMeters,
        distanceText,
        isFavorited: favoriteUtil.isFavorited(bar.id)
      });
    }
    out.sort(function (a, b) {
      return (a.distance || 0) - (b.distance || 0);
    });

    if (out.length > 0) {
      this.setData({
        nearbyList: out,
        nearbyListTitle:
          '共 ' +
          out.length +
          ' 处 · ' +
          NEARBY_RADIUS_KM +
          ' 公里内 · 由近到远',
        nearbyUseCityFallback: false
      });
      return;
    }

    const userRegion = this.data.userRegion;
    if (userRegion && (userRegion.province || userRegion.city)) {
      const fallback = this.buildSameCityNearbyList(allBars, userRegion);
      if (fallback.length > 0) {
        this.setData({
          nearbyList: fallback,
          nearbyListTitle:
            '共 ' +
            fallback.length +
            ' 处 · 同城（场所未标坐标或地址解析失败时按城市展示）',
          nearbyUseCityFallback: true
        });
        return;
      }
    }

    this.setData({
      nearbyList: [],
      nearbyListTitle: '',
      nearbyUseCityFallback: false
    });
  },

  /**
   * 对全量场所中「无后端经纬度、有地址」的条目请求腾讯地图 geocoder，写入缓存后刷新附近列表
   * （与高评分/新发现列表里的 geocoder 共用 geocodeCache，避免重复解析同一地址）
   */
  scheduleGeocoderForNearbyAllBars: function () {
    const that = this;
    if (!that.data.userLocation || !qqmapsdk) return;
    if (geocodeCache.isGeocoderDisabledByKey()) return;
    const allBars = that.data.allBackendVenues || [];
    if (allBars.length === 0) return;

    const tasks = [];
    allBars.forEach(function (item, idx) {
      if (barHasValidCoords(item)) return;
      const fullAddress = fullAddressFromBar(item);
      if (!fullAddress) return;
      if (geocodeCache.get(fullAddress)) return;
      tasks.push({ idx: idx, fullAddress: fullAddress });
    });

    const limited = tasks.slice(0, HOME_GEOCODE_MAX_NEARBY);
    limited.forEach(function (task, i) {
      setTimeout(function () {
        if (geocodeCache.isGeocoderDisabledByKey()) return;
        const idx = task.idx;
        const fullAddress = task.fullAddress;
        const cur = that.data.allBackendVenues;
        if (!cur || !cur[idx]) return;
        const item = cur[idx];
        if (barHasValidCoords(item)) return;
        if (geocodeCache.get(fullAddress)) {
          that.buildNearbyListFromCache();
          return;
        }

        qqmapsdk.geocoder({
          address: fullAddress,
          success: function (res) {
            if (geocodeCache.isUnauthorizedGeocoderResponse(res)) return;
            if (res.result && res.result.location) {
              const lat = res.result.location.lat;
              const lng = res.result.location.lng;
              geocodeCache.set(fullAddress, lat, lng);
              that.setData(
                {
                  ['allBackendVenues[' + idx + '].latitude']: lat,
                  ['allBackendVenues[' + idx + '].longitude']: lng
                },
                function () {
                  that.buildNearbyListFromCache();
                }
              );
            }
          },
          fail: function (err) {
            geocodeCache.tryMarkKeyUnauthorized(err);
          }
        });
      }, i * 400);
    });
  },

  // 为列表计算距离
  calculateDistancesForList: function(listName) {
    const userLocation = this.data.userLocation;
    const list = this.data[listName];
    
    if (!userLocation || !list || list.length === 0) {
      return;
    }
    
    const updatedList = list.map(item => {
      if (item.latitude && item.longitude) {
        const meters = haversineDistanceMeters(
          userLocation.latitude,
          userLocation.longitude,
          parseFloat(item.latitude),
          parseFloat(item.longitude)
        );
        if (!isFinite(meters)) return item;
        const distanceInMeters = Math.round(meters);
        const distanceText = formatDistanceMeters(meters);
        return { ...item, distance: distanceInMeters, distanceText };
      }
      return item;
    });

    this.setData({ [listName]: updatedList }, () => {
      this.scheduleGeocoderDistancesForList(listName);
    });
  },

  /** 无经纬度但有地址时，串行调用地理编码补全距离（降低 QPS 触发限流） */
  scheduleGeocoderDistancesForList: function (listName) {
    const that = this;
    const userLocation = this.data.userLocation;
    if (!userLocation || !qqmapsdk) return;
    if (geocodeCache.isGeocoderDisabledByKey()) return;

    const list = this.data[listName];
    if (!list || list.length === 0) return;

    const tasks = [];
    list.forEach((item, idx) => {
      if (item.distanceText) return;
      if (item.latitude && item.longitude) return;
      const fullAddress = `${item.province || ''}${item.city || ''}${item.district || ''}${item.address || ''}`.trim();
      if (!fullAddress) return;
      tasks.push({ idx, fullAddress });
    });

    const limitedTasks = tasks.slice(0, HOME_GEOCODE_MAX_PER_LIST);

    limitedTasks.forEach((task, i) => {
      setTimeout(function () {
        if (geocodeCache.isGeocoderDisabledByKey()) return;
        const { idx, fullAddress } = task;
        const cur = that.data[listName];
        if (!cur || !cur[idx] || cur[idx].distanceText) return;

        const cached = geocodeCache.get(fullAddress);
        if (cached) {
          that.patchListItemDistance(listName, idx, cached.latitude, cached.longitude);
          return;
        }

        qqmapsdk.geocoder({
          address: fullAddress,
          success: function (res) {
            if (geocodeCache.isUnauthorizedGeocoderResponse(res)) return;
            if (res.result && res.result.location) {
              const lat = res.result.location.lat;
              const lng = res.result.location.lng;
              geocodeCache.set(fullAddress, lat, lng);
              that.patchListItemDistance(listName, idx, lat, lng);
            }
          },
          fail: function (err) {
            geocodeCache.tryMarkKeyUnauthorized(err);
          }
        });
      }, i * 400);
    });
  },

  patchListItemDistance: function (listName, idx, lat, lng) {
    const userLocation = this.data.userLocation;
    if (!userLocation) return;
    const list = this.data[listName];
    if (!list || !list[idx]) return;
    if (list[idx].distanceText) return;

    const meters = haversineDistanceMeters(
      userLocation.latitude,
      userLocation.longitude,
      parseFloat(lat),
      parseFloat(lng)
    );
    if (!isFinite(meters)) return;

    const distanceInMeters = Math.round(meters);
    const distanceText = formatDistanceMeters(meters);
    this.setData(
      {
        [`${listName}[${idx}].distance`]: distanceInMeters,
        [`${listName}[${idx}].distanceText`]: distanceText
      },
      function () {
        this.buildNearbyListFromCache();
      }.bind(this)
    );
  },

  // 记录访问
  recordVisit: function() {
    const openid = wx.getStorageSync('openid');
    wx.request({
      url: `${API_BASE_URL}/api/stats/visit`,
      method: 'POST',
      data: {
        openid: openid,
        page: 'home',
        user_id: null
      },
      success: (res) => {
        
      }
    });
  },

  // 加载未读消息数量
  loadUnreadCount: function() {
    const userInfo = wx.getStorageSync('userInfo');
    const openid = wx.getStorageSync('openid') || (userInfo && userInfo.openid);
    
    const requestData = {};
    if (userInfo && (userInfo.username || userInfo.id)) {
      if (userInfo.id) {
        requestData.user_id = userInfo.id;
      } else if (userInfo.username) {
        requestData.user_id = userInfo.username;
      }
    } else if (openid) {
      requestData.openid = openid;
    } else {
      this.setData({ unreadCount: 0 });
      return;
    }
    
    wx.request({
      url: `${API_BASE_URL}/api/messages/user`,
      method: 'GET',
      data: requestData,
      success: (res) => {
        let unreadCount = 0;
        if (res.statusCode === 200 && res.data && res.data.success && res.data.data) {
          const processedMessages = res.data.data.map(msg => ({
            ...msg,
            is_read: msg.is_read == 1 || msg.is_read === true
          }));
          
          const personalUnread = processedMessages.filter(msg => {
            const isPersonal = msg.type === 'personal' || msg.type === 'user';
            return isPersonal && !msg.is_read;
          }).length;
          
          const systemUnread = processedMessages.filter(msg => {
            const isSystem = msg.type === 'broadcast' || msg.type === 'system';
            return isSystem && !msg.is_read;
          }).length;
          
          unreadCount = personalUnread + systemUnread;
        }
        
        this.setData({ unreadCount: unreadCount });
      },
      fail: (err) => {
        this.setData({ unreadCount: 0 });
      }
    });
  },

  // 跳转到站内信页面
  goToMessages: function() {
    wx.navigateTo({
      url: '/pages/messages/messages',
      success: (res) => {
        
      },
      fail: (err) => {
        
      }
    });
  },

  // 切换标签页
  switchTab: function(e) {
    const activeTab = e.currentTarget.dataset.tab;
    if (activeTab && activeTab !== this.data.activeTab) {
      this.setData({ activeTab: activeTab });
      if (activeTab === 'nearby') {
        if (!this.data.userLocation) {
          this.getUserLocation();
        } else {
          this.buildNearbyListFromCache();
          this.scheduleGeocoderForNearbyAllBars();
          if (!this.data.userRegion) {
            this.requestUserRegionAndRefreshNearby();
          }
        }
      }
    }
  },

  /** 用户主动开启定位（附近 Tab 空态） */
  requestLocationForNearby: function () {
    const that = this;
    wx.getSetting({
      success: function (res) {
        if (res.authSetting['scope.userLocation'] === false) {
          wx.openSetting({
            success: function () {
              that.getUserLocation(true);
            }
          });
        } else {
          that.getUserLocation(true);
        }
      },
      fail: function () {
        that.getUserLocation(true);
      }
    });
  },



  // 切换地址展开/收起
  toggleAddressExpand: function(e) {
    
    const index = e.currentTarget.dataset.index;
    const listType = e.currentTarget.dataset.listType;
    const dataField =
      listType === 'new' ? 'newDiscoveredList' : listType === 'nearby' ? 'nearbyList' : 'barList';
    const list = this.data[dataField] || [];
    const bar = list[index];
    
    if (!bar) return;
    
    // 切换展开状态
    this.setData({
      [`${dataField}[${index}].addressExpanded`]: !bar.addressExpanded
    });
  },



  onPullDownRefresh: function() {
    this.loadFiveStarBars();
    wx.stopPullDownRefresh();
  },

  retryLoadHomeData: function () {
    this.setData({
      loadError: false,
      errorMessage: '',
      dataLoaded: false
    });
    this.loadFiveStarBars();
  },

  /** 底部 Tab「搜索」：从附近空态跳转 */
  goToSearchTabFromNearby: function () {
    wx.switchTab({
      url: '/pages/index/index'
    });
  },

  /** 重新拉数据并刷新定位与附近列表 */
  retryNearbyRefresh: function () {
    const that = this;
    that.loadFiveStarBars();
    if (that.data.userLocation) {
      that.requestUserRegionAndRefreshNearby();
      that.scheduleGeocoderForNearbyAllBars();
    }
  },

  /** 与 onShareAppMessage 使用同一套封面 URL */
  getPreferredShareImageUrl: function() {
    const lists = [this.data.barList, this.data.newDiscoveredList, this.data.nearbyList];
    let preferred = '';
    for (let i = 0; i < lists.length && !preferred; i++) {
      const list = lists[i];
      if (!list || !list.length) continue;
      for (let j = 0; j < list.length && !preferred; j++) {
        preferred = pickVenueShareImageUrl(list[j]) || '';
      }
    }
    return preferred;
  },

  buildHomeSharePayload: function(preferred, title, path, query) {
    const imageUrl = shareCardImageUrl(preferred);
    if (query !== undefined) {
      return { title: title, query: query, imageUrl: imageUrl };
    }
    return { title: title, path: path, imageUrl: imageUrl };
  },

  onShareAppMessage: function() {
    const title = '最近热门酒吧和民宿推荐';
    const path = '/pages/home/home';
    const safe = { title: title, path: path, imageUrl: DEFAULT_SHARE_IMAGE_URL };
    try {
      const preferred = this.getPreferredShareImageUrl();
      return this.buildHomeSharePayload(preferred, title, path);
    } catch (err) {
      console.error('onShareAppMessage', err);
      return safe;
    }
  },

  onShareTimeline: function() {
    const title = '最近热门酒吧和民宿推荐';
    try {
      const preferred = this.getPreferredShareImageUrl();
      return this.buildHomeSharePayload(preferred, title, null, '');
    } catch (err) {
      console.error('onShareTimeline', err);
      return { title: title, query: '', imageUrl: DEFAULT_SHARE_IMAGE_URL };
    }
  },

  /**
   * 列表上方说明：先给数量，类型用「·」分隔，避免「发现新的公园酒吧民宿等12条」挤成一句
   * @param {'new'|'hot'} variant 新发现 / 高评分（Tab 已有文案，此处不再重复前缀）
   */
  getDynamicTitle: function (bars, variant) {
    if (!bars || bars.length === 0) return '';
    const n = bars.length;
    const categories = new Set();
    bars.forEach(function (bar) {
      if (bar.categoryType) categories.add(bar.categoryType);
    });
    const categoryList = Array.from(categories);
    const maxTypes = 4;
    const display = categoryList.slice(0, maxTypes);
    const more = categoryList.length > maxTypes ? ' 等' : '';
    const typePart =
      display.length > 0 ? display.join(' · ') + more : '';

    if (variant === 'new') {
      return typePart
        ? '共 ' + n + ' 处 · ' + typePart
        : '共 ' + n + ' 处 · 含多种类型';
    }
    if (variant === 'hot') {
      return typePart
        ? '共 ' + n + ' 处 · ' + typePart
        : '共 ' + n + ' 处 · 满分精选';
    }
    return '';
  },

  // 加载酒吧和民宿数据
  loadFiveStarBars: function() {
    const that = this;
    
    wx.request({
      url: `${API_BASE_URL}/api/info?_t=${Date.now()}`,
      method: 'GET',
      timeout: 10000,
      success: function(res) {
        if (res.statusCode !== 200) {
          that.setData({
            allBackendVenues: [],
            nearbyList: [],
            nearbyListTitle: '',
            newDiscoveredList: [],
            newListTitle: '',
            barList: [],
            listTitle: '',
            dataLoaded: false,
            loadError: true,
            errorMessage: '网络异常，稍后重试，或搜索“有指南”小程序'
          });
          return;
        }
        const backendList = processApiResponse(res.data);
        const rows = Array.isArray(backendList) ? backendList : [];
        // 接口返回的完整列表 → 仅此一份作为「附近」数据源（不按评分裁剪）
        const allBackendVenues = rows.map(function (bar) {
          const normalized = normalizeVenueData(bar);
          normalized.isFavorited = favoriteUtil.isFavorited(normalized.id);
          return normalized;
        });

        const newBars = allBackendVenues.filter(function (bar) {
          const rating = parseFloat(bar.rating);
          return !rating || rating === 0 || bar.rating === '' || bar.rating === null;
        });

        const highRatedBars = allBackendVenues.filter(function (bar) {
          const rating = parseFloat(bar.rating);
          return rating === 100;
        });

        const dataToCache = {
          newDiscoveredList: newBars,
          newListTitle: that.getDynamicTitle(newBars, 'new'),
          barList: highRatedBars,
          listTitle: that.getDynamicTitle(highRatedBars, 'hot')
        };

        that.setData({
          allBackendVenues: allBackendVenues,
          newDiscoveredList: dataToCache.newDiscoveredList,
          newListTitle: dataToCache.newListTitle,
          barList: dataToCache.barList,
          listTitle: dataToCache.listTitle,
          dataLoaded: true,
          loadError: false,
          errorMessage: ''
        }, () => {
          if (that.data.userLocation) {
            that.calculateDistancesForList('barList');
            that.calculateDistancesForList('newDiscoveredList');
            that.buildNearbyListFromCache();
            that.scheduleGeocoderForNearbyAllBars();
            that.requestUserRegionAndRefreshNearby();
          }
        });
      },
      fail: function(err) {
        that.setData({ 
          allBackendVenues: [],
          nearbyList: [],
          nearbyListTitle: '',
          newDiscoveredList: [],
          newListTitle: '',
          barList: [], 
          listTitle: '',
          dataLoaded: false,
          loadError: true,
          errorMessage: '网络异常，稍后重试，或搜索“有指南”小程序'
        });
      }
    });
  },

  // 拨打电话
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
  
  // 复制地址
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

  // 跳转到详情页
  goToDetail: function(e) {
    if (!e || !e.currentTarget || !e.currentTarget.dataset) {
      return;
    }
    
    const index = e.currentTarget.dataset.index;
    const listType = e.currentTarget.dataset.listType;
    
    if (index === undefined || !listType) return;
    
    let bar = null;
    if (listType === 'new') {
      bar = this.data.newDiscoveredList[index];
    } else if (listType === 'nearby') {
      bar = this.data.nearbyList[index];
    } else {
      bar = this.data.barList[index];
    }
    
    if (!bar || !bar.id) return;
    
    try {
      // 跳转到详情页，只传递 id 参数
      wx.navigateTo({
        url: `/pages/detail/detail?id=${bar.id}`
      });
    } catch (err) {
      
      wx.showToast({
        title: '跳转失败',
        icon: 'none',
        duration: 1000
      });
    }
  },

  // 跳转到搜索页并筛选分类
  goToSearchWithCategory: function(e) {
    if (!e || !e.currentTarget || !e.currentTarget.dataset) {
      return;
    }
    
    const category = e.currentTarget.dataset.category;
    
    if (!category) return;
    
    try {
      // 跳转到搜索页，传递分类参数
      wx.switchTab({
        url: `/pages/index/index?category=${encodeURIComponent(category)}`
      });
    } catch (err) {
      wx.showToast({
        title: '跳转失败',
        icon: 'none',
        duration: 1000
      });
    }
  },

  // 打开微信地图
  openLocation: function(e) {
    if (!e || !e.currentTarget || !e.currentTarget.dataset) {
      return;
    }
    
    const index = e.currentTarget.dataset.index;
    const bar = this.data.barList[index];
    
    if (!bar) return;
    
    // 检查是否有经纬度信息
    if (!bar.latitude || !bar.longitude) {
      wx.showToast({
        title: '该地点暂无位置信息',
        icon: 'none',
        duration: 1000
      });
      return;
    }
    
    try {
      // 打开微信地图
      wx.openLocation({
        latitude: bar.latitude,
        longitude: bar.longitude,
        name: bar.name || '',
        address: (bar.province || '') + (bar.city || '') + (bar.district || '') + (bar.address || ''),
        scale: 18
      });
    } catch (err) {
      
      wx.showToast({
        title: '打开地图失败',
        icon: 'none',
        duration: 1000
      });
    }
  },
  
  // 测试图片URL是否可访问
  testImageUrl: function(imageUrl) {
    return new Promise((resolve) => {
      wx.request({
        url: imageUrl,
        method: 'HEAD',
        success: () => resolve(true),
        fail: () => resolve(false)
      });
    });
  },

  // 图片加载失败处理函数（列表缩略图失败时回退原图）
  onImageError: function(e) {
    const index = e.currentTarget.dataset.index;
    const listType = e.currentTarget.dataset.listType;
    const dataField =
      listType === 'new' ? 'newDiscoveredList' : listType === 'nearby' ? 'nearbyList' : 'barList';
    const list = this.data[dataField] || [];
    
    if (index === undefined || !list[index]) return;
    const bar = list[index];
    if (bar.listImage && bar.listImage !== bar.image) {
      this.setData({
        [`${dataField}[${index}].listImage`]: ''
      });
      return;
    }
    this.setData({
      [`${dataField}[${index}].imageError`]: true
    });
  },

  toggleFavorite: function(e) {
    const index = e.currentTarget.dataset.index;
    const listType = e.currentTarget.dataset.listType;
    const dataField =
      listType === 'new' ? 'newDiscoveredList' : listType === 'nearby' ? 'nearbyList' : 'barList';
    const list = this.data[dataField] || [];
    const bar = list[index];
    
    if (!bar || !bar.id) {
      wx.showToast({ title: '操作失败', icon: 'none' });
      return;
    }
    favoriteUtil.toggleFavorite(bar.id);
  },

  // 页面隐藏时清理定时器
  onHide: function() {
    if (this.tabBarUpdateTimer) {
      clearTimeout(this.tabBarUpdateTimer);
      this.tabBarUpdateTimer = null;
    }
  },

  // 页面卸载时清理定时器
  onUnload: function() {
    if (this.tabBarUpdateTimer) {
      clearTimeout(this.tabBarUpdateTimer);
      this.tabBarUpdateTimer = null;
    }
  }

})
