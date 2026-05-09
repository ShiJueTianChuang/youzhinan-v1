/**
 * 阿里云短信服务
 * 使用号码认证服务的 SendSmsVerifyCode 接口发送验证码
 * 支持系统赠送签名和模板，无需企业认证
 */
const Core = require('@alicloud/pop-core');

// 阿里云配置
const ALIYUN_CONFIG = {
  accessKeyId: process.env.ALIYUN_SMS_ACCESS_KEY_ID || '',
  accessKeySecret: process.env.ALIYUN_SMS_ACCESS_KEY_SECRET || '',
  // 系统赠送签名名称
  signName: process.env.ALIYUN_SMS_SIGN_NAME || '',
  // 区域
  regionId: process.env.ALIYUN_SMS_REGION_ID || 'cn-hangzhou',
  // 号码认证服务API版本
  apiVersion: '2017-05-25'
};

// 模板映射：不同验证类型使用不同赠送模板CODE
// 100001=登录/注册, 100002=修改绑定手机号, 100003=重置密码, 100004=绑定新手机号, 100005=验证绑定手机号
const TEMPLATE_MAP = {
  register: process.env.ALIYUN_SMS_TEMPLATE_REGISTER || '100001',
  login: process.env.ALIYUN_SMS_TEMPLATE_LOGIN || '100001',
  reset_password: process.env.ALIYUN_SMS_TEMPLATE_RESET || '100003',
  change_phone: process.env.ALIYUN_SMS_TEMPLATE_CHANGE_PHONE || '100002',
  bind_phone: process.env.ALIYUN_SMS_TEMPLATE_BIND_PHONE || '100004'
};

// 创建阿里云客户端（号码认证服务端点）
let client = null;

function getClient() {
  if (!client) {
    client = new Core({
      accessKeyId: ALIYUN_CONFIG.accessKeyId,
      accessKeySecret: ALIYUN_CONFIG.accessKeySecret,
      endpoint: 'https://dypnsapi.aliyuncs.com',
      apiVersion: ALIYUN_CONFIG.apiVersion
    });
  }
  return client;
}

/**
 * 发送短信验证码（使用号码认证服务 SendSmsVerifyCode 接口）
 * @param {string} phone - 手机号
 * @param {string} code - 验证码
 * @param {string} type - 类型: register, login, reset_password
 * @returns {Promise<Object>} 发送结果
 */
async function sendSmsCode(phone, code, type) {
  console.log(`[短信服务] 准备发送验证码 - 手机: ${phone}, 类型: ${type}, 验证码: ${code}`);

  // 开发模式：如果没配置签名，走模拟模式
  if (!ALIYUN_CONFIG.signName) {
    console.log(`[短信服务] 开发模式 - 验证码: ${code}, 手机: ${phone}`);
    console.log(`[短信服务] 请配置 ALIYUN_SMS_SIGN_NAME 环境变量以启用真实短信发送`);
    return {
      Code: 'OK',
      Message: '开发模式-验证码已生成（未实际发送短信）',
      RequestId: 'dev-' + Date.now()
    };
  }

  // 根据类型获取对应赠送模板CODE
  const templateCode = TEMPLATE_MAP[type] || TEMPLATE_MAP.register;

  // 验证码有效时间（分钟）
  const codeExpireMinutes = 10;

  const params = {
    RegionId: ALIYUN_CONFIG.regionId,
    PhoneNumber: phone,
    SignName: ALIYUN_CONFIG.signName,
    TemplateCode: templateCode,
    TemplateParam: JSON.stringify({ code: code, min: String(codeExpireMinutes) }),
    CodeLength: 6,
    ValidTime: 600,
    Interval: 60,
    DuplicatePolicy: 1
  };

  const requestOption = {
    method: 'POST'
  };

  try {
    const result = await getClient().request('SendSmsVerifyCode', params, requestOption);
    console.log(`[短信服务] 发送结果:`, JSON.stringify(result));

    if (result.Code !== 'OK') {
      throw new Error(result.Message || '短信发送失败');
    }

    return {
      Code: 'OK',
      Message: '短信发送成功',
      RequestId: result.RequestId,
      BizId: result.Model && result.Model.BizId
    };
  } catch (error) {
    console.error('[短信服务] 发送失败:', error.message);
    throw error;
  }
}

/**
 * 验证手机号格式
 * @param {string} phone - 手机号
 * @returns {boolean} 是否有效
 */
function validatePhone(phone) {
  const phoneRegex = /^1[3-9]\d{9}$/;
  return phoneRegex.test(phone);
}

module.exports = {
  sendSmsCode,
  validatePhone,
  ALIYUN_CONFIG
};
