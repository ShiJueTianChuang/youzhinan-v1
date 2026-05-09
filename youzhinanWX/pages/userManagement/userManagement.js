const { API_BASE_URL } = require('../../utils/constants.js');

Page({
  data: {
    users: [],
    searchKeyword: '',
    loading: false,
    showEditModal: false,
    editUserInfo: {}
  },

  goBack: function() {
    wx.navigateBack();
  },

  loadUsers: function() {
    this.setData({ loading: true });
    
    wx.request({
      url: `${API_BASE_URL}/api/user`,
      method: 'GET',
      success: (res) => {
        if (res.statusCode === 200) {
          this.setData({ users: res.data });
        } else {
          wx.showToast({ title: '加载失败', icon: 'none' });
        }
      },
      fail: (err) => {
        wx.showToast({ title: '网络错误', icon: 'none' });
      },
      complete: () => {
        this.setData({ loading: false });
      }
    });
  },

  onSearchConfirm: function() {
    const keyword = this.data.searchKeyword;
    if (!keyword) {
      this.loadUsers();
      return;
    }

    this.setData({ loading: true });
    
    wx.request({
      url: `${API_BASE_URL}/api/user/search`,
      method: 'GET',
      data: { keyword: keyword },
      success: (res) => {
        if (res.statusCode === 200) {
          this.setData({ users: res.data });
        } else {
          wx.showToast({ title: '搜索失败', icon: 'none' });
        }
      },
      fail: (err) => {
        wx.showToast({ title: '网络错误', icon: 'none' });
      },
      complete: () => {
        this.setData({ loading: false });
      }
    });
  },

  onSearchInput: function(e) {
    this.setData({ searchKeyword: e.detail.value });
  },

  editUser: function(e) {
    const user = e.currentTarget.dataset.user;
    this.setData({
      editUserInfo: { ...user },
      showEditModal: true
    });
  },

  closeEditModal: function() {
    this.setData({ showEditModal: false, editUserInfo: {} });
  },

  preventEvent: function() {
  },

  onNickNameInput: function(e) {
    this.setData({ 'editUserInfo.nick_name': e.detail.value });
  },

  onUserNameInput: function(e) {
    this.setData({ 'editUserInfo.username': e.detail.value });
  },

  onAdminChange: function(e) {
    this.setData({ 'editUserInfo.is_admin': e.detail.value });
  },

  confirmEdit: function() {
    const userInfo = this.data.editUserInfo;
    
    wx.request({
      url: `${API_BASE_URL}/api/user/${userInfo.id}`,
      method: 'PUT',
      data: userInfo,
      success: (res) => {
        if (res.statusCode === 200) {
          wx.showToast({ title: '编辑成功', icon: 'success' });
          this.closeEditModal();
          this.loadUsers();
        } else {
          wx.showToast({ title: '编辑失败', icon: 'none' });
        }
      },
      fail: (err) => {
        wx.showToast({ title: '网络错误', icon: 'none' });
      }
    });
  },

  deleteUser: function(e) {
    const userId = e.currentTarget.dataset.id;
    
    wx.showModal({
      title: '删除用户',
      content: '确定要删除这个用户吗？',
      success: (res) => {
        if (res.confirm) {
          wx.request({
            url: `${API_BASE_URL}/api/user/${userId}`,
            method: 'DELETE',
            success: (res) => {
              if (res.statusCode === 200) {
                wx.showToast({ title: '删除成功', icon: 'success' });
                this.loadUsers();
              } else {
                wx.showToast({ title: '删除失败', icon: 'none' });
              }
            },
            fail: (err) => {
              wx.showToast({ title: '网络错误', icon: 'none' });
            }
          });
        }
      }
    });
  },

  onLoad: function(options) {
    const app = getApp();
    if (!app.globalData.userInfo || !app.globalData.userInfo.is_admin) {
      wx.showToast({ title: '无权限访问', icon: 'none' });
      setTimeout(() => {
        wx.navigateBack();
      }, 1500);
      return;
    }
    
    this.loadUsers();
  }
});
