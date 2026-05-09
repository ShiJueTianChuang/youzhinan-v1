const { API_BASE_URL } = require('../../utils/constants.js');

Page({
  data: {
    statusBarHeight: 0,
    navBarHeight: 0,
    totalNavBarHeight: 0,
    expandedNavBarHeight: 0,
    currentTab: 0,
    messages: [],
    allMessages: [],
    showModal: false,
    selectedMessage: {},
    personalUnreadCount: 0,
    systemUnreadCount: 0,
    hasMessages: false
  },

  onLoad() {
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

    this.loadMessages();
  },

  goBack() {
    wx.navigateBack();
  },

  onShow() {
    this.loadMessages();
    this.notifyHomePage();
  },

  switchTab(e) {
    const index = parseInt(e.currentTarget.dataset.index);
    this.setData({ currentTab: index });
    this.filterMessages();
  },

  loadMessages() {
    const userInfo = wx.getStorageSync('userInfo');
    
    if (!userInfo || (!userInfo.id && !userInfo.openid && !userInfo.username)) {
      wx.showModal({
        title: '提示',
        content: '查看站内信需要先登录，是否前往登录？',
        confirmText: '去登录',
        cancelText: '返回',
        success: (res) => {
          if (res.confirm) {
            wx.switchTab({
              url: '/pages/mine/mine'
            });
          } else {
            wx.navigateBack();
          }
        }
      });
      return;
    }

    wx.showLoading({ title: '加载中...' });

    const requestData = {};
    if (userInfo.id) {
      requestData.user_id = userInfo.id;
    } else if (userInfo.openid) {
      requestData.openid = userInfo.openid;
    } else if (userInfo.username) {
      requestData.user_id = userInfo.username;
    }

    const that = this;
    wx.request({
      url: `${API_BASE_URL}/api/messages/user`,
      method: 'GET',
      data: requestData,
      success: (response) => {
        wx.hideLoading();

        if (response.statusCode === 200 && response.data.success) {
          const messages = response.data.data ? response.data.data.map(msg => ({
            ...msg,
            created_at: that.formatDate(msg.created_at),
            is_read: msg.is_read == 1 || msg.is_read === true
          })) : [];

          that.setData({
            allMessages: messages,
            messages: messages
          }, () => {
            that.filterMessages();
            that.calculateUnreadCounts();
          });
        } else {
          wx.showToast({
            title: '加载消息失败',
            icon: 'none'
          });
        }
      },
      fail: (error) => {
        wx.hideLoading();
        wx.showToast({
          title: '网络错误',
          icon: 'none'
        });
      }
    });
  },

  filterMessages() {
    const { currentTab, allMessages } = this.data;
    
    let filteredMessages = [];

    if (currentTab === 0) {
      filteredMessages = allMessages.filter(msg => msg.type === 'broadcast' || msg.type === 'system');
    } else if (currentTab === 1) {
      filteredMessages = allMessages.filter(msg => msg.type === 'personal' || msg.type === 'user');
    }

    this.setData({
      messages: filteredMessages,
      hasMessages: filteredMessages.length > 0
    });
  },

  viewMessage(e) {
    const id = e.currentTarget.dataset.id;
    const isRead = e.currentTarget.dataset.read;
    const message = this.data.messages.find(msg => msg.id === id);

    if (!message) return;

    this.setData({
      selectedMessage: message,
      showModal: true
    });

    if (!isRead) {
      this.markAsRead(id);
    }
  },

  markAsRead(messageId) {
    const userInfo = wx.getStorageSync('userInfo');
    if (!userInfo || (!userInfo.id && !userInfo.openid && !userInfo.username)) return;

    const requestData = {};
    if (userInfo.id) {
      requestData.user_id = userInfo.id;
    } else if (userInfo.openid) {
      requestData.openid = userInfo.openid;
    } else if (userInfo.username) {
      requestData.user_id = userInfo.username;
    }

    const that = this;
    wx.request({
      url: `${API_BASE_URL}/api/messages/${messageId}/read`,
      method: 'POST',
      data: requestData,
      success: (res) => {
        const updatedMessages = that.data.allMessages.map(msg => {
          if (msg.id === messageId) {
            return { ...msg, is_read: true };
          }
          return msg;
        });

        that.setData({
          allMessages: updatedMessages
        }, () => {
          that.filterMessages();
          that.calculateUnreadCounts();
          that.notifyHomePage();
        });
      },
      fail: (error) => {}
    });
  },

  closeModal() {
    this.setData({
      showModal: false,
      selectedMessage: {}
    });
  },

  notifyHomePage() {
    try {
      const pages = getCurrentPages();
      for (let i = pages.length - 1; i >= 0; i--) {
        const page = pages[i];
        if (page.route && page.route.includes('home/home')) {
          if (typeof page.loadUnreadCount === 'function') {
            page.loadUnreadCount();
          }
          break;
        }
      }
    } catch (err) {}
  },

  onPullDownRefresh() {
    this.loadMessages();
    wx.stopPullDownRefresh();
  },

  calculateUnreadCounts() {
    const { allMessages } = this.data;
    
    const personalUnread = allMessages.filter(msg => {
      const isPersonal = msg.type === 'personal' || msg.type === 'user';
      const isUnread = isPersonal && !msg.is_read;
      return isUnread;
    }).length;
    
    const systemUnread = allMessages.filter(msg => {
      const isSystem = msg.type === 'broadcast' || msg.type === 'system';
      const isUnread = isSystem && !msg.is_read;
      return isUnread;
    }).length;
    
    this.setData({
      personalUnreadCount: personalUnread,
      systemUnreadCount: systemUnread
    });
  },

  formatDate(dateString) {
    const date = new Date(dateString);
    const now = new Date();
    const diff = now - date;

    const oneMinute = 60 * 1000;
    const oneHour = 60 * oneMinute;
    const oneDay = 24 * oneHour;
    const oneWeek = 7 * oneDay;

    if (diff < oneMinute) {
      return '刚刚';
    } else if (diff < oneHour) {
      return `${Math.floor(diff / oneMinute)}分钟前`;
    } else if (diff < oneDay) {
      return `${Math.floor(diff / oneHour)}小时前`;
    } else if (diff < oneWeek) {
      return `${Math.floor(diff / oneDay)}天前`;
    } else {
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      const hours = String(date.getHours()).padStart(2, '0');
      const minutes = String(date.getMinutes()).padStart(2, '0');
      return `${year}-${month}-${day} ${hours}:${minutes}`;
    }
  }
});
