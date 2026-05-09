const app = getApp()
const { API_BASE_URL } = require('../../utils/constants.js');
const { processApiResponse, normalizeVenueData, haversineDistanceMeters, formatDistanceMeters } = require('../../utils/commonUtils');
const favoriteUtil = require('../../utils/favoriteUtil.js');

Page({
  data: {
    favoriteBars: [],
    statusBarHeight: 0,
    navBarHeight: 0,
    totalNavBarHeight: 0,
    expandedNavBarHeight: 0,
    userLocation: null
  },

  onLoad: function() {
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
    
    this.onFavoriteChange = this.onFavoriteChange.bind(this);
    favoriteUtil.subscribe(this.onFavoriteChange);
    favoriteUtil.initFavorites();
    
    this.loadFavoriteBars();
  },

  onUnload: function() {
    favoriteUtil.unsubscribe(this.onFavoriteChange);
  },

  onFavoriteChange: function() {
    this.loadFavoriteBars();
  },

  goBack: function() {
    wx.navigateBack({
      delta: 1
    });
  },

  goToDetail: function(e) {
    const index = e.currentTarget.dataset.index;
    const bar = this.data.favoriteBars[index];
    if (!bar) return;
    
    wx.navigateTo({
      url: '/pages/detail/detail?id=' + bar.id
    });
  },

  onShow: function() {
    favoriteUtil.refreshFavorites();
    // 获取用户位置并计算距离
    this.getUserLocation();
  },

  // 获取用户位置
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
        // 位置获取成功后，更新列表中的距离信息
        if (that.data.favoriteBars && that.data.favoriteBars.length > 0) {
          that.calculateDistances();
        }
      },
      fail: function(err) {
        console.error('获取位置失败:', err);
      }
    });
  },

  // 计算列表中所有地点的距离
  calculateDistances: function() {
    const userLocation = this.data.userLocation;
    const favoriteBars = this.data.favoriteBars;
    
    if (!userLocation || !favoriteBars || favoriteBars.length === 0) {
      return;
    }
    
    const updatedFavoriteBars = favoriteBars.map(bar => {
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
    
    this.setData({ favoriteBars: updatedFavoriteBars });
  },

  loadFavoriteBars: function() {
    this.setData({ favoriteBars: [] });
    wx.showLoading({ title: '加载中...' });
    
    wx.request({
      url: `${API_BASE_URL}/api/info?_t=${Date.now()}`,
      method: 'GET',
      success: (res) => {
        const barData = processApiResponse(res.data);
        
        const favoriteBars = barData.filter(bar => {
          const normalized = normalizeVenueData(bar);
          return normalized && normalized.id && favoriteUtil.isFavorited(normalized.id);
        }).map(bar => {
          const normalized = normalizeVenueData(bar);
          normalized.isFavorited = true;
          return normalized;
        });
        
        favoriteBars.sort((a, b) => {
          const ratingA = typeof a.rating === 'number' ? a.rating : parseFloat(a.rating) || 0;
          const ratingB = typeof b.rating === 'number' ? b.rating : parseFloat(b.rating) || 0;
          return ratingB - ratingA;
        });
        
        this.setData({ favoriteBars: favoriteBars }, () => {
          // 数据加载完成后计算距离
          if (this.data.userLocation) {
            this.calculateDistances();
          }
        });
      },
      fail: () => {
        this.setData({ favoriteBars: [] });
      },
      complete: () => {
        wx.hideLoading();
      }
    });
  },

  toggleFavorite: function(e) {
    const index = e.currentTarget.dataset.index;
    const favoriteBars = this.data.favoriteBars;
    const bar = favoriteBars[index];
    if (!bar) return;
    
    wx.showModal({
      title: '提示',
      content: '确定要取消收藏吗？',
      success: (res) => {
        if (res.confirm) {
          favoriteUtil.removeFavorite(bar.id, () => {
            const updatedBars = [...favoriteBars];
            updatedBars.splice(index, 1);
            this.setData({ favoriteBars: updatedBars });
          });
        }
      }
    });
  },

  onImageError: function(e) {
    const index = e.currentTarget.dataset.index;
    const favoriteBars = this.data.favoriteBars || [];
      
    if (index === undefined || !favoriteBars[index]) return;
    const bar = favoriteBars[index];
    if (bar.listImage && bar.listImage !== bar.image) {
      this.setData({ [`favoriteBars[${index}].listImage`]: '' });
      return;
    }
    this.setData({ [`favoriteBars[${index}].imageError`]: true });
  },
    
  makePhoneCall: function(e) {
    const phone = e.currentTarget.dataset.phone
    if (phone) {
      wx.makePhoneCall({
        phoneNumber: phone
      })
    }
  },
  
  openLocation: function(e) {
    const index = e.currentTarget.dataset.index
    const favoriteBars = this.data.favoriteBars
    const bar = favoriteBars[index]
    if (!bar) return
    
    if (!bar.latitude || !bar.longitude) {
      wx.showToast({
        title: '该地点暂无位置信息',
        icon: 'none'
      })
      return
    }
    
    wx.openLocation({
      latitude: bar.latitude,
      longitude: bar.longitude,
      name: bar.name,
      address: bar.province + bar.city + bar.district + bar.address,
      scale: 18
    })
  },

  // 复制地址
  copyAddress: function(e) {
    const index = e.currentTarget.dataset.index
    const favoriteBars = this.data.favoriteBars
    const bar = favoriteBars[index]
    if (!bar) return
    
    const fullAddress = bar.province + bar.city + bar.district + bar.address
    
    wx.setClipboardData({
      data: fullAddress,
      success: function() {
        wx.showToast({
          title: '地址已复制',
          icon: 'success',
          duration: 1500
        })
      },
      fail: function(err) {
        wx.showToast({
          title: '复制失败',
          icon: 'none'
        })
      }
    })
  },

  // 切换地址展开/收起
  toggleAddressExpand: function(e) {
    const index = e.currentTarget.dataset.index
    const favoriteBars = this.data.favoriteBars
    const bar = favoriteBars[index]
    if (!bar) return
    
    bar.addressExpanded = !bar.addressExpanded
    this.setData({ favoriteBars: favoriteBars })
  }
})
