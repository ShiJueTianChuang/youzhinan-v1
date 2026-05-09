const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const router = express.Router();
const db = require('../config/db');
const { authenticate } = require('../middleware/auth');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

/** 从数据库判断是否为管理员 */
async function userIsAdmin(userId) {
  if (userId === undefined || userId === null || userId === '') return false;
  const id = parseInt(userId, 10);
  if (Number.isNaN(id)) return false;
  const [rows] = await db.query('SELECT is_admin FROM users WHERE id = ?', [id]);
  return rows.length > 0 && !!rows[0].is_admin;
}

// 配置头像上传
const avatarUploadDir = path.join(__dirname, '..', 'uploads', 'avatars');
if (!fs.existsSync(avatarUploadDir)) {
  fs.mkdirSync(avatarUploadDir, { recursive: true });
}

const avatarStorage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, avatarUploadDir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname) || '.jpg';
    cb(null, `avatar-${uniqueSuffix}${ext}`);
  }
});

const avatarUpload = multer({
  storage: avatarStorage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('只允许上传 JPG、PNG、GIF 图片'), false);
    }
  }
});

// 头像上传 - 兼容 'file' 和 'image' 两种表单字段名（APP和小程序通用）
router.post('/:id/avatar', authenticate, avatarUpload.any(), async (req, res) => {
  try {
    const currentUserId = req.user.userId || req.user.id || req.user.user_id;
    const targetId = parseInt(req.params.id, 10);
    
    console.log(`头像上传请求: userId=${currentUserId}, targetId=${targetId}, user=${JSON.stringify(req.user)}`);
    
    if (Number.isNaN(targetId)) {
      console.log('头像上传失败: 无效的用户ID');
      return res.status(400).json({ error: '无效的用户 ID' });
    }
    if (!currentUserId || parseInt(currentUserId, 10) !== targetId) {
      console.log(`头像上传失败: 权限不足，当前用户=${currentUserId}, 目标用户=${targetId}`);
      if (!(await userIsAdmin(currentUserId))) {
        return res.status(403).json({ error: '无权修改其他用户信息' });
      }
    }
    
    if (!req.files || req.files.length === 0) {
      console.log('头像上传失败: 未上传文件，请求字段: ' + JSON.stringify(Object.keys(req.body)));
      return res.status(400).json({ error: '未选择文件' });
    }
    
    const file = req.files[0];
    console.log(`接收到文件: ${file.originalname}, mimetype=${file.mimetype}, size=${file.size}, fieldname=${file.fieldname}`);
    
    // 构建头像URL
    const avatarUrl = `/uploads/avatars/${file.filename}`;
    const fullUrl = `${process.env.PUBLIC_ORIGIN || 'https://your-domain.com'}${avatarUrl}`;
    
    // 更新用户头像
    console.log(`更新数据库: userId=${targetId}, avatar_url=${fullUrl}`);
    await db.query('UPDATE users SET avatar_url = ? WHERE id = ?', [fullUrl, targetId]);
    
    const response = {
      success: true,
      message: '头像上传成功',
      data: {
        avatar_url: avatarUrl,
        fullUrl: fullUrl
      }
    };
    
    console.log(`用户 ${targetId} 头像上传成功，返回: ${JSON.stringify(response)}`);
    res.json(response);
  } catch (error) {
    console.error('头像上传错误:', error);
    console.error('错误堆栈:', error.stack);
    res.status(500).json({ error: '头像上传失败', message: error.message });
  }
});

