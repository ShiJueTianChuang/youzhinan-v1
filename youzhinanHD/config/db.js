require('dotenv').config();
const mysql = require('mysql2/promise');

const pool = mysql.createPool({
  host: process.env.DB_HOST || '127.0.0.1',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'info_management',
  timezone: process.env.DB_TIMEZONE || '+08:00',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  charset: 'utf8mb4_general_ci',
  enableKeepAlive: true,
  supportBigNumbers: true,
  bigNumberStrings: true
});

console.log('数据库连接池创建成功');

module.exports = pool;
