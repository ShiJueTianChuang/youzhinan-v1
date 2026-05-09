const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const User = require('../models/user');
const { generateToken, authenticate } = require('../middleware/auth');
const {
  VerificationCode,
  LoginAttempt,
  validateEmail,
  validatePasswordComplexity
} = require('../utils/emailVerification');
const { sendVerificationEmail, sendPasswordChangeNotification } = require('../utils/emailService');
const db = require('../config/db');
require('dotenv').config();

const PUBLIC_ORIGIN = (process.env.PUBLIC_ORIGIN || 'https://your-domain.com').replace(/\/$/, '');

router.post('/send-code', async (req, res) => {
  console.log('=== 收到发送验证码请求 ===');
  console.log('请求体:', req.body);

  try {
    const { email, type } = req.body;

    if (!email) {
      return res.status(400).json({
        code: 400,
        message: '请输入邮箱地址',
        data: null
      });
    }

    if (!validateEmail(email)) {
      return res.status(400).json({
        code: 400,
        message: '请输入有效的邮箱地址',
        data: null
      });
    }

    const validTypes = ['register', 'login', 'reset_password'];
    if (!type || !validTypes.includes(type)) {
      return res.status(400).json({
        code: 400,
        message: '无效的验证码类型',
        data: null
      });
    }

    if (type === 'reset_password') {
      const existingUser = await User.findByEmail(email);
      if (!existingUser) {
        return res.status(400).json({
          code: 400,
          message: '该邮箱未注册',
          data: null
        });
      }
    }

    if (type === 'register') {
      const existingUser = await User.findByEmail(email);
      if (existingUser) {
        return res.status(400).json({
          code: 400,
          message: '该邮箱已被注册',
          data: null
        });
      }
    }

    console.log('正在生成验证码...');
    const { code } = await VerificationCode.create(email, type);

    console.log('正在发送邮件...');
    await sendVerificationEmail(email, code, type);

    await logOperation(null, email, 'send_verification_code', 'success', { type });

    return res.json({
      code: 200,
      message: '验证码已发送，请查收邮件',
      data: null
    });
  } catch (error) {
    console.error('=== 发送验证码失败 ===');
    console.error('错误信息:', error.message);
    console.error('错误堆栈:', error.stack);

    await logOperation(null, req.body.email, 'send_verification_code', 'failed', { error: error.message });

    return res.status(500).json({
      code: 500,
      message: error.message || '发送验证码失败',
      data: null
    });
  }
});

router.post('/register', async (req, res) => {
  console.log('=== 收到邮箱注册请求 ===');
  console.log('请求体:', { ...req.body, password: '***' });

  try {
    const { email, password, code, nick_name, nickName, nickname } = req.body;
    
    const finalNickName = nick_name || nickName || nickname;

    if (!email || !password || !code) {
      return res.status(400).json({
        code: 400,
        message: '请填写完整信息',
        data: null
      });
    }

    if (!validateEmail(email)) {
      return res.status(400).json({
        code: 400,
        message: '请输入有效的邮箱地址',
        data: null
      });
    }

    const passwordCheck = validatePasswordComplexity(password);
    if (!passwordCheck.valid) {
      return res.status(400).json({
        code: 400,
        message: passwordCheck.message,
        data: null
      });
    }

    console.log('正在验证验证码...');
    await VerificationCode.verify(email, code, 'register');

    console.log('正在检查邮箱是否已注册...');
    const existingUser = await User.findByEmail(email);
    if (existingUser) {
      return res.status(400).json({
        code: 400,
        message: '该邮箱已被注册',
        data: null
      });
    }

    console.log('正在加密密码...');
    const hashedPassword = await bcrypt.hash(password, 10);

    console.log('正在生成用户名...');
    const maxUsername = await User.getMaxUsername(true);
    const username = (maxUsername + 1).toString().padStart(3, '0');

    console.log('正在创建用户...');
    const user = await User.createWithUsername({
      username,
      password: hashedPassword,
      nick_name: finalNickName || `用户${email.split('@')[0]}`,
      email: email
    });

    await VerificationCode.markAsUsed(email, 'register');

    console.log('正在生成token...');
    const payload = { id: user.id, userId: user.id, user_id: user.id };
    const token = generateToken(payload);

    await logOperation(user.id, email, 'register', 'success');

    console.log('注册成功:', username);

    return res.json({
      code: 200,
      message: '注册成功',
      data: {
        token: token,
        userInfo: formatUserInfo(user)
      }
    });
  } catch (error) {
    console.error('=== 邮箱注册失败 ===');
    console.error('错误信息:', error.message);
    console.error('错误堆栈:', error.stack);

    await logOperation(null, req.body.email, 'register', 'failed', { error: error.message });

    return res.status(500).json({
      code: 500,
      message: error.message || '注册失败',
      data: null
    });
  }
});