// 获取用户列表（分页，支持搜索）- 需要认证
// 始终分页返回 { list, total, page, pageSize }
router.get('/', authenticate, async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    // 单页上限提高便于管理端拉全量；超大数据量请用多页循环请求
    const pageSize = Math.min(500, Math.max(10, parseInt(req.query.pageSize, 10) || 20));
    const search = (req.query.search || '').trim();
    const sourceFilter = req.query.source || 'all';
    const avatarFilter = req.query.avatar || 'all';
    const offset = (page - 1) * pageSize;

    let total = 0;
    let rawRows = [];
    const conditions = [];
    const params = [];

    if (search) {
      conditions.push('(username LIKE ? OR nick_name LIKE ? OR phone LIKE ? OR email LIKE ? OR wx_openid LIKE ? OR openid LIKE ?)');
      const s = '%' + search + '%';
      params.push(s, s, s, s, s, s);
    }
    if (sourceFilter === 'wechat') {
      conditions.push('(app_user = 0 OR app_user IS NULL)');
    } else if (sourceFilter === 'app') {
      conditions.push('app_user = 1');
    }
    if (avatarFilter === 'with-avatar') {
      conditions.push("(avatar_url IS NOT NULL AND avatar_url != '' AND avatar_url NOT LIKE 'http://tmp/%')");
    } else if (avatarFilter === 'no-avatar') {
      conditions.push("(avatar_url IS NULL OR avatar_url = '' OR avatar_url LIKE 'http://tmp/%')");
    }
    const where = conditions.length ? ' WHERE ' + conditions.join(' AND ') : '';

    try {
      const [countRows] = await db.query(`SELECT COUNT(*) as total FROM users ${where}`, params);
      total = Number(countRows[0]?.total) || 0;
      const [rows] = await db.query(`SELECT * FROM users ${where} ORDER BY id DESC LIMIT ? OFFSET ?`, [...params, pageSize, offset]);
      rawRows = rows || [];
    } catch (qerr) {
      const isColumnError = qerr.code === 'ER_BAD_FIELD_ERROR' || (qerr.message && qerr.message.includes('Unknown column'));
      if (isColumnError && (conditions.length > 0 || search)) {
        const simpleWhere = search ? ' WHERE username LIKE ?' : '';
        const simpleParams = search ? ['%' + search + '%'] : [];
        const [countRows] = await db.query(`SELECT COUNT(*) as total FROM users ${simpleWhere}`, simpleParams);
        total = Number(countRows[0]?.total) || 0;
        const [rows] = await db.query(`SELECT * FROM users ${simpleWhere} ORDER BY id DESC LIMIT ? OFFSET ?`, [...simpleParams, pageSize, offset]);
        rawRows = rows || [];
      } else if (isColumnError) {
        const [countRows] = await db.query('SELECT COUNT(*) as total FROM users');
        total = Number(countRows[0]?.total) || 0;
        const [rows] = await db.query('SELECT * FROM users ORDER BY id DESC LIMIT ? OFFSET ?', [pageSize, offset]);
        rawRows = rows || [];
      } else {
        throw qerr;
      }
    }

    const list = (rawRows || []).map(r => {
      if (!r) return null;
      const { password, ...safe } = r;
      return safe;
    }).filter(Boolean);

    res.json({ list, total, page, pageSize });
  } catch (error) {
    console.error('用户列表错误:', error.message);
    res.status(500).json({ error: '服务器内部错误' });
  }
});

// 获取单条用户信息 - 需要认证（本人或管理员）
router.get('/:id', authenticate, async (req, res) => {
  try {
    const currentUserId = req.user.userId || req.user.id || req.user.user_id;
    const targetId = parseInt(req.params.id, 10);
    if (Number.isNaN(targetId)) {
      return res.status(400).json({ error: '无效的用户 ID' });
    }
    if (!currentUserId || parseInt(currentUserId, 10) !== targetId) {
      if (!(await userIsAdmin(currentUserId))) {
        return res.status(403).json({ error: '无权访问其他用户信息' });
      }
    }
    const [rows] = await db.query('SELECT * FROM users WHERE id = ?', [targetId]);
    if (rows.length === 0) {
      return res.status(404).json({ error: '用户不存在' });
    }
    const { password: _pwd, ...safe } = rows[0];
    res.json(safe);
  } catch (error) {
    console.error(error.message);
    res.status(500).json({ error: '服务器内部错误' });
  }
});

// 登录尝试限制存储
const loginAttempts = new Map();
const MAX_ATTEMPTS = 5;
const LOCKOUT_TIME = 15 * 60 * 1000; // 15分钟

