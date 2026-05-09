//app.js
const { API_BASE_URL } = require('./utils/constants.js');

App({
  globalData: {
    userInfo: null,
    isLogging: false
  },
  onLaunch() {
    // 尝试从本地存储恢复用户信息（不依赖后端）
    try {
      const storedUserInfo = wx.getStorageSync('userInfo')
      if (storedUserInfo && storedUserInfo.avatarUrl && storedUserInfo.nickName) {
        this.globalData.userInfo = storedUserInfo
      }
      // 无本地 userInfo 时属首次打开或未登录，不打印日志以免与报错混淆
    } catch (error) {
      console.error('从本地存储恢复用户信息失败:', error)
    }

    // 应用启动时测试服务器连接
    this.testServerConnection().then(result => {
      if (result.success) {
        console.log('✅ 后端服务器连接正常');
      } else {
        console.warn(`❌ 后端服务器连接失败: ${result.error}`);
        console.warn('💡 请确保:');
        console.warn(`   1. 后端服务器运行在 ${API_BASE_URL}`);
        console.warn('   2. 您的设备可以访问该IP地址');
        console.warn('   3. 服务器防火墙允许3004端口');
      }
    });
  },

  // 微信登录
  wechatLogin: function() {
    console.log('=== 开始微信登录流程 ===');
    return new Promise((resolve, reject) => {
      try {
        if (this.globalData.isLogging) {
          console.log('正在登录中，跳过');
          return resolve({ success: false, message: '正在登录中' })
        }
        this.globalData.isLogging = true
        
        // 1. 获取登录 code
        wx.login({
          success: (loginRes) => {
            if (loginRes.code) {
              console.log('微信登录 code 获取成功:', loginRes.code)
              // 将 code 发送到后端
              this.sendCodeToBackend(loginRes.code)
                .then(res => {
                  console.log('=== 微信登录完成 ===');
                  this.globalData.isLogging = false
                  resolve(res)
                })
                .catch(err => {
                  console.error('sendCodeToBackend 失败:', err);
                  this.globalData.isLogging = false
                  reject(err)
                })
            } else {
              console.error('获取登录 code 失败:', loginRes.errMsg)
              this.globalData.isLogging = false
              reject(new Error(loginRes.errMsg))
            }
          },
          fail: (err) => {
            console.error('wx.login 调用失败:', err)
            this.globalData.isLogging = false
            reject(err)
          }
        })
      } catch (outerError) {
        console.error('wechatLogin 函数执行错误:', outerError)
        this.globalData.isLogging = false
        reject(outerError)
      }
    })
  },

  // 发送code到后端
  sendCodeToBackend: function(code) {
    let appId = '';
    try {
      const accountInfo = wx.getAccountInfoSync();
      appId = accountInfo.miniProgram.appId;
    } catch (e) {
      console.error('获取appId失败:', e);
    }
    
    // 如果获取不到appId（某些开发环境下可能出现），请在 project.config.json 中配置
    if (!appId) {
      appId = '';
      console.warn('无法动态获取 appId，请在 project.config.json 中配置');
    }

    // 获取用户信息（如果已保存）
    let userInfo = null;
    try {
      userInfo = wx.getStorageSync('userInfo');
      console.log('从本地存储获取用户信息:', userInfo);
    } catch (e) {
      console.error('获取本地用户信息失败:', e);
    }

    console.log('=== 登录请求参数校验 ===');
    console.log('AppID:', appId);
    console.log('Code:', code);
    console.log('用户信息:', userInfo);
    console.log('=======================');
    
    // 构建请求数据
    const requestData = {
      code: code,
      js_code: code,
      appid: appId,
      appId: appId,
      grant_type: 'authorization_code'
    };
    
    // 如果有用户信息，添加到请求数据中
    if (userInfo) {
      if (userInfo.avatarUrl) {
        requestData.avatarUrl = userInfo.avatarUrl;
      }
      if (userInfo.nickName) {
        requestData.nickName = userInfo.nickName;
      }
    }
    
    return new Promise((resolve, reject) => {
      wx.request({
        url: `${API_BASE_URL}/api/wxlogin/login?appid=${appId}&appId=${appId}&js_code=${code}`, 
        method: 'POST',
        header: {
          'content-type': 'application/json'
        },
        data: requestData,
        success: (res) => {
          if (res.statusCode === 200) {
            // 登录成功
            let token = null;
            // 尝试从不同的位置获取 Token
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
              // 保存 Token 到本地存储
              wx.setStorageSync('token', token);
              // 验证 Token 是否正确保存
              const savedToken = wx.getStorageSync('token');
              if (savedToken && savedToken === token) {
                console.log('✅ Token 保存成功');
              } else {
                console.error('❌ Token 保存失败');
              }
            } else {
              console.error('❌ 未从后端响应中找到 Token');
              console.error('后端返回数据:', JSON.stringify(res.data));
            }
            
            // 保存 openid 到本地存储
            let openid = null;
            if (res.data && res.data.openid) {
              openid = res.data.openid;
            } else if (res.data && res.data.data && res.data.data.openid) {
              openid = res.data.data.openid;
            }
            if (openid) {
              wx.setStorageSync('openid', openid);
              console.log('✅ openid 保存成功:', openid);
            }
            resolve({ success: true, data: res.data })
          } else {
            // 针对 41002 appid missing 的针对性提示
            if (res.data && (res.data.message || '').includes('41002')) {
              console.error('CRITICAL: 后端上报微信41002错误，请检查后端配置文件中的 AppID 是否与前端一致！');
            }
            console.warn('后端返回错误状态码:', res.statusCode, res.data)
            resolve({ success: false, statusCode: res.statusCode, data: res.data })
          }
        },
        fail: (err) => {
          console.warn('后端登录请求失败:', err)
          reject(err)
        }
      })
    })
  },

  // 获取用户信息（需要用户主动触发）
  getUserProfile: function() {
    const that = this
    return new Promise((resolve, reject) => {
      wx.getUserProfile({
        desc: '用于完善会员资料',
        lang: 'zh_CN',
        success: function(profileRes) {
          const userInfo = profileRes.userInfo
          console.log('获取用户信息成功:', userInfo)
          
          // 只保存头像和昵称
          const userData = {
            avatarUrl: userInfo.avatarUrl,
            nickName: userInfo.nickName
          }
          
          // 保存到globalData
          that.globalData.userInfo = userData
          
          // 保存到本地存储
          wx.setStorageSync('userInfo', userData)
          
          console.log('用户信息已保存到本地存储')
          resolve(userData)
        },
        fail: function(err) {
          console.error('获取用户信息失败:', err)
          reject(err)
        }
      })
    })
  },
  
  // 测试服务器连接
  testServerConnection: function() {
    return new Promise((resolve, reject) => {
      wx.request({
        url: `${API_BASE_URL}/api/info?_t=${Date.now()}`,
        method: 'GET',
        timeout: 5000, // 5秒超时
        success: (res) => {
          console.log('服务器连接测试成功:', res.statusCode);
          if (res.statusCode === 200) {
            resolve({
              success: true,
              statusCode: res.statusCode,
              data: res.data
            });
          } else {
            console.error('服务器返回错误状态码:', res.statusCode, res.data);
            resolve({
              success: false,
              statusCode: res.statusCode,
              error: `服务器返回错误状态码: ${res.statusCode}`
            });
          }
        },
        fail: (err) => {
          console.error('服务器连接测试失败:', err);
          // 移除连接失败提示，仅在控制台打印
          resolve({
            success: false,
            error: err.errMsg || '无法连接到服务器'
          });
        }
      });
    });
  }
})