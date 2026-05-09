const axios = require('axios');

const loadMiniPrograms = () => {
  const miniPrograms = {};

  let wxEnvStr = process.env.WX_MINIPROGRAMS;
  if (wxEnvStr) {
    try {
      wxEnvStr = wxEnvStr.replace(/^['"]|['"]$/g, '');
      const parsed = JSON.parse(wxEnvStr);
      Object.assign(miniPrograms, parsed);
    } catch (e) {
      console.error('解析 WX_MINIPROGRAMS 失败:', e.message, '原始值:', process.env.WX_MINIPROGRAMS);
    }
  }

  if (process.env.WX_APPID && process.env.WX_SECRET) {
    miniPrograms[process.env.WX_APPID] = process.env.WX_SECRET;
  }

  if (process.env.WECHAT_APPID && process.env.WECHAT_SECRET) {
    miniPrograms[process.env.WECHAT_APPID] = process.env.WECHAT_SECRET;
  }

  if (process.env.WECHAT_APPID_2 && process.env.WECHAT_SECRET_2) {
    miniPrograms[process.env.WECHAT_APPID_2] = process.env.WECHAT_SECRET_2;
  }

  if (process.env.WX_APPID_2 && process.env.WX_SECRET_2) {
    miniPrograms[process.env.WX_APPID_2] = process.env.WX_SECRET_2;
  }

  return miniPrograms;
};

const getMiniProgramConfig = (appid) => {
  const WX_MINIPROGRAMS = loadMiniPrograms();
  const targetAppId = appid || process.env.WX_APPID || process.env.WECHAT_APPID || Object.keys(WX_MINIPROGRAMS)[0] || null;

  if (!targetAppId) {
    throw new Error('未配置任何小程序');
  }

  const secret = WX_MINIPROGRAMS[targetAppId];

  if (!secret) {
    throw new Error(`未找到小程序 ${targetAppId} 的配置，已配置的小程序: ${JSON.stringify(Object.keys(WX_MINIPROGRAMS))}`);
  }

  return {
    appid: targetAppId,
    secret: secret,
    jscode2sessionUrl: 'https://api.weixin.qq.com/sns/jscode2session'
  };
};

const getSessionInfo = async (code, appid = null) => {
  try {
    if (!code || typeof code !== 'string') {
      throw new Error('无效的code参数');
    }

    const config = getMiniProgramConfig(appid);
    console.log(`使用小程序 appid: ${config.appid}`);

    const response = await axios.get(config.jscode2sessionUrl, {
      params: {
        appid: config.appid,
        secret: config.secret,
        js_code: code,
        grant_type: 'authorization_code'
      }
    });

    if (response.data.errcode) {
      throw new Error(`微信API错误: ${response.data.errmsg} (${response.data.errcode})`);
    }

    return {
      openid: response.data.openid,
      session_key: response.data.session_key,
      unionid: response.data.unionid || null,
      appid: config.appid
    };
  } catch (error) {
    console.error('微信API调用失败:', error.message);
    throw error;
  }
};

const getDefaultAppId = () => {
  return process.env.WX_APPID || process.env.WECHAT_APPID || Object.keys(loadMiniPrograms())[0] || null;
};

const getSupportedAppIds = () => {
  return Object.keys(loadMiniPrograms());
};

module.exports = {
  getSessionInfo,
  getMiniProgramConfig,
  getDefaultAppId,
  getSupportedAppIds
};
