const app = getApp()
const { API_BASE_URL, DEFAULT_SHARE_IMAGE_URL, SHARE_FRIEND_USE_VENUE_COVER, TENCENT_LOCATION_KEY } = require('../../utils/constants.js');
const { processContactInfo, processImageUrl, processApiResponse, getCategoryType, formatAddress, normalizeVenueData, maskPhone, maskWechat, checkLogin, canMakeCall, getDailyCallCount, incrementCallCount, haversineDistanceMeters, formatDistanceMeters, shareCardImageUrlFromBar } = require('../../utils/commonUtils');
const favoriteUtil = require('../../utils/favoriteUtil.js');
const geocodeCache = require('../../utils/geocodeCache.js');

let qqmapsdk = null;

Page({
  data: {
    statusBarHeight: 0,
    navBarHeight: 0,
    totalNavBarHeight: 0,
    expandedNavBarHeight: 0,
    barData: {
      phoneNumbers: [],
      maskedPhoneNumbers: [],
      landlineNumbers: [],
      maskedLandlineNumbers: [],
      otherContacts: [],
      maskedOtherContacts: []
    },
    showLoginModal: false,
    userLocation: null,
    distance: null,
    distanceText: '',
    distanceLoading: false,
    distanceUnavailable: false
  },

  onLoad: function(options) {
    const systemInfo = wx.getSystemInfoSync()
    const statusBarHeight = systemInfo.statusBarHeight
    const navBarHeight = 44
    const totalNavBarHeight = statusBarHeight + navBarHeight
    const expandedNavBarHeight = Math.round(totalNavBarHeight * 1.15)

    this.setData({
      statusBarHeight: statusBarHeight,
      navBarHeight: navBarHeight,
      totalNavBarHeight: totalNavBarHeight,
      expandedNavBarHeight: expandedNavBarHeight
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

    this.onFavoriteChange = this.onFavoriteChange.bind(this);
    favoriteUtil.subscribe(this.onFavoriteChange);

    if (options && options.id) {
      this.barId = options.id;
      this.loadBarDetail(options.id);
    } else if (options && options.barData) {
      try {
        const barData = JSON.parse(decodeURIComponent(options.barData));
        if (barData && barData.id) {
          this.barId = barData.id;
          this.loadBarDetail(barData.id);
        }
      } catch (e) {
        wx.showToast({ title: '加载失败', icon: 'none', duration: 1000 });
      }
    } else {
      wx.showToast({ title: '参数错误', icon: 'none', duration: 1000 });
    }

    wx.showShareMenu({
      withShareTicket: true,
      menus: ['shareAppMessage', 'shareTimeline']
    });
  },

  onUnload: function() {
    favoriteUtil.unsubscribe(this.onFavoriteChange);
  },

  onFavoriteChange: function() {
    if (this.barId) {
      const barData = this.data.barData;
      if (barData && barData.id) {
        const updatedBarData = { ...barData };
        updatedBarData.isFavorited = favoriteUtil.isFavorited(barData.id);
        this.setData({ barData: updatedBarData });
      }
    }
  },

  onShow: function() {
    favoriteUtil.initFavorites();
    this.calculateDistance();
  },

  // 计算距离
  calculateDistance: function() {
    const that = this;
    const barData = this.data.barData;
    
    console.log('详情页检查距离计算 - barData:', {
      hasBarData: !!barData,
      hasLatitude: barData ? !!barData.latitude : false,
      hasLongitude: barData ? !!barData.longitude : false,
      address: barData ? (barData.province + barData.city + barData.district + barData.address) : '无数据'
    });
    
    if (!barData || !barData.id) {
      return;
    }

    this.setData({ distanceUnavailable: false });

    // 如果有经纬度，直接计算
    if (barData.latitude && barData.longitude) {
      this.calculateDistanceWithCoords(barData.latitude, barData.longitude);
      return;
    }
    
    // 如果没有经纬度，但有地址，使用腾讯地图 SDK 地址解析
    if (barData.province && barData.city && barData.address) {
      const fullAddress = `${barData.province}${barData.city}${barData.district}${barData.address}`;
      console.log('使用地址解析计算距离:', fullAddress);
      this.calculateDistanceWithGeocoder(fullAddress);
      return;
    }
    
    this.setData({ distanceLoading: false, distanceUnavailable: true, distanceText: '' });
  },

  // 使用坐标直接计算距离
  calculateDistanceWithCoords: function(lat, lng) {
    const that = this;
    
    this.setData({ distanceLoading: true });
    
    wx.getLocation({
      type: 'gcj02',
      success: function(res) {
        const userLatitude = res.latitude;
        const userLongitude = res.longitude;
        
        console.log('获取到用户位置:', res);
        
        const meters = haversineDistanceMeters(
          userLatitude,
          userLongitude,
          parseFloat(lat),
          parseFloat(lng)
        );
        if (!isFinite(meters)) {
          that.setData({ distanceLoading: false, distanceUnavailable: true, distanceText: '' });
          return;
        }
        const distanceInMeters = Math.round(meters);
        const distanceText = formatDistanceMeters(meters);

        that.setData({
          distance: distanceInMeters,
          distanceText: distanceText,
          distanceLoading: false,
          distanceUnavailable: false
        });
      },
      fail: function(err) {
        that.setData({ distanceLoading: false, distanceUnavailable: true, distanceText: '' });
        console.error('获取位置失败:', err);
      }
    });
  },

  // 使用腾讯地图 SDK 地址解析计算距离
  calculateDistanceWithGeocoder: function(fullAddress) {
    const that = this;
    
    const cached = geocodeCache.get(fullAddress);
    if (cached) {
      this.calculateDistanceWithCoords(cached.latitude, cached.longitude);
      return;
    }
    
    this.setData({ distanceLoading: true });

    if (geocodeCache.isGeocoderDisabledByKey()) {
      that.setData({ distanceLoading: false, distanceUnavailable: true, distanceText: '' });
      return;
    }

    console.log('正在调用腾讯地图 SDK 解析地址:', fullAddress);

    qqmapsdk.geocoder({
      address: fullAddress,
      success: function(res) {
        console.log('地址解析结果:', res);

        if (geocodeCache.isUnauthorizedGeocoderResponse(res)) {
          that.setData({ distanceLoading: false, distanceUnavailable: true, distanceText: '' });
          return;
        }

        if (res.result && res.result.location) {
          const latitude = res.result.location.lat;
          const longitude = res.result.location.lng;
          
          geocodeCache.set(fullAddress, latitude, longitude);
          
          // 计算距离
          that.calculateDistanceWithCoords(latitude, longitude);
        } else {
          that.setData({ distanceLoading: false, distanceUnavailable: true, distanceText: '' });
        }
      },
      fail: function(err) {
        if (geocodeCache.tryMarkKeyUnauthorized(err)) {
          that.setData({ distanceLoading: false, distanceUnavailable: true, distanceText: '' });
          return;
        }
        console.warn('地址解析失败:', err);
        that.setData({ distanceLoading: false, distanceUnavailable: true, distanceText: '' });
      }
    });
  },

  // 计算直线距离（备用方案）
  calculateStraightDistance: function(lat1, lng1) {
    const lat2 = parseFloat(this.data.barData.latitude);
    const lng2 = parseFloat(this.data.barData.longitude);
    
    if (!lat2 || !lng2) {
      this.setData({ distanceLoading: false, distanceUnavailable: true, distanceText: '' });
      return;
    }
    
    const meters = haversineDistanceMeters(lat1, lng1, lat2, lng2);
    if (!isFinite(meters)) {
      this.setData({ distanceLoading: false, distanceUnavailable: true, distanceText: '' });
      return;
    }
    const distanceInMeters = Math.round(meters);
    const distanceText = formatDistanceMeters(meters);

    this.setData({
      distance: distanceInMeters,
      distanceText: distanceText,
      distanceLoading: false,
      distanceUnavailable: false
    });
  },

  processBarDataWithMask: function(normalizedBar) {
    const finalBarData = {
      ...normalizedBar,
      maskedPhoneNumbers: normalizedBar.maskedPhoneNumbers || normalizedBar.phoneNumbers || [],
      maskedLandlineNumbers: normalizedBar.maskedLandlineNumbers || normalizedBar.landlineNumbers || [],
      maskedOtherContacts: normalizedBar.maskedOtherContacts || normalizedBar.otherContacts || [],
      phoneNumbers: normalizedBar.phoneNumbers || [],
      landlineNumbers: normalizedBar.landlineNumbers || [],
      otherContacts: normalizedBar.otherContacts || []
    };
    
    return finalBarData;
  },

  recordView: function(infoId) {
    wx.request({
      url: `${API_BASE_URL}/api/info/` + infoId + `/view`,
      method: 'POST',
      success: (res) => {}
    });
  },

  loadBarDetail: function(barId) {
    if (!barId) {
      wx.showToast({ title: '参数错误', icon: 'none', duration: 1000 });
      return;
    }
    
    this.setData({ barData: {} });
    wx.showLoading({ title: '加载中...' });
    
    const that = this;
    
    favoriteUtil.initFavorites(() => {
      wx.request({
        url: `${API_BASE_URL}/api/info?_t=${Date.now()}`,
        method: 'GET',
        success: function(res) {
          const barData = processApiResponse(res.data);
          const matchingBars = barData.filter(function(item) {
            return item && item.id && String(item.id) === String(barId);
          });
          
          let bar = null;
          if (matchingBars.length === 0) {
            wx.showToast({ title: '未找到该酒吧信息', icon: 'none', duration: 1000 });
          } else if (matchingBars.length === 1) {
            bar = matchingBars[0];
          } else {
            bar = matchingBars[matchingBars.length - 1];
          }

          if (bar) {
            const favoritedBars = {};
            favoritedBars[String(bar.id)] = favoriteUtil.isFavorited(bar.id);
            const normalizedBar = normalizeVenueData(bar, favoritedBars);
            const finalBarData = that.processBarDataWithMask(normalizedBar);
            
            that.setData({
              barData: finalBarData
            });
            that.calculateDistance();

            if (finalBarData.id) {
              that.recordView(finalBarData.id);
            }
          }
        },
        fail: function(err) {
          that.setData({ barData: {} });
      },
      complete: () => {
        wx.hideLoading();
      }
    });
    });
  },

  onImageError: function(e) {
    const index = e.currentTarget.dataset.index;
    const barData = this.data.barData;
    if (barData && barData.images && index !== undefined && barData.images[index]) {
      const updatedImages = [...barData.images];
      updatedImages.splice(index, 1);
      const updatedBarData = { ...barData, images: updatedImages };
      if (index === 0 && updatedImages.length > 0) {
        updatedBarData.image = updatedImages[0];
      } else if (updatedImages.length === 0) {
        updatedBarData.image = '';
      }
      this.setData({ barData: updatedBarData });
    }
  },

  copyAddress: function() {
    const barData = this.data.barData;
    const address = formatAddress(barData);
    wx.setClipboardData({
      data: address,
      success: function() {
        wx.showToast({ title: '地址已复制', icon: 'success', duration: 2000 });
      }
    });
  },

  openLocation: function() {
    const barData = this.data.barData;
    const address = formatAddress(barData);

    if (!address) {
      wx.showToast({ title: '该地点暂无位置信息', icon: 'none' });
      return;
    }

    const cachedOpen = geocodeCache.get(address);
    if (cachedOpen) {
      wx.openLocation({
        latitude: cachedOpen.latitude,
        longitude: cachedOpen.longitude,
        name: barData.name || '未知地点',
        address: address || '未知地址',
        scale: 18
      });
      return;
    }

    wx.showLoading({ title: '正在解析地址...' });

    if (!qqmapsdk || geocodeCache.isGeocoderDisabledByKey()) {
      wx.hideLoading();
      this.openLocationFallback(address, barData);
      return;
    }

    qqmapsdk.geocoder({
      address: address,
      success: (res) => {
        wx.hideLoading();
        if (geocodeCache.isUnauthorizedGeocoderResponse(res)) {
          this.openLocationFallback(address, barData);
          return;
        }
        if (res.result && res.result.location) {
          const latitude = res.result.location.lat;
          const longitude = res.result.location.lng;
          geocodeCache.set(address, latitude, longitude);
          wx.openLocation({
            latitude: latitude,
            longitude: longitude,
            name: barData.name || '未知地点',
            address: address || '未知地址',
            scale: 18
          });
        } else {
          this.openLocationFallback(address, barData);
        }
      },
      fail: (err) => {
        wx.hideLoading();
        geocodeCache.tryMarkKeyUnauthorized(err);
        this.openLocationFallback(address, barData);
      }
    });
  },

  openLocationFallback: function(address, barData) {
    wx.showModal({
      title: '导航提示',
      content: '请在打开的地图中搜索：\n\n' + (barData.name || '目标地点') + '\n' + address,
      confirmText: '打开地图',
      success: function(modalRes) {
        if (modalRes.confirm) {
          wx.getLocation({
            type: 'gcj02',
            success: function(locationRes) {
              wx.openLocation({
                latitude: locationRes.latitude,
                longitude: locationRes.longitude,
                name: barData.name || '未知地点',
                address: address || '未知地址',
                scale: 18
              });
            },
            fail: function(err) {
              wx.openLocation({
                latitude: 39.908823,
                longitude: 116.397470,
                name: barData.name || '未知地点',
                address: address || '未知地址',
                scale: 18
              });
            }
          });
        }
      }
    });
  },

  makePhoneCall: function(e) {
    const realPhone = e.currentTarget.dataset.phone;
    if (!realPhone) return;
    
    const maskedPhone = this.maskPhoneNumber(realPhone);
    
    if (!checkLogin()) {
      this.setData({ showLoginModal: true });
      return;
    }
    
    if (!canMakeCall()) {
      wx.showModal({
        title: '拨打次数已达上限',
        content: '您今日已拨打 6 次，请明天再试',
        showCancel: false
      });
      return;
    }
    
    wx.showModal({
      title: '确认拨打',
      content: `电话号码：${maskedPhone}\n确定要拨打吗？`,
      success: (res) => {
        if (res.confirm) {
          const newCount = incrementCallCount();
          wx.makePhoneCall({
            phoneNumber: realPhone
          });
          
          if (newCount >= 5) {
            wx.showToast({
              title: `今日已拨打${newCount}次，还剩${6 - newCount}次`,
              icon: 'none',
              duration: 2000
            });
          }
        }
      }
    });
  },
  
  maskPhoneNumber: function(phone) {
    if (!phone) return '';
    const phoneStr = String(phone).trim();
    
    if (phoneStr.length === 11 && /^\d+$/.test(phoneStr)) {
      return phoneStr.replace(/(\d{3})\d{4}(\d{4})/, '$1****$2');
    }
    
    const cleanNumber = phoneStr.replace(/[-\s()]/g, '');
    if (cleanNumber.length >= 10 && /^\d+$/.test(cleanNumber)) {
      return cleanNumber.replace(/(\d{3,4})\d{4,5}(\d{4})/, '$1****$2');
    }
    
    const digitsOnly = phoneStr.replace(/\D/g, '');
    if (digitsOnly.length >= 10) {
      return digitsOnly.replace(/(\d{3,4})\d{4,5}(\d{4})/, '$1****$2');
    }
    
    return phoneStr;
  },

  copyContact: function(e) {
    const realContact = e.currentTarget.dataset.contact;
    if (!realContact) return;
    
    const maskedContact = this.maskWechatNumber(realContact);
    
    if (!checkLogin()) {
      this.setData({ showLoginModal: true });
      return;
    }
    
    if (!canMakeCall()) {
      wx.showModal({
        title: '使用次数已达上限',
        content: '您今日已使用 6 次，请明天再试',
        showCancel: false
      });
      return;
    }
    
    wx.showModal({
      title: '确认复制',
      content: `微信号：${maskedContact}\n确定要复制吗？`,
      success: (res) => {
        if (res.confirm) {
          const newCount = incrementCallCount();
          
          wx.setClipboardData({
            data: realContact,
            success: function() {
              wx.showToast({ 
                title: '已复制到剪贴板', 
                icon: 'success', 
                duration: 2000 
              });
            }
          });
          
          if (newCount >= 5) {
            wx.showToast({
              title: `今日已使用${newCount}次，还剩${6 - newCount}次`,
              icon: 'none',
              duration: 2000
            });
          }
        }
      }
    });
  },
  
  maskWechatNumber: function(wechat) {
    if (!wechat) return '';
    const wechatStr = String(wechat).trim();
    
    if (wechatStr.length > 6) {
      return wechatStr.substring(0, 2) + '****' + wechatStr.substring(wechatStr.length - 2);
    }
    
    if (wechatStr.length > 3) {
      return wechatStr.charAt(0) + '****' + wechatStr.charAt(wechatStr.length - 1);
    }
    
    return wechatStr;
  },

  toggleFavorite: function() {
    const barData = this.data.barData;
    if (!barData || !barData.id) {
      wx.showToast({ title: '操作失败', icon: 'none' });
      return;
    }
    favoriteUtil.toggleFavorite(barData.id);
  },

  goBack: function() {
    const pages = getCurrentPages();
    if (pages.length === 1) {
      wx.switchTab({
        url: '/pages/home/home',
        success: function() {
          wx.showToast({ title: '已返回首页', icon: 'none', duration: 1000 });
        },
        fail: function() {
          wx.navigateTo({ url: '/pages/home/home' });
        }
      });
    } else {
      wx.navigateBack();
    }
  },

  onShare: function() {
    wx.showShareMenu({
      withShareTicket: true,
      menus: ['shareAppMessage', 'shareTimeline']
    });
  },

  onShareAppMessage: function() {
    const fallback = {
      title: '推荐一个好地方',
      path: '/pages/home/home',
      imageUrl: DEFAULT_SHARE_IMAGE_URL
    };
    try {
      const barData = this.data.barData || {};
      let title = (barData.name && String(barData.name).trim()) || '推荐一个好地方';
      if (title.length > 64) {
        title = title.slice(0, 63) + '…';
      }
      const id = barData.id;
      const path =
        id != null && id !== ''
          ? '/pages/detail/detail?id=' + encodeURIComponent(String(id))
          : '/pages/home/home';
      const imageUrl = SHARE_FRIEND_USE_VENUE_COVER
        ? shareCardImageUrlFromBar(barData)
        : DEFAULT_SHARE_IMAGE_URL;
      return {
        title: String(title || fallback.title),
        path: String(path || fallback.path),
        imageUrl: String(imageUrl || fallback.imageUrl)
      };
    } catch (err) {
      console.error('onShareAppMessage', err);
      return fallback;
    }
  },

  onShareTimeline: function() {
    const fallback = {
      title: '推荐一个好地方',
      query: '',
      imageUrl: DEFAULT_SHARE_IMAGE_URL
    };
    const base = {
      success: function() {
        wx.showToast({ title: '分享成功', icon: 'success', duration: 2000 });
      },
      fail: function() {
        wx.showToast({ title: '分享失败', icon: 'none', duration: 2000 });
      }
    };
    try {
      const barData = this.data.barData || {};
      const name = barData.name && String(barData.name).trim();
      const desc = (barData.description && String(barData.description).trim()) || '推荐一个好地方';
      let title = name ? name + ' - ' + desc : desc;
      if (title.length > 64) {
        title = title.slice(0, 63) + '…';
      }
      const id = barData.id;
      const query =
        id != null && id !== '' ? 'id=' + encodeURIComponent(String(id)) : '';
      const imageUrl = SHARE_FRIEND_USE_VENUE_COVER
        ? shareCardImageUrlFromBar(barData)
        : DEFAULT_SHARE_IMAGE_URL;
      return Object.assign(
        {
          title: String(title || fallback.title),
          query: query,
          imageUrl: String(imageUrl || fallback.imageUrl)
        },
        base
      );
    } catch (err) {
      console.error('onShareTimeline', err);
      return Object.assign(fallback, base);
    }
  },
  
  cancelLogin: function() {
    this.setData({ showLoginModal: false });
  },
  
  confirmLogin: function() {
    this.setData({ showLoginModal: false });
    wx.showModal({
      title: '温馨提示',
      content: '请前往"我的"页面进行登录',
      showCancel: false,
      success: () => {
        wx.switchTab({
          url: '/pages/mine/mine'
        });
      }
    });
  }
})
