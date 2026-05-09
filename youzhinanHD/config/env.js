// 环境配置文件
// 根据当前环境设置后端地址

// 开发环境（本地）
// const BACKEND_URL = 'http://localhost:3003';

// 生产环境（公网）
const BACKEND_URL = 'https://your-domain.com';

// 如果需要根据环境自动切换，可以使用以下代码：
// const BACKEND_URL = process.env.NODE_ENV === 'production' 
//   ? 'https://your-domain.com'
//   : 'http://localhost:3003';

module.exports = {
  BACKEND_URL
};