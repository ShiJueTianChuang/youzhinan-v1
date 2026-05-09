require('dotenv').config();

const axios = require('axios');

console.log('环境变量检查:');
console.log('WX_APPID:', process.env.WX_APPID);
console.log('WX_SECRET:', process.env.WX_SECRET);
console.log('WX_MINIPROGRAMS:', process.env.WX_MINIPROGRAMS);

const appid = process.env.WX_APPID;
const secret = process.env.WX_SECRET;

async function test() {
  try {
    console.log(`\n正在调用微信API: appid=${appid}`);
    const resp = await axios.get('https://api.weixin.qq.com/cgi-bin/token', {
      params: {
        grant_type: 'client_credential',
        appid: appid,
        secret: secret
      }
    });
    console.log('微信API返回:', JSON.stringify(resp.data, null, 2));
  } catch (e) {
    console.error('请求失败:', e.message);
  }
}

test();