// 用户登录
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    console.log('===== 登录请求 =====');
    console.log('登录请求:', { username: username, passwordLength: password ? password.length : 0 });
    console.log('请求IP:', req.ip);
    
    if (!username || !password) {
      console.log('登录失败: 用户名或密码为空');
      return res.status(400).json({ error: '用户名和密码不能为空' });
    }

    // 检查登录尝试限制
    const attempts = loginAttempts.get(username) || {
      count: 0,
      lastAttempt: Date.now()
    };

    // 检查是否在锁定时间内
    if (attempts.count >= MAX_ATTEMPTS && (Date.now() - attempts.lastAttempt) < LOCKOUT_TIME) {
      const remainingTime = Math.ceil((LOCKOUT_TIME - (Date.now() - attempts.lastAttempt)) / 1000 / 60);
      return res.status(429).json({ error: `登录失败次数过多，请${remainingTime}分钟后再试` });
    }

    // 如果超出锁定时间，重置尝试次数
    if ((Date.now() - attempts.lastAttempt) >= LOCKOUT_TIME) {
      attempts.count = 0;
    }

    try {
      // 查询用户是否存在
      const [rows] = await db.query('SELECT * FROM users WHERE username = ?', [username]);
      console.log('数据库查询结果:', rows);
      
      let user = null;
      let isPasswordValid = false;
      
      if (rows.length > 0) {
        user = rows[0];
        console.log('找到用户:', user.username);
        
        // 统一使用bcrypt验证密码
        isPasswordValid = await bcrypt.compare(password, user.password);
        console.log('bcrypt密码验证结果:', isPasswordValid);
      }
      
      if (!isPasswordValid) {
        // 登录失败，增加尝试次数
        attempts.count++;
        attempts.lastAttempt = Date.now();
        loginAttempts.set(username, attempts);
        
        console.log('登录失败: 密码错误，尝试次数:', attempts.count);
        return res.status(401).json({ error: '用户名或密码错误' });
      }

      // 登录成功，重置尝试次数
      loginAttempts.delete(username);

      // 登录成功，生成token
      const { password: pwd, ...userInfo } = user;
      const token = jwt.sign({ userId: user.id }, process.env.JWT_SECRET, { expiresIn: '1h' });
      console.log('登录成功:', user.username);
      
      // 添加登录日志
      try {
        await db.query(
          'INSERT INTO login_logs (user_id, username, login_time, ip_address) VALUES (?, ?, NOW(), ?)',
          [user.id, user.username, req.ip]
        );
      } catch (logError) {
        console.error('登录日志记录失败:', logError.message);
      }
      
      res.json({ 
        message: '登录成功',
        user: userInfo,
        token: token
      });
    } catch (dbError) {
      console.error('数据库查询错误:', dbError.message);
      res.status(500).json({ error: '服务器内部错误' });
    }
  } catch (error) {
    console.error('登录处理错误:', error.message);
    res.status(500).json({ error: '服务器内部错误' });
  }
});

// 添加用户 - 需要认证（通常只允许管理员）
router.post('/', authenticate, async (req, res) => {
  try {
    // 这里可以添加管理员权限检查
    const { password, symbol, points, rating, avatarUrl, nickName } = req.body;
    
    // 检查必要字段
    if (!password || typeof password !== 'string') {
      return res.status(400).json({ error: '密码不能为空' });
    }
    
    // 验证密码长度
    if (password.length < 6) {
      return res.status(400).json({ error: '密码长度不能少于6个字符' });
    }
    
    // 自动生成用户名
    let username;
    try {
      // 查询数据库中最大的用户名
      const [maxUser] = await db.query('SELECT MAX(username) as max_username FROM users');
      let maxNum = 0;
      
      if (maxUser[0].max_username) {
        // 提取数字部分并转换为整数
        const match = maxUser[0].max_username.match(/\d+/);
        if (match) {
          maxNum = parseInt(match[0], 10);
        }
      }
      
      // 生成新的用户名（三位数格式）
      maxNum++;
      username = maxNum.toString().padStart(3, '0');
      console.log('生成的新用户名为:', username);
    } catch (error) {
      console.error('生成用户名失败:', error.message);
      return res.status(500).json({ error: '生成用户名失败' });
    }
    
    // 检查生成的用户名是否已存在（防止并发问题）
    const [existingUsers] = await db.query('SELECT * FROM users WHERE username = ?', [username]);
    if (existingUsers.length > 0) {
      return res.status(409).json({ error: '用户名已存在' });
    }
    
    // 对密码进行哈希处理
    const hashedPassword = await bcrypt.hash(password, 10);
    
    // 处理字段名映射和类型验证
    let nick_name = null;
    if (nickName && typeof nickName === 'string') {
      // 验证昵称长度
      if (nickName.length > 100) {
        return res.status(400).json({ error: '昵称长度不能超过100个字符' });
      }
      nick_name = nickName.trim() || null;
    }
    
    let avatar_url = null;
    if (avatarUrl && typeof avatarUrl === 'string') {
      // 验证头像URL长度
      if (avatarUrl.length > 500) {
        return res.status(400).json({ error: '头像URL长度不能超过500个字符' });
      }
      avatar_url = avatarUrl.trim() || null;
    }
    
    // 处理其他可选字段
    const processedSymbol = symbol || null;
    const processedPoints = points || 0;
    const processedRating = rating || 0;
    
    const [result] = await db.query(
      'INSERT INTO users (username, password, symbol, points, rating, nick_name, avatar_url) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [username, hashedPassword, processedSymbol, processedPoints, processedRating, nick_name, avatar_url]
    );
    res.json({ id: result.insertId, message: '用户添加成功' });
  } catch (error) {
    console.error('添加用户错误:', error.message);
    res.status(500).json({ error: '服务器内部错误' });
  }
});

