Page({
  data: {
    loading: true,
    error: false,
    errorMessage: ''
  },

  goBack: function() {
    wx.navigateBack();
  },

  handleMessage: function(e) {
    
  },

  onWebViewLoad: function() {
    this.setData({
      loading: false,
      error: false
    });
  },

  onWebViewError: function(e) {
    this.setData({
      loading: false,
      error: true,
      errorMessage: '加载失败，请检查网络连接或稍后重试'
    });
  },

  retryLoad: function() {
    this.setData({
      loading: true,
      error: false
    });
    wx.redirectTo({
      url: '/pages/backend/backend'
    });
  },

  onLoad: function(options) {
    this.setData({
      loading: true,
      error: false
    });
  },

  onUnload: function() {
    
  }
});
