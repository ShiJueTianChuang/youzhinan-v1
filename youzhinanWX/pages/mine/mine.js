/**
 * 个人资料弹窗（登录 / 改资料）：头像预览走 syncAvatarDisplaySrcs → modalAvatarSrc；
 * tempAvatar 保存选用/上传地址；modalLocalPreview 一般留空，头像用 HTTPS 直链在 <image> 中展示（与 wx.downloadFile 共用合法域名，需在后台配置 thirdwx.qlogo.cn 等）。
 */
const app = getApp()
const { API_BASE_URL, getAppid } = require('../../utils/constants.js')
const { shareCardImageUrl } = require('../../utils/commonUtils')

function urlHostname(u) {
  if (!u || !/^https?:\/\//.test(u)) return ''
  try {
    return new URL(u).hostname
  } catch (e) {
    return ''
  }
}

/** 与 API_BASE_URL 同站（含 www / 非 www 互认），用于缓存破坏与上传分支 */
function isOurServerHttpsAvatarUrl(url) {
  if (!url || !/^https?:\/\//.test(url)) return false
  try {
    const base = API_BASE_URL.indexOf('//') >= 0 ? API_BASE_URL : 'https://' + API_BASE_URL
    const apiHost = new URL(base).hostname
    const h = urlHostname(url)
    if (!h || !apiHost) return false
    if (h === apiHost) return true
    const strip = function (x) {
      return x.replace(/^www\./i, '')
    }
    return strip(h) === strip(apiHost)
  } catch (e) {
    return false
  }
}

/**
 * 个人资料弹窗里头像预览用的地址（仅此一处规则，避免与别处混算）
 * - 本地/wxfile：原样
 * - 自家 https：加时间戳防缓存（重试时 avatarRetryKey 会变）
 * - 其它 https（含微信 CDN）：原样
 */
function hrefForProfileModal(url, avatarRetryKey) {
  if (!url) return ''
  if (!/^https?:\/\//.test(url)) return url
  if (isOurServerHttpsAvatarUrl(url) && avatarRetryKey) {
    const sep = url.indexOf('?') >= 0 ? '&' : '?'
    return url + sep + '_t=' + avatarRetryKey
  }
  return url
}

Page({
  onShow: function() {
    setTimeout(() => {
      try {
        if (typeof this.getTabBar === 'function') {
          const tabBar = this.getTabBar();
          if (tabBar && typeof tabBar.setData === 'function') {
            tabBar.setData({
              selected: 2
            });
          }
        }
      } catch (error) {}
    }, 100)
  },

  data: {
    userInfo: null,
    userAvatar: '',
    userNickname: '请登录',
    statusBarHeight: 0,
    customNavHeight: 0,
    tempNickname: '',
    tempAvatar: '',
    showNicknameModal: false,
    modalTitle: '个人资料',
    modalHint: '',
    isEditingNickname: false,
    showNicknameHint: false,
    nicknameFocus: false,
    wechatUserInfo: null,
    headerAvatarSrc: '',
    modalAvatarSrc: '',
    /** 弹窗优先展示的本地预览路径（可选）；默认用 tempAvatar 的 https/wxfile */
    modalLocalPreview: '',
    avatarRetryKey: 0,
    remoteAvatarLoadFailed: false,
    modalAvatarLoadFailed: false
  },

  onReady: function() {
    
  },

  onLoad: function () {
    const systemInfo = wx.getSystemInfoSync();
    const statusBarHeight = systemInfo.statusBarHeight || 0;
    const customNavHeight = statusBarHeight + 44;

    this.setData({
      statusBarHeight: statusBarHeight,
      customNavHeight: customNavHeight
    });

    if (app.globalData.userInfo && app.globalData.userInfo.avatarUrl && app.globalData.userInfo.nickName) {
      this.setData({
        userInfo: app.globalData.userInfo,
        userAvatar: app.globalData.userInfo.avatarUrl,
        userNickname: app.globalData.userInfo.nickName
      }, function() {
        if (this.data.userNickname === '微信用户') {
          this.setData({
            userNickname: '请登录',
            showNicknameHint: true
          })
        }
        this.syncAvatarDisplaySrcs()
      }.bind(this))
    } else {
      try {
        const storedUserInfo = wx.getStorageSync('userInfo')
        if (storedUserInfo && storedUserInfo.avatarUrl && storedUserInfo.nickName) {
          app.globalData.userInfo = storedUserInfo
          this.setData({
            userInfo: storedUserInfo,
            userAvatar: storedUserInfo.avatarUrl,
            userNickname: storedUserInfo.nickName
          }, function() {
            if (this.data.userNickname === '微信用户') {
              this.setData({
                userNickname: '请登录',
                showNicknameHint: true
              })
            }
            this.syncAvatarDisplaySrcs()
          }.bind(this))
        }
      } catch (storageError) {}
    }
  },

  /**
   * 顶部头像：始终用 userInfo.avatarUrl + 重试时间戳
   * 个人资料弹窗：仅当 showNicknameModal 时写 modalAvatarSrc，规则见下（唯一入口）
   */
  syncAvatarDisplaySrcs: function () {
    const { userInfo, avatarRetryKey, showNicknameModal, tempAvatar, modalLocalPreview } = this.data
    const withBust = function (url) {
      if (!url) return ''
      if (!/^https?:\/\//.test(url)) return url
      if (!avatarRetryKey) return url
      const sep = url.indexOf('?') >= 0 ? '&' : '?'
      return url + sep + '_t=' + avatarRetryKey
    }
    const u = userInfo && userInfo.avatarUrl
    const patch = { headerAvatarSrc: u ? withBust(u) : '' }
    if (showNicknameModal) {
      let modalSrc = ''
      if (modalLocalPreview) {
        modalSrc = modalLocalPreview
      } else if (tempAvatar) {
        modalSrc = hrefForProfileModal(tempAvatar, avatarRetryKey)
      } else if (u) {
        modalSrc = hrefForProfileModal(u, avatarRetryKey)
      }
      patch.modalAvatarSrc = modalSrc
    }
    this.setData(patch)
  },

  retryRemoteAvatar: function (e) {
    if (e && e.stopPropagation) e.stopPropagation()
    const from = e && e.currentTarget && e.currentTarget.dataset ? e.currentTarget.dataset.from : ''
    const patch = {
      avatarRetryKey: Date.now(),
      remoteAvatarLoadFailed: false,
      modalAvatarLoadFailed: false
    }
    if (!this.data.showNicknameModal) {
      patch.modalLocalPreview = ''
    } else if (from === 'modal') {
      patch.modalLocalPreview = ''
    }
    this.setData(patch, () => this.syncAvatarDisplaySrcs())
  },

  onHeaderAvatarLoad: function () {
    this.setData({ remoteAvatarLoadFailed: false })
  },

  onHeaderAvatarError: function () {
    const u = this.data.userInfo && this.data.userInfo.avatarUrl
    if (u && /^https?:\/\//.test(u)) {
      this.setData({ remoteAvatarLoadFailed: true })
    }
  },

  onModalAvatarLoad: function () {
    this.setData({ modalAvatarLoadFailed: false })
  },

  onModalAvatarError: function () {
    const base = this.data.tempAvatar || (this.data.userInfo && this.data.userInfo.avatarUrl)
    if (base && isOurServerHttpsAvatarUrl(base)) {
      this.setData({ modalAvatarLoadFailed: true })
      return
    }
    if (
      !this.data.showNicknameModal ||
      !base ||
      !/^https?:\/\//.test(base) ||
      isOurServerHttpsAvatarUrl(base)
    ) {
      return
    }
    this.setData({ modalAvatarLoadFailed: true })
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

  viewFavorites: function () {
    wx.navigateTo({
      url: '/pages/favorites/favorites'
    })
  },

  viewAbout: function () {
    wx.navigateTo({
      url: '/pages/about/about'
    })
  },

  onNicknameInput: function(e) {
    this.setData({ tempNickname: e.detail.value });
  },

  onNicknameBlur: function(e) {
    if (e.detail.value) {
      this.setData({ 
        tempNickname: e.detail.value,
        nicknameFocus: false
      });
    } else {
      this.setData({ nicknameFocus: false });
    }
  },

  focusNickname: function() {
    this.setData({ nicknameFocus: true });
  },

  handleLogin: function() {
    const isEdit = !!this.data.userInfo;
    
    if (!isEdit) {
      wx.getUserProfile({
        desc: '用于完善会员资料',
        lang: 'zh_CN',
        success: (profileRes) => {
          const userInfo = profileRes.userInfo;
          const nickname = userInfo.nickName;
          const avatarUrl = userInfo.avatarUrl || '/images/客服.png';
          
          if (nickname === '微信用户') {
            const ta = avatarUrl
            this.setData(
              {
                showNicknameModal: true,
                modalTitle: '个人资料',
                modalHint: '微信返回的默认昵称不能使用，请输入您的真实昵称',
                isEditingNickname: false,
                tempAvatar: ta,
                modalLocalPreview: '',
                tempNickname: '',
                wechatUserInfo: userInfo,
                remoteAvatarLoadFailed: false,
                modalAvatarLoadFailed: false
              },
              () => this.syncAvatarDisplaySrcs()
            )
          } else {
            this.doLogin(nickname, avatarUrl);
          }
        },
        fail: (err) => {
          wx.showToast({ title: '获取用户信息失败', icon: 'none' });
        }
      });
    } else {
      const ui = this.data.userInfo
      const ta = ui && ui.avatarUrl
      this.setData(
        {
          showNicknameModal: true,
          modalTitle: '个人资料',
          isEditingNickname: true,
          tempAvatar: ta,
          modalLocalPreview: '',
          tempNickname: ui.nickName,
          remoteAvatarLoadFailed: false,
          modalAvatarLoadFailed: false
        },
        () => this.syncAvatarDisplaySrcs()
      )
    }
  },
  
  doLogin: function(nickname, avatarUrl) {
    wx.showLoading({ title: '登录中...', mask: true });
    
    this.uploadAvatarIfNeeded(avatarUrl, (permanentAvatarUrl) => {
      wx.login({
        success: (loginRes) => {
          if (loginRes.code) {
            const loginData = {
              code: loginRes.code,
              nickName: nickname,
              avatarUrl: permanentAvatarUrl,
              nickname: nickname,
              avatar: permanentAvatarUrl,
              headimgurl: permanentAvatarUrl,
              js_code: loginRes.code,
              appid: getAppid()
            };
            
            wx.request({
              url: `${API_BASE_URL}/api/wxlogin/login`,
              method: 'POST',
              header: {
                'content-type': 'application/json'
              },
              data: loginData,
              timeout: 10000,
              success: (res) => {
                if (res.statusCode === 200) {
                  let userAvatar = permanentAvatarUrl;
                  
                  if (res.data.data && res.data.data.userInfo) {
                    if (res.data.data.userInfo.avatarUrl) {
                      userAvatar = res.data.data.userInfo.avatarUrl;
                    } else if (res.data.data.userInfo.avatar) {
                      userAvatar = res.data.data.userInfo.avatar;
                    }
                  }
                  
                  let token = null;
                  if (res.data && res.data.token) {
                    token = res.data.token;
                  } else if (res.data && res.data.data && res.data.data.token) {
                    token = res.data.data.token;
                  } else if (res.data && res.data.data && res.data.data.accessToken) {
                    token = res.data.data.accessToken;
                  } else if (res.data && res.data.accessToken) {
                    token = res.data.accessToken;
                  }
                  
                  if (token) {
                    wx.setStorageSync('token', token);
                  }
                  
                  let openid = null;
                  if (res.data && res.data.openid) {
                    openid = res.data.openid;
                  } else if (res.data && res.data.data && res.data.data.openid) {
                    openid = res.data.data.openid;
                  } else if (res.data.data.userInfo && res.data.data.userInfo.openid) {
                    openid = res.data.data.userInfo.openid;
                  }
                  if (openid) {
                    wx.setStorageSync('openid', openid);
                  }
                  
                  const userData = {
                    id: res.data.data.userInfo.id || res.data.data.userInfo.user_id || '',
                    openid: openid || res.data.data.userInfo.openid || '',
                    avatarUrl: userAvatar,
                    nickName: nickname || '',
                    username: res.data.data.userInfo.username || '',
                    is_admin: res.data.data.userInfo.is_admin || false,
                    isAdmin: res.data.data.userInfo.isAdmin || false
                  };
                  
                  this.setData({
                    userInfo: userData,
                    userAvatar: userData.avatarUrl,
                    userNickname: userData.nickName
                  }, () => this.syncAvatarDisplaySrcs());

                  app.globalData.userInfo = userData;
                  wx.setStorageSync('userInfo', userData);

                  wx.showToast({ title: '登录成功', icon: 'success' });
                } else {
                  wx.showToast({ title: '登录失败，请重试', icon: 'none' });
                }
              },
              fail: (err) => {
                wx.showToast({ title: '网络错误，请检查网络连接', icon: 'none' });
              },
              complete: () => {
                wx.hideLoading();
              }
            });
          } else {
            wx.hideLoading();
            wx.showToast({ title: '登录失败，请重试', icon: 'none' });
          }
        },
        fail: (err) => {
          wx.hideLoading();
          wx.showToast({ title: '登录失败，请重试', icon: 'none' });
        }
      });
    });
  },
  
  uploadAvatarIfNeeded: function(avatarUrl, callback) {
    if (avatarUrl && isOurServerHttpsAvatarUrl(avatarUrl)) {
      callback(avatarUrl);
      return;
    }
    
    if (avatarUrl && avatarUrl.startsWith('http')) {
      const uploadUrls = [
        `${API_BASE_URL}/api/upload`,
        `${API_BASE_URL}/upload`,
        `${API_BASE_URL}/api/wxlogin/upload`
      ];
      
      let currentUrlIndex = 0;
      
      const tryUpload = () => {
        if (currentUrlIndex >= uploadUrls.length) {
          callback(avatarUrl);
          return;
        }
        
        const uploadUrl = uploadUrls[currentUrlIndex];
        
        wx.uploadFile({
          url: uploadUrl,
          filePath: avatarUrl,
          name: 'image',
          header: {
            'Content-Type': 'multipart/form-data'
          },
          success: (res) => {
            try {
              const data = JSON.parse(res.data);
              
              if (data.success && data.imagePath) {
                const permanentUrl = data.imagePath.startsWith('http') ? data.imagePath : `${API_BASE_URL}/${data.imagePath.startsWith('/') ? data.imagePath.substring(1) : data.imagePath}`;
                callback(permanentUrl);
              } else if (data.data && data.data.imagePath) {
                const permanentUrl = data.data.imagePath.startsWith('http') ? data.data.imagePath : `${API_BASE_URL}/${data.data.imagePath.startsWith('/') ? data.data.imagePath.substring(1) : data.data.imagePath}`;
                callback(permanentUrl);
              } else {
                throw new Error('上传失败，响应格式不正确');
              }
            } catch (err) {
              currentUrlIndex++;
              tryUpload();
            }
          },
          fail: (err) => {
            currentUrlIndex++;
            tryUpload();
          }
        });
      };
      
      tryUpload();
    } else {
      callback(avatarUrl || '/images/客服.png');
    }
  },

  onChooseAvatar: function(e) {
    const avatarUrl = e.detail.avatarUrl;
    this.setData({
      tempAvatar: avatarUrl,
      modalLocalPreview: '',
      modalAvatarLoadFailed: false
    }, () => this.syncAvatarDisplaySrcs());
    wx.showLoading({ title: '上传头像...', mask: true });

    const uploadUrls = [
      `${API_BASE_URL}/api/upload`,
      `${API_BASE_URL}/upload`,
      `${API_BASE_URL}/api/wxlogin/upload`
    ];
    
    let currentUrlIndex = 0;
    
    const tryUpload = () => {
      if (currentUrlIndex >= uploadUrls.length) {
        wx.hideLoading();
        this.setData({
          tempAvatar: avatarUrl,
          modalLocalPreview: ''
        }, () => this.syncAvatarDisplaySrcs());
        wx.showToast({ title: '上传失败,使用临时头像', icon: 'none' });
        return;
      }
      
      const uploadUrl = uploadUrls[currentUrlIndex];
      
      wx.uploadFile({
        url: uploadUrl,
        filePath: avatarUrl,
        name: 'image',
        header: {
          'Content-Type': 'multipart/form-data'
        },
        success: (res) => {
          wx.hideLoading();
          try {
            const data = JSON.parse(res.data);
            
            if (data.success && data.imagePath) {
              const permanentUrl = data.imagePath.startsWith('http') ? data.imagePath : `${API_BASE_URL}/${data.imagePath.startsWith('/') ? data.imagePath.substring(1) : data.imagePath}`;
              this.setData({
                tempAvatar: permanentUrl,
                modalLocalPreview: '',
                modalAvatarLoadFailed: false
              }, () => this.syncAvatarDisplaySrcs())
              wx.showToast({ title: '头像上传成功', icon: 'success' });
            } else if (data.data && data.data.imagePath) {
              const permanentUrl = data.data.imagePath.startsWith('http') ? data.data.imagePath : `${API_BASE_URL}/${data.data.imagePath.startsWith('/') ? data.data.imagePath.substring(1) : data.data.imagePath}`;
              this.setData({
                tempAvatar: permanentUrl,
                modalLocalPreview: '',
                modalAvatarLoadFailed: false
              }, () => this.syncAvatarDisplaySrcs())
              wx.showToast({ title: '头像上传成功', icon: 'success' });
            } else {
              throw new Error('上传失败，响应格式不正确');
            }
          } catch (err) {
            currentUrlIndex++;
            tryUpload();
          }
        },
        fail: (err) => {
          currentUrlIndex++;
          tryUpload();
        }
      });
    };
    
    tryUpload();
  },

  confirmNickname: function() {
    const { tempAvatar, tempNickname, userInfo, isEditingNickname, wechatUserInfo } = this.data;

    if (!tempNickname || tempNickname.trim() === '') {
      wx.showToast({ title: '请输入昵称', icon: 'none' });
      return;
    }

    let nickname = tempNickname.trim();
    let avatarUrl = tempAvatar || (userInfo ? userInfo.avatarUrl : '/images/客服.png');

    if (nickname === '微信用户') {
      wx.showToast({ title: '请输入真实昵称，不要使用默认值', icon: 'none' });
      return;
    }

    if (!avatarUrl) {
      avatarUrl = '/images/客服.png';
    }

    const userData = {
      id: userInfo ? userInfo.id : '',
      avatarUrl: avatarUrl,
      nickName: nickname,
      username: userInfo ? userInfo.username : '',
      is_admin: userInfo ? userInfo.is_admin : false,
      isAdmin: userInfo ? userInfo.isAdmin : false
    };

    wx.showLoading({ title: isEditingNickname ? '保存中...' : '登录中...', mask: true });

    this.setData({
      userInfo: userData,
      userAvatar: userData.avatarUrl,
      userNickname: userData.nickName,
      showNicknameModal: false,
      tempAvatar: '',
      tempNickname: '',
      isEditingNickname: false,
      wechatUserInfo: null,
      modalLocalPreview: '',
      remoteAvatarLoadFailed: false,
      modalAvatarLoadFailed: false
    }, () => this.syncAvatarDisplaySrcs());

    app.globalData.userInfo = userData;
    wx.setStorageSync('userInfo', userData);

    wx.login({
      success: (loginRes) => {
        if (loginRes.code) {
          wx.request({
            url: `${API_BASE_URL}/api/wxlogin/test`,
            method: 'GET',
            success: (testRes) => {
              wx.request({
                url: `${API_BASE_URL}/api/wxlogin/login`,
                method: 'POST',
                header: {
                  'content-type': 'application/json'
                },
                data: {
                  code: loginRes.code,
                  nickName: userData.nickName,
                  avatarUrl: userData.avatarUrl,
                  nickname: userData.nickName,
                  js_code: loginRes.code,
                  appid: getAppid()
                },
                timeout: 10000,
                success: (res) => {
                  wx.hideLoading();
                  if (res.statusCode === 200) {
                    let token = null;
                    if (res.data && res.data.token) {
                      token = res.data.token;
                    } else if (res.data && res.data.data && res.data.data.token) {
                      token = res.data.data.token;
                    } else if (res.data && res.data.data && res.data.data.accessToken) {
                      token = res.data.data.accessToken;
                    } else if (res.data && res.data.accessToken) {
                      token = res.data.accessToken;
                    }
                    
                    if (token) {
                      wx.setStorageSync('token', token);
                    }
                    
                    let openid = null;
                    if (res.data && res.data.openid) {
                      openid = res.data.openid;
                    } else if (res.data && res.data.data && res.data.data.openid) {
                      openid = res.data.data.openid;
                    } else if (res.data.data.userInfo && res.data.data.userInfo.openid) {
                      openid = res.data.data.userInfo.openid;
                    }
                    if (openid) {
                      wx.setStorageSync('openid', openid);
                    }
                    
                    if (res.data.data && res.data.data.userInfo) {
                      const updatedUserData = {
                        ...userData,
                        openid: openid || res.data.data.userInfo.openid || userData.openid || '',
                        username: res.data.data.userInfo.username || userData.username,
                        is_admin: res.data.data.userInfo.is_admin || false,
                        isAdmin: res.data.data.userInfo.isAdmin || false
                      };
                      this.setData({ userInfo: updatedUserData }, () => this.syncAvatarDisplaySrcs());
                      app.globalData.userInfo = updatedUserData;
                      wx.setStorageSync('userInfo', updatedUserData);
                    }
                    wx.showToast({ 
                      title: isEditingNickname ? '资料设置成功' : '登录成功', 
                      icon: 'success' 
                    });
                  } else {
                    wx.showToast({ 
                      title: isEditingNickname ? '资料设置失败' : '登录失败', 
                      icon: 'none' 
                    });
                  }
                },
                fail: (err) => {
                  wx.hideLoading();
                  wx.showToast({ 
                    title: '网络错误，请检查网络连接', 
                    icon: 'none' 
                  });
                }
              });
            },
            fail: (testErr) => {
              wx.hideLoading();
              wx.showToast({ 
                title: '网络错误，请检查网络连接', 
                icon: 'none' 
              });
            }
          });
        } else {
          wx.hideLoading();
          wx.showToast({ 
            title: isEditingNickname ? '资料设置失败' : '登录失败', 
            icon: 'none' 
          });
        }
      },
      fail: (err) => {
        wx.hideLoading();
        wx.showToast({ 
          title: isEditingNickname ? '资料设置失败' : '登录失败', 
          icon: 'none' 
        });
      }
    });
  },

  cancelNickname: function() {
    this.setData({
      showNicknameModal: false,
      tempAvatar: '',
      tempNickname: '',
      isEditingNickname: false,
      wechatUserInfo: null,
      modalLocalPreview: '',
      modalAvatarLoadFailed: false
    }, () => this.syncAvatarDisplaySrcs());
  },

  handleLogout: function() {
    wx.showModal({
      title: '退出登录',
      content: '确定要退出登录吗？',
      success: (res) => {
        if (res.confirm) {
          this.setData({
            userInfo: null,
            userAvatar: '',
            userNickname: '请登录',
            showNicknameModal: false,
            headerAvatarSrc: '',
            modalAvatarSrc: '',
            modalLocalPreview: '',
            avatarRetryKey: 0,
            remoteAvatarLoadFailed: false,
            modalAvatarLoadFailed: false
          });
          app.globalData.userInfo = null;
          wx.removeStorageSync('userInfo');
          wx.showToast({ title: '已退出登录', icon: 'success' });
        }
      }
    });
  },

  onShareAppMessage: function() {
    const title = '彩虹助手2026';
    const path = '/pages/mine/mine';
    const fallback = shareCardImageUrl('');
    return {
      title: title,
      path: path,
      imageUrl: fallback
    };
  },

  onShareTimeline: function() {
    const title = '彩虹助手2026';
    const query = '';
    const fallback = shareCardImageUrl('');
    return {
      title: title,
      query: query,
      imageUrl: fallback
    };
  }
})
