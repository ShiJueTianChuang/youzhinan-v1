const app = getApp()
const { API_BASE_URL } = require('../../utils/constants.js')

Page({
  data: {
    infos: [],
    categories: [],
    searchKeyword: '',
    selectedCategory: '',
    loading: false,
    showEditModal: false,
    editInfoInfo: {},
    categoryIndex: 0
  },

  onLoad: function() {
    if (!app.globalData.userInfo || (!app.globalData.userInfo.is_admin && !app.globalData.userInfo.isAdmin)) {
      wx.showToast({
        title: '无权限访问',
        icon: 'none'
      })
      setTimeout(() => {
        wx.navigateBack()
      }, 1000)
      return
    }
    
    this.loadCategories()
    this.loadInfos()
  },

  goBack: function() {
    wx.navigateBack()
  },

  loadCategories: function() {
    wx.request({
      url: `${API_BASE_URL}/api/category`,
      method: 'GET',
      success: (res) => {
        if (res.statusCode === 200 && res.data.success) {
          this.setData({
            categories: res.data.data
          })
        }
      },
      fail: (err) => {}
    })
  },

  loadInfos: function() {
    this.setData({ loading: true })
    const { searchKeyword, selectedCategory } = this.data
    
    let url = `${API_BASE_URL}/api/info`
    const params = {}
    
    if (searchKeyword) {
      params.search = searchKeyword
    }
    if (selectedCategory) {
      params.category = selectedCategory
    }
    
    const queryString = Object.keys(params).map(key => `${key}=${encodeURIComponent(params[key])}`).join('&')
    if (queryString) {
      url += `?${queryString}`
    }
    
    wx.request({
      url: url,
      method: 'GET',
      success: (res) => {
        if (res.statusCode === 200 && res.data.success) {
          this.setData({
            infos: res.data.data
          })
        }
      },
      fail: (err) => {
        wx.showToast({
          title: '加载失败，请重试',
          icon: 'none'
        })
      },
      complete: () => {
        this.setData({ loading: false })
      }
    })
  },

  onSearchInput: function(e) {
    this.setData({ searchKeyword: e.detail.value })
  },

  onSearchConfirm: function() {
    this.loadInfos()
  },

  onCategorySelect: function(e) {
    const category = e.currentTarget.dataset.category
    this.setData({ selectedCategory: category })
    this.loadInfos()
  },

  editInfo: function(e) {
    const info = e.currentTarget.dataset.info
    const categoryIndex = this.data.categories.indexOf(info.category)
    
    this.setData({
      showEditModal: true,
      editInfoInfo: info,
      categoryIndex: categoryIndex >= 0 ? categoryIndex : 0
    })
  },

  closeEditModal: function() {
    this.setData({ showEditModal: false })
  },

  preventEvent: function() {
  },

  onStoreNameInput: function(e) {
    this.setData({ 'editInfoInfo.store_name': e.detail.value })
  },

  onContactInput: function(e) {
    this.setData({ 'editInfoInfo.contact': e.detail.value })
  },

  onCategoryChange: function(e) {
    const index = e.detail.value
    this.setData({
      categoryIndex: index,
      'editInfoInfo.category': this.data.categories[index]
    })
  },

  confirmEdit: function() {
    const { editInfoInfo } = this.data

    wx.request({
      url: `${API_BASE_URL}/api/info/${editInfoInfo.id}`,
      method: 'PUT',
      data: editInfoInfo,
      success: (res) => {
        if (res.statusCode === 200 && res.data.success) {
          wx.showToast({
            title: '编辑成功',
            icon: 'success'
          })
          this.closeEditModal()
          this.loadInfos()
        } else {
          wx.showToast({
            title: '编辑失败',
            icon: 'none'
          })
        }
      },
      fail: (err) => {
        wx.showToast({
          title: '网络错误，请重试',
          icon: 'none'
        })
      }
    })
  },

  deleteInfo: function(e) {
    const id = e.currentTarget.dataset.id
    
    wx.showModal({
      title: '删除信息',
      content: '确定要删除这条信息吗？',
      success: (res) => {
        if (res.confirm) {
          wx.request({
            url: `${API_BASE_URL}/api/info/${id}`,
            method: 'DELETE',
            success: (res) => {
              if (res.statusCode === 200 && res.data.success) {
                wx.showToast({
                  title: '删除成功',
                  icon: 'success'
                })
                this.loadInfos()
              } else {
                wx.showToast({
                  title: '删除失败',
                  icon: 'none'
                })
              }
            },
            fail: (err) => {
              wx.showToast({
                title: '网络错误，请重试',
                icon: 'none'
              })
            }
          })
        }
      }
    })
  }
})
