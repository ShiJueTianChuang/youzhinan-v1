const express = require('express');
const router = express.Router();
const db = require('../config/db');
const { authenticate, requireAdmin } = require('../middleware/auth');

// 检查用户是否为管理员（需要JWT认证）
router.get('/check-admin', authenticate, async (req, res) => {
  try {
    // 从请求头获取微信OpenID
    const wxOpenId = req.headers['wx-openid'];
    if (!wxOpenId) {
      return res.status(401).json({ isAdmin: false, message: '未提供微信OpenID' });
    }

    // 查询用户信息
    const [users] = await db.query('SELECT is_admin FROM users WHERE wx_openid = ?', [wxOpenId]);
    
    if (users.length > 0) {
      res.json({ isAdmin: users[0].is_admin });
    } else {
      // 如果用户不存在，返回非管理员
      res.json({ isAdmin: false });
    }
  } catch (error) {
    console.error('检查管理员权限失败:', error);
    res.status(500).json({ isAdmin: false, message: '服务器错误' });
  }
});

// 设置用户为管理员（需要管理员权限）
router.post('/set-admin', authenticate, requireAdmin, async (req, res) => {
  try {
    const { wx_openid, is_admin } = req.body;
    
    if (!wx_openid) {
      return res.status(400).json({ success: false, message: '微信OpenID不能为空' });
    }
    
    // 更新用户管理员权限
    const [result] = await db.query(
      'UPDATE users SET is_admin = ? WHERE wx_openid = ?',
      [Boolean(is_admin), wx_openid]
    );
    
    if (result.affectedRows > 0) {
      res.json({ success: true, message: '权限设置成功' });
    } else {
      // 如果用户不存在，先插入用户再设置权限
      try {
        await db.query(
          'INSERT INTO users (wx_openid, is_admin) VALUES (?, ?)',
          [wx_openid, Boolean(is_admin)]
        );
        res.json({ success: true, message: '权限设置成功' });
      } catch (insertErr) {
        console.error('插入用户失败:', insertErr);
        res.status(500).json({ success: false, message: '设置权限失败' });
      }
    }
  } catch (error) {
    console.error('设置管理员权限失败:', error);
    res.status(500).json({ success: false, message: '服务器错误' });
  }
});

module.exports = router;