router.post('/login', async (req, res) => {
  console.log('=== 收到邮箱登录请求 ===');
  console.log('请求体:', { ...req.body, password: '***' });

  try {
    const { email, password, remember } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        code: 400,
        message: '请输入邮箱和密码',
        data: null
      });
    }

    if (!validateEmail(email)) {
      return res.status(400).json({
        code: 400,
        message: '请输入有效的邮箱地址',
        data: null
      });
    }

    console.log('检查账户是否被锁定...');
    const isLocked = await LoginAttempt.isLocked(email);
    if (isLocked) {
      await logOperation(null, email, 'login', 'failed', { reason: 'account_locked' });
      return res.status(429).json({
        code: 429,
        message: '登录尝试次数过多，请稍后再试',
        data: null
      });
    }

    console.log('正在查找用户...');
    const user = await User.findByEmail(email);
    if (!user) {
      await LoginAttempt.record(email, false);
      const remaining = await LoginAttempt.getRemainingAttempts(email);
      await logOperation(null, email, 'login', 'failed', { reason: 'user_not_found' });
      return res.status(401).json({
        code: 401,
        message: '邮箱或密码错误',
        data: { remainingAttempts: remaining }
      });
    }

    console.log('正在验证密码...');
    const passwordMatch = await bcrypt.compare(password, user.password);
    if (!passwordMatch) {
      await LoginAttempt.record(email, false);
      const remaining = await LoginAttempt.getRemainingAttempts(email);
      await logOperation(user.id, email, 'login', 'failed', { reason: 'wrong_password' });
      return res.status(401).json({
        code: 401,
        message: '邮箱或密码错误',
        data: { remainingAttempts: remaining }
      });
    }

    await LoginAttempt.record(email, true);

    console.log('正在生成token...');
    const payload = { id: user.id, userId: user.id, user_id: user.id };
    const expiresIn = remember ? '30d' : process.env.JWT_EXPIRES_IN || '7d';
    const token = generateToken(payload, expiresIn);

    await logOperation(user.id, email, 'login', 'success', { remember: !!remember });

    console.log('登录成功:', user.username);

    return res.json({
      code: 200,
      message: '登录成功',
      data: {
        token: token,
        userInfo: formatUserInfo(user)
      }
    });
  } catch (error) {
    console.error('=== 邮箱登录失败 ===');
    console.error('错误信息:', error.message);
    console.error('错误堆栈:', error.stack);

    await logOperation(null, req.body.email, 'login', 'failed', { error: error.message });

    return res.status(500).json({
      code: 500,
      message: '登录失败',
      data: null
    });
  }
});

router.post('/verify-code', async (req, res) => {
  console.log('=== 收到验证验证码请求 ===');
  console.log('请求体:', req.body);

  try {
    const { email, code, type } = req.body;

    if (!email || !code || !type) {
      return res.status(400).json({
        code: 400,
        message: '请填写完整信息',
        data: null
      });
    }

    if (!validateEmail(email)) {
      return res.status(400).json({
        code: 400,
        message: '请输入有效的邮箱地址',
        data: null
      });
    }

    const validTypes = ['register', 'login', 'reset_password'];
    if (!type || !validTypes.includes(type)) {
      return res.status(400).json({
        code: 400,
        message: '无效的验证码类型',
        data: null
      });
    }

    console.log('正在验证验证码...');
    await VerificationCode.verify(email, code, type);

    await logOperation(null, email, 'verify_code', 'success', { type });

    return res.json({
      code: 200,
      message: '验证码验证成功',
      data: null
    });
  } catch (error) {
    console.error('=== 验证验证码失败 ===');
    console.error('错误信息:', error.message);
    console.error('错误堆栈:', error.stack);

    await logOperation(null, req.body.email, 'verify_code', 'failed', { error: error.message });

    return res.status(400).json({
      code: 400,
      message: error.message || '验证码验证失败',
      data: null
    });
  }
});

router.post('/reset-password/send-code', async (req, res) => {
  console.log('=== 收到重置密码发送验证码请求 ===');
  console.log('请求体:', req.body);

  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({
        code: 400,
        message: '请输入邮箱地址',
        data: null
      });
    }

    if (!validateEmail(email)) {
      return res.status(400).json({
        code: 400,
        message: '请输入有效的邮箱地址',
        data: null
      });
    }

    const existingUser = await User.findByEmail(email);
    if (!existingUser) {
      return res.status(400).json({
        code: 400,
        message: '该邮箱未注册',
        data: null
      });
    }

    console.log('正在生成验证码...');
    const { code } = await VerificationCode.create(email, 'reset_password');

    console.log('正在发送邮件...');
    await sendVerificationEmail(email, code, 'reset_password');

    await logOperation(existingUser.id, email, 'send_reset_password_code', 'success');

    return res.json({
      code: 200,
      message: '验证码已发送，请查收邮件',
      data: null
    });
  } catch (error) {
    console.error('=== 发送重置密码验证码失败 ===');
    console.error('错误信息:', error.message);
    console.error('错误堆栈:', error.stack);

    return res.status(500).json({
      code: 500,
      message: error.message || '发送验证码失败',
      data: null
    });
  }
});

