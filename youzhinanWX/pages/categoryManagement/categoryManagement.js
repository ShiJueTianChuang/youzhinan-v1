const app = getApp()
const { API_BASE_URL } = require('../../utils/constants.js')

Page({
  data: {
    categories: [],
    loading: false,
    showEditModal: false,
    editCategoryName: '',
    editIndex: -1
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
  },

  goBack: function() {
    wx.navigateBack()
  },

  loadCategories: function() {
    this.setData({ loading: true })

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

  editCategory: function(e) {
    const category = e.currentTarget.dataset.category
    const index = e.currentTarget.dataset.index
    
    this.setData({
      showEditModal: true,
      editCategoryName: category,
      editIndex: index
    })
  },

  closeEditModal: function() {
    this.setData({ 
      showEditModal: false,
      editCategoryName: '',
      editIndex: -1
    })
  },

  preventEvent: function() {
  },

  onCategoryNameInput: function(e) {
    this.setData({ editCategoryName: e.detail.value })
  },

  confirmEdit: function() {
    const { editCategoryName, editIndex, categories } = this.data
    
    if (!editCategoryName || editCategoryName.trim() === '') {
      wx.showToast({
        title: '请输入分类名称',
        icon: 'none'
      })
      return
    }

    const oldCategory = categories[editIndex]
    
    wx.request({
      url: `${API_BASE_URL}/api/category/${oldCategory}`,
      method: 'PUT',
      data: {
        name: editCategoryName.trim()
      },
      success: (res) => {
        if (res.statusCode === 200 && res.data.success) {
          wx.showToast({
            title: '编辑成功',
            icon: 'success'
          })
          this.closeEditModal()
          this.loadCategories()
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

  deleteCategory: function(e) {
    const category = e.currentTarget.dataset.category
    
    wx.showModal({
      title: '删除分类',
      content: '确定要删除这个分类吗？',
      success: (res) => {
        if (res.confirm) {
          wx.request({
            url: `${API_BASE_URL}/api/category/${category}`,
            method: 'DELETE',
            success: (res) => {
              if (res.statusCode === 200 && res.data.success) {
                wx.showToast({
                  title: '删除成功',
                  icon: 'success'
                })
                this.loadCategories()
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