// 更新用户 - 需要认证（本人或管理员；支持部分更新：昵称、头像、手机号等）
router.put('/:id', authenticate, async (req, res) => {
  try {
    const currentUserId = req.user.userId || req.user.id || req.user.user_id;
    const targetId = parseInt(req.params.id, 10);
    if (Number.isNaN(targetId)) {
      return res.status(400).json({ error: '无效的用户 ID' });
    }
    if (!currentUserId || parseInt(currentUserId, 10) !== targetId) {
      if (!(await userIsAdmin(currentUserId))) {
        return res.status(403).json({ error: '无权修改其他用户信息' });
      }
    }
    
    const { username, password, symbol, points, rating, nickName, avatarUrl, nick_name, avatar_url, phone } = req.body;
    
    // 获取当前用户完整信息，用于部分更新时保留未传递的字段
    const [existingRows] = await db.query('SELECT * FROM users WHERE id = ?', [targetId]);
    if (existingRows.length === 0) {
      return res.status(404).json({ error: '用户不存在' });
    }
    const existing = existingRows[0];
    
    // 部分更新：仅更新请求中明确传递的字段
    const updates = [];
    const params = [];
    
    if (username !== undefined && username !== null && typeof username === 'string' && username.trim() !== '') {
      if (username.trim().length > 50) {
        return res.status(400).json({ error: '用户名长度不能超过50个字符' });
      }
      updates.push('username = ?');
      params.push(username.trim());
    }
    
    if (password !== undefined && password !== null && password !== '') {
      if (password.length < 6) {
        return res.status(400).json({ error: '密码长度不能少于6个字符' });
      }
      const hashedPassword = await bcrypt.hash(password, 10);
      updates.push('password = ?');
      params.push(hashedPassword);
    }
    
    const finalNickName = nick_name !== undefined ? nick_name : nickName;
    if (finalNickName !== undefined && finalNickName !== null) {
      const val = typeof finalNickName === 'string' ? finalNickName.trim() || null : null;
      if (val && val.length > 100) {
        return res.status(400).json({ error: '昵称长度不能超过100个字符' });
      }
      updates.push('nick_name = ?');
      params.push(val);
    }
    
    const finalAvatarUrl = avatar_url !== undefined ? avatar_url : avatarUrl;
    if (finalAvatarUrl !== undefined && finalAvatarUrl !== null) {
      const val = typeof finalAvatarUrl === 'string' ? finalAvatarUrl.trim() || null : null;
      if (val && val.length > 500) {
        return res.status(400).json({ error: '头像URL长度不能超过500个字符' });
      }
      updates.push('avatar_url = ?');
      params.push(val);
    }
    
    if (phone !== undefined) {
      const val = (phone !== null && String(phone).trim() !== '') ? String(phone).trim() : null;
      updates.push('phone = ?');
      params.push(val);
    }
    
    if (symbol !== undefined) {
      updates.push('symbol = ?');
      params.push(symbol || null);
    }
    if (points !== undefined) {
      updates.push('points = ?');
      params.push(points);
    }
    if (rating !== undefined) {
      updates.push('rating = ?');
      params.push(rating);
    }
    
    if (updates.length === 0) {
      return res.status(400).json({ error: '没有可更新的字段' });
    }
    
    params.push(targetId);
    const query = `UPDATE users SET ${updates.join(', ')} WHERE id = ?`;
    const [result] = await db.query(query, params);
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: '用户不存在' });
    }
    res.json({ message: '用户更新成功' });
  } catch (error) {
    console.error('更新用户错误:', error.message);
    res.status(500).json({ error: '服务器内部错误' });
  }
});

// 删除用户 - 需要认证；本人可删自己，管理员可删任意用户（后台用户管理依赖此项）
router.delete('/:id', authenticate, async (req, res) => {
  try {
    const targetId = parseInt(req.params.id, 10);
    if (Number.isNaN(targetId)) {
      return res.status(400).json({ error: '无效的用户 ID' });
    }
    const currentUserId = req.user.userId || req.user.id || req.user.user_id;
    if (!currentUserId) {
      return res.status(401).json({ error: '未登录' });
    }
    if (targetId !== parseInt(currentUserId, 10)) {
      if (!(await userIsAdmin(currentUserId))) {
        return res.status(403).json({ error: '无权删除其他用户' });
      }
    }

    const [result] = await db.query('DELETE FROM users WHERE id = ?', [targetId]);
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: '用户不存在' });
    }
    res.json({ message: '用户删除成功' });
  } catch (error) {
    console.error(error.message);
    res.status(500).json({ error: '服务器内部错误' });
  }
});

// 用户退出登录
router.post('/logout', (req, res) => {
  try {
    // JWT是无状态的，所以服务器不需要做特殊处理
    // 只需要返回成功响应即可
    res.json({ message: '退出成功' });
  } catch (error) {
    console.error(error.message);
    res.status(500).json({ error: '服务器内部错误' });
  }
});

module.exports = router;