router.post('/reset-password', async (req, res) => {
  console.log('=== 收到重置密码请求 ===');
  console.log('请求体:', { ...req.body, newPassword: '***' });

  try {
    const { email, code, newPassword } = req.body;

    if (!email || !code || !newPassword) {
      return res.status(400).json({
        code: 400,
        message: '请填写完整信息',
        data: null
      });
    }

    if (!validateEmail(email)) {
      return res.status(400).json({
        code: 400,
        message: '请输入有效的邮箱地址',
        data: null
      });
    }

    const passwordCheck = validatePasswordComplexity(newPassword);
    if (!passwordCheck.valid) {
      return res.status(400).json({
        code: 400,
        message: passwordCheck.message,
        data: null
      });
    }

    console.log('正在验证验证码...');
    await VerificationCode.verify(email, code, 'reset_password');

    console.log('正在查找用户...');
    const user = await User.findByEmail(email);
    if (!user) {
      return res.status(400).json({
        code: 400,
        message: '用户不存在',
        data: null
      });
    }

    console.log('正在加密新密码...');
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    console.log('正在更新密码...');
    await db.query(
      'UPDATE users SET password = ? WHERE id = ?',
      [hashedPassword, user.id]
    );

    await VerificationCode.markAsUsed(email, 'reset_password');

    try {
      await sendPasswordChangeNotification(email);
    } catch (emailError) {
      console.error('发送密码修改通知失败:', emailError.message);
    }

    await logOperation(user.id, email, 'reset_password', 'success');

    console.log('密码重置成功:', user.username);

    return res.json({
      code: 200,
      message: '密码重置成功',
      data: null
    });
  } catch (error) {
    console.error('=== 重置密码失败 ===');
    console.error('错误信息:', error.message);
    console.error('错误堆栈:', error.stack);

    await logOperation(null, req.body.email, 'reset_password', 'failed', { error: error.message });

    return res.status(500).json({
      code: 500,
      message: error.message || '重置密码失败',
      data: null
    });
  }
});

router.post('/change-password', authenticate, async (req, res) => {
  console.log('=== 收到修改密码请求 ===');
  console.log('用户ID:', req.user.id);

  try {
    const userId = req.user.id || req.user.userId || req.user.user_id;
    const { oldPassword, newPassword } = req.body;

    if (!oldPassword || !newPassword) {
      return res.status(400).json({
        code: 400,
        message: '请填写完整信息',
        data: null
      });
    }

    const passwordCheck = validatePasswordComplexity(newPassword);
    if (!passwordCheck.valid) {
      return res.status(400).json({
        code: 400,
        message: passwordCheck.message,
        data: null
      });
    }

    console.log('正在查找用户...');
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        code: 404,
        message: '用户不存在',
        data: null
      });
    }

    console.log('正在验证旧密码...');
    const passwordMatch = await bcrypt.compare(oldPassword, user.password);
    if (!passwordMatch) {
      await logOperation(userId, user.email, 'change_password', 'failed', { reason: 'wrong_old_password' });
      return res.status(400).json({
        code: 400,
        message: '旧密码错误',
        data: null
      });
    }

    console.log('正在加密新密码...');
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    console.log('正在更新密码...');
    await db.query(
      'UPDATE users SET password = ? WHERE id = ?',
      [hashedPassword, userId]
    );

    try {
      if (user.email) {
        await sendPasswordChangeNotification(user.email);
      }
    } catch (emailError) {
      console.error('发送密码修改通知失败:', emailError.message);
    }

    await logOperation(userId, user.email, 'change_password', 'success');

    console.log('密码修改成功:', user.username);

    return res.json({
      code: 200,
      message: '密码修改成功',
      data: null
    });
  } catch (error) {
    console.error('=== 修改密码失败 ===');
    console.error('错误信息:', error.message);
    console.error('错误堆栈:', error.stack);

    return res.status(500).json({
      code: 500,
      message: '修改密码失败',
      data: null
    });
  }
});

function formatUserInfo(user) {
  return {
    id: user.id,
    username: user.username,
    nick_name: user.nick_name,
    avatar_url: user.avatar_url ? (user.avatar_url.startsWith('http') ? user.avatar_url : `${PUBLIC_ORIGIN}${user.avatar_url}`) : null,
    phone: user.phone,
    email: user.email,
    is_admin: user.is_admin || false,
    isAdmin: user.is_admin || false,
    app_user: user.app_user || true,
    symbol: user.symbol,
    points: user.points
  };
}

async function logOperation(userId, email, operation, status, details = {}) {
  try {
    await db.query(
      'INSERT INTO operation_logs (user_id, email, operation, status, details, created_at) VALUES (?, ?, ?, ?, ?, ?)',
      [userId || null, email || null, operation, status, JSON.stringify(details), new Date()]
    );
  } catch (error) {
    console.error('记录操作日志失败:', error.message);
  }
}

module.exports = router;