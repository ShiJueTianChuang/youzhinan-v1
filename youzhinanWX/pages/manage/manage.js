const { API_BASE_URL } = require('../../utils/constants.js');

Page({
  data: {
    formData: {
      store_name: '',
      category: '酒吧',
      province: '',
      city: '',
      district: '',
      address: '',
      contact: '',
      description: '',
      business_hours: '',
      price: '',
      latitude: '',
      longitude: '',
      rating: ''
    },
    
    uploadOption: 'upload',
    
    previewImage: '',
    
    showImageLibraryModal: false,
    
    imageLibrary: [
      '/images/商城.png',
      '/images/客服.png',
      '/images/关于我们.png',
      '/images/导航-01.png',
      '/images/导航-02.png'
    ],
    
    isEditing: false,
    editId: null,
    
    isFormValid: false,
    
    selectedLibraryImages: []
  },
  
  updateFormValidation: function() {
    const { formData } = this.data;
    const isValid = formData.store_name && formData.category && formData.province && formData.city && formData.district && formData.address;
    this.setData({ isFormValid: isValid });
  },

  onLoad: function(options) {
    if (options.id) {
      this.setData({
        isEditing: true,
        editId: options.id
      });
      this.loadEditData(options.id);
    }
  },

  loadEditData: function(id) {
    wx.showLoading({ title: '加载中...' });
    
    wx.request({
      url: `${API_BASE_URL}/api/info/${id}`,
      method: 'GET',
      success: (res) => {
        if (res.statusCode === 200 && res.data) {
          const item = res.data;
          let previewImage = '';
          if (item.images) {
            try {
              const images = typeof item.images === 'string' ? JSON.parse(item.images) : item.images;
              if (Array.isArray(images) && images.length > 0) {
                previewImage = images[0];
              }
            } catch (e) {}
          }
          
          this.setData({
            formData: {
              store_name: item.store_name || '',
              category: item.category || '酒吧',
              province: item.province || '',
              city: item.city || '',
              district: item.district || '',
              address: item.address || '',
              contact: item.contact || '',
              description: item.description || '',
              business_hours: item.business_hours || '',
              price: item.price || '',
              latitude: item.latitude || '',
              longitude: item.longitude || '',
              rating: item.rating || ''
            },
            previewImage: previewImage,
            selectedLibraryImages: item.images ? (typeof item.images === 'string' ? JSON.parse(item.images) : item.images) : []
          }, () => {
            this.updateFormValidation();
          });
        }
      },
      fail: (err) => {
        wx.showToast({ title: '加载失败', icon: 'none' });
      },
      complete: () => {
        wx.hideLoading();
      }
    });
  },

  handleOptionButtonClick: function(e) {
    const option = e.currentTarget.dataset.option;
    this.setData({
      uploadOption: option
    });
  },

  chooseLocalImage: function() {
    wx.chooseMedia({
      count: 1,
      mediaType: ['image'],
      sourceType: ['album', 'camera'],
      camera: 'back',
      success: (res) => {
        const tempFilePath = res.tempFiles[0].tempFilePath;
        
        this.setData({
          previewImage: tempFilePath,
          'formData.image_url': tempFilePath
        });
        
        this.uploadImage(tempFilePath);
      },
      fail: (err) => {}
    });
  },

  uploadImage: function(filePath) {
    wx.showLoading({ title: '上传中...' });
    
    wx.uploadFile({
      url: `${API_BASE_URL}/api/upload`,
      filePath: filePath,
      name: 'image',
      success: (uploadRes) => {
        try {
          const data = JSON.parse(uploadRes.data);
          if (data.success && data.imagePath) {
            this.setData({
              'formData.image_url': data.imagePath
            });
            wx.showToast({ title: '上传成功', icon: 'success' });
          }
        } catch (e) {
          wx.showToast({ title: '上传失败', icon: 'none' });
        }
      },
      fail: (err) => {
        wx.showToast({ title: '上传失败', icon: 'none' });
      },
      complete: () => {
        wx.hideLoading();
      }
    });
  },

  openImageLibraryModal: function() {
    this.setData({
      showImageLibraryModal: true
    });
  },

  closeImageLibraryModal: function() {
    this.setData({
      showImageLibraryModal: false
    });
  },

  selectLibraryImage: function(e) {
    const imageUrl = e.currentTarget.dataset.image;
    
    this.setData({
      previewImage: imageUrl,
      'formData.image_url': imageUrl,
      showImageLibraryModal: false
    });
  },

  preventEvent: function() {
  },

  onTypeSelect: function(e) {
    const category = e.currentTarget.dataset.type;
    this.setData({
      'formData.category': category
    });
    this.updateFormValidation();
  },

  onNameInput: function(e) {
    this.setData({
      'formData.store_name': e.detail.value
    });
    this.updateFormValidation();
  },

  onProvinceInput: function(e) {
    this.setData({
      'formData.province': e.detail.value
    });
    this.updateFormValidation();
  },

  onCityInput: function(e) {
    this.setData({
      'formData.city': e.detail.value
    });
    this.updateFormValidation();
  },

  onDistrictInput: function(e) {
    this.setData({
      'formData.district': e.detail.value
    });
    this.updateFormValidation();
  },

  onAddressInput: function(e) {
    this.setData({
      'formData.address': e.detail.value
    });
    this.updateFormValidation();
  },

  onContactInput: function(e) {
    this.setData({
      'formData.contact': e.detail.value
    });
  },

  onBusinessHoursInput: function(e) {
    this.setData({
      'formData.business_hours': e.detail.value
    });
  },

  onPriceInput: function(e) {
    this.setData({
      'formData.price': e.detail.value
    });
  },

  onLatitudeInput: function(e) {
    this.setData({
      'formData.latitude': e.detail.value
    });
  },

  onLongitudeInput: function(e) {
    this.setData({
      'formData.longitude': e.detail.value
    });
  },

  onRatingInput: function(e) {
    this.setData({
      'formData.rating': e.detail.value
    });
  },

  onDescriptionInput: function(e) {
    this.setData({
      'formData.description': e.detail.value
    });
  },

  submitForm: function() {
    if (!this.data.isFormValid) {
      wx.showToast({ title: '请填写完整信息', icon: 'none' });
      return;
    }

    wx.showLoading({ title: this.data.isEditing ? '更新中...' : '提交中...' });
    
    const formData = { ...this.data.formData };
    
    const submitData = {
      store_name: formData.store_name,
      category: formData.category,
      province: formData.province,
      city: formData.city,
      district: formData.district,
      address: formData.address,
      contact: formData.contact || '',
      description: formData.description,
      business_hours: formData.business_hours || '',
      price: formData.price || '',
      latitude: formData.latitude || '',
      longitude: formData.longitude || '',
      rating: formData.rating || ''
    };

    const url = `${API_BASE_URL}/api/info`;
    const method = this.data.isEditing ? 'PUT' : 'POST';
    const requestUrl = this.data.isEditing ? `${url}/${this.data.editId}` : url;

    const hasLocalImage = this.data.previewImage && this.data.previewImage.startsWith('wxfile://');

    if (hasLocalImage) {
      wx.uploadFile({
        url: requestUrl,
        filePath: this.data.previewImage,
        name: 'images',
        formData: submitData,
        success: (res) => {
          try {
            const response = JSON.parse(res.data);
            if (response.id || response.message) {
              wx.showToast({
                title: this.data.isEditing ? '更新成功' : '提交成功',
                icon: 'success',
                duration: 2000
              });
              
              setTimeout(() => {
                wx.navigateBack();
              }, 1500);
            } else {
              wx.showToast({ title: '提交失败', icon: 'none' });
            }
          } catch (error) {
            wx.showToast({ title: '提交失败', icon: 'none' });
          }
        },
        fail: (err) => {
          wx.showToast({ title: '提交失败', icon: 'none' });
        },
        complete: () => {
          wx.hideLoading();
        }
      });
    } else {
      wx.request({
        url: requestUrl,
        method: method,
        data: submitData,
        success: (res) => {
          if (res.statusCode === 200) {
            wx.showToast({
              title: this.data.isEditing ? '更新成功' : '提交成功',
              icon: 'success',
              duration: 2000
            });
            
            setTimeout(() => {
              wx.navigateBack();
            }, 1500);
          } else {
            wx.showToast({ title: '提交失败', icon: 'none' });
          }
        },
        fail: (err) => {
          wx.showToast({ title: '提交失败', icon: 'none' });
        },
        complete: () => {
          wx.hideLoading();
        }
      });
    }
  },

  goBack: function() {
    wx.navigateBack();
  }
});
