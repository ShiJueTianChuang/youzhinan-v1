const jwt = require('jsonwebtoken');
require('dotenv').config();

const db = require('../config/db');

const JWT_SECRET = process.env.JWT_SECRET || process.env.SESSION_SECRET;
if (!JWT_SECRET) {
  console.error('❌ JWT_SECRET 环境变量未设置，服务无法安全启动！');
  process.exit(1);
}

const generateToken = (payload, expiresIn) => {
  return jwt.sign(payload, JWT_SECRET, { 
    expiresIn: expiresIn || process.env.JWT_EXPIRES_IN || '30d' 
  });
};

const authenticate = (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader) {
      return res.status(401).json({ error: '未提供身份验证令牌' });
    }
    
    const token = authHeader.split(' ')[1];
    
    if (!token) {
      return res.status(401).json({ error: '无效的身份验证令牌' });
    }
    
    const decoded = jwt.verify(token, JWT_SECRET);
    
    req.user = decoded;
    
    next();
  } catch (error) {
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({ error: '无效的身份验证令牌' });
    } else if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ error: '身份验证令牌已过期' });
    }
    return res.status(401).json({ error: '身份验证失败' });
  }
};

/** 管理员认证 - 需先通过 authenticate，再验证 is_admin */
const requireAdmin = async (req, res, next) => {
  try {
    const userId = req.user?.id || req.user?.userId || req.user?.user_id;
    if (!userId || !db) return res.status(401).json({ error: '未登录或服务不可用' });
    const [rows] = await db.query('SELECT is_admin FROM users WHERE id = ?', [userId]);
    if (rows.length === 0 || !rows[0].is_admin) {
      return res.status(403).json({ error: '需要管理员权限' });
    }
    next();
  } catch (err) {
    res.status(500).json({ error: '服务器错误' });
  }
};

module.exports = { generateToken, authenticate, requireAdmin };
