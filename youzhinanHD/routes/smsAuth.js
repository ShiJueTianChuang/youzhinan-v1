const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const User = require('../models/user');
const { generateToken, authenticate } = require('../middleware/auth');
const { SmsVerificationCode } = require('../utils/smsVerification');
const { sendSmsCode, validatePhone } = require('../utils/smsService');
const { findUserByInviteCode } = require('../utils/inviteCode');
const PUBLIC_ORIGIN = (process.env.PUBLIC_ORIGIN || 'https://your-domain.com').replace(/\/$/, '');
const db = require('../config/db');

const INVITE_CODE_REGEX = /^[A-Z]{3}\d{5}$/i;

async function processInviteCode(inviteCode, newUserId) {
  if (!inviteCode || typeof inviteCode !== 'string') {
    return { success: false, message: null };
  }

  const trimmedCode = inviteCode.trim();
  if (!trimmedCode) {
    return { success: false, message: null };
  }

  if (!INVITE_CODE_REGEX.test(trimmedCode)) {
    return { success: false, message: '邀请码格式不正确' };
  }

  try {
    const inviterId = await findUserByInviteCode(trimmedCode);

    if (!inviterId) {
      return { success: false, message: '邀请码无效' };
    }

    if (inviterId === newUserId) {
      return { success: false, message: '不能使用自己的邀请码' };
    }

    const conn = await db.getConnection();
    try {
      await conn.beginTransaction();

      const [existingInvite] = await conn.query('SELECT id FROM user_invitations WHERE invitee_id = ? FOR UPDATE', [newUserId]);
      if (existingInvite.length > 0) {
        await conn.commit();
        return { success: true, message: '该用户已被邀请过' };
      }

      const [activeActivity] = await conn.query(
        'SELECT id FROM lottery_activities WHERE status = ? AND start_time <= NOW() AND end_time >= NOW() ORDER BY created_at DESC LIMIT 1',
        ['active']
      );
      const activityId = activeActivity.length > 0 ? activeActivity[0].id : null;
      await conn.execute('INSERT INTO user_invitations (inviter_id, invitee_id, activity_id) VALUES (?, ?, ?)', [inviterId, newUserId, activityId]);
      console.log('邀请记录已创建，邀请人:', inviterId, '被邀请人:', newUserId, '活动ID:', activityId);

      await conn.commit();
      return { success: true, message: '邀请码使用成功' };
    } catch (txError) {
      await conn.rollback();
      throw txError;
    } finally {
      conn.release();
    }
  } catch (error) {
    console.error('处理邀请码失败:', error.message);
    return { success: false, message: '邀请码处理失败，请联系客服' };
  }
}

/**
 * POST /api/sms/send-code
 * 发送短信验证码
 */
router.post('/send-code', async (req, res) => {
  console.log('=== 收到发送短信验证码请求 ===');
  console.log('请求体:', req.body);

  try {
    const { phone, type } = req.body;

    if (!phone) {
      return res.status(400).json({
        code: 400,
        message: '请输入手机号',
        data: null
      });
    }

    if (!validatePhone(phone)) {
      return res.status(400).json({
        code: 400,
        message: '请输入有效的手机号',
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

    // 注册时检查手机号是否已注册
    if (type === 'register') {
      const existingUser = await User.findByPhone(phone);
      if (existingUser) {
        return res.status(400).json({
          code: 400,
          message: '该手机号已被注册',
          data: null
        });
      }
    }

    // 重置密码时检查手机号是否已注册
    if (type === 'reset_password') {
      const existingUser = await User.findByPhone(phone);
      if (!existingUser) {
        return res.status(400).json({
          code: 400,
          message: '该手机号未注册',
          data: null
        });
      }
    }

    console.log('正在生成验证码...');
    const { code } = await SmsVerificationCode.create(phone, type);

    console.log('正在发送短信...');
    const smsResult = await sendSmsCode(phone, code, type);

    return res.json({
      code: 200,
      message: smsResult.Message || '验证码已发送',
      data: null
    });
  } catch (error) {
    console.error('=== 发送短信验证码失败 ===');
    console.error('错误信息:', error.message);
    return res.status(500).json({
      code: 500,
      message: error.message || '发送验证码失败',
      data: null
    });
  }
});

/**
 * POST /api/sms/register
 * 手机号验证码注册
 */
router.post('/register', async (req, res) => {
  console.log('=== 收到手机号注册请求 ===');
  console.log('请求体:', { ...req.body, password: '***' });

  try {
    const { phone, password, code, nick_name, nickName, nickname, agreementAccepted, invite_code } = req.body;

    const finalNickName = nick_name || nickName || nickname;

    // 校验用户是否同意协议
    if (!agreementAccepted) {
      return res.status(400).json({
        code: 400,
        message: '请先阅读并同意用户协议和隐私政策',
        data: null
      });
    }

    if (!phone || !password || !code) {
      return res.status(400).json({
        code: 400,
        message: '请填写完整信息',
        data: null
      });
    }

    if (!validatePhone(phone)) {
      return res.status(400).json({
        code: 400,
        message: '请输入有效的手机号',
        data: null
      });
    }

    if (password.length < 6) {
      return res.status(400).json({
        code: 400,
        message: '密码长度不能少于6位',
        data: null
      });
    }

    console.log('正在验证验证码...');
    await SmsVerificationCode.verify(phone, code, 'register');

    console.log('正在检查手机号是否已注册...');
    const existingUser = await User.findByPhone(phone);
    if (existingUser) {
      return res.status(400).json({
        code: 400,
        message: '该手机号已被注册',
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
      nick_name: finalNickName || `用户${phone.slice(-4)}`,
      phone: phone
    });

    let inviteResult = null;
    if (invite_code) {
      inviteResult = await processInviteCode(invite_code, user.id);
    }

    await SmsVerificationCode.markAsUsed(phone, 'register');

    console.log('正在生成token...');
    const payload = { id: user.id, userId: user.id, user_id: user.id };
    const token = generateToken(payload);

    console.log('手机号注册成功:', username);

    return res.json({
      code: 200,
      message: '注册成功',
      data: {
        token: token,
        userInfo: {
          id: user.id,
          username: user.username,
          nick_name: user.nick_name || '',
          avatar_url: user.avatar_url ? (user.avatar_url.startsWith('http') ? user.avatar_url : `${PUBLIC_ORIGIN}${user.avatar_url}`) : null,
          phone: user.phone,
          email: user.email,
          is_admin: user.is_admin || false,
          isAdmin: user.is_admin || false,
          app_user: user.app_user || true,
          symbol: user.symbol,
          points: user.points
        },
        invite_result: inviteResult
      }
    });
  } catch (error) {
    console.error('=== 手机号注册失败 ===');
    console.error('错误信息:', error.message);
    console.error('错误堆栈:', error.stack);
    return res.status(500).json({
      code: 500,
      message: error.message || '注册失败',
      data: null
    });
  }
});

/**
 * POST /api/sms/login
 * 手机号验证码登录（无需密码）
 */
router.post('/login', async (req, res) => {
  console.log('=== 收到手机号验证码登录请求 ===');
  console.log('请求体:', req.body);

  try {
    const { phone, code, agreementAccepted, invite_code } = req.body;

    // 校验用户是否同意协议
    if (!agreementAccepted) {
      return res.status(400).json({
        code: 400,
        message: '请先阅读并同意用户协议和隐私政策',
        data: null
      });
    }

    if (!phone || !code) {
      return res.status(400).json({
        code: 400,
        message: '请输入手机号和验证码',
        data: null
      });
    }

    if (!validatePhone(phone)) {
      return res.status(400).json({
        code: 400,
        message: '请输入有效的手机号',
        data: null
      });
    }

    console.log('正在验证验证码...');
    await SmsVerificationCode.verify(phone, code, 'login');

    console.log('正在查找用户...');
    let user = await User.findByPhone(phone);
    let inviteResult = null;

    if (!user) {
      // 手机号未注册，自动创建账号
      console.log('手机号未注册，自动创建账号');
      const maxUsername = await User.getMaxUsername(true);
      const username = (maxUsername + 1).toString().padStart(3, '0');
      const defaultPassword = await bcrypt.hash('abcd1234', 10);

      user = await User.createWithUsername({
        username,
        password: defaultPassword,
        nick_name: `用户${phone.slice(-4)}`,
        phone: phone
      });
      console.log('自动创建用户成功:', username);

      if (invite_code) {
        inviteResult = await processInviteCode(invite_code, user.id);
      }
    }

    if (invite_code && !inviteResult) {
      inviteResult = await processInviteCode(invite_code, user.id);
    }

    await SmsVerificationCode.markAsUsed(phone, 'login');

    console.log('正在生成token...');
    const payload = { id: user.id, userId: user.id, user_id: user.id };
    const token = generateToken(payload);

    console.log('手机号登录成功:', user.username);

    return res.json({
      code: 200,
      message: '登录成功',
      data: {
        token: token,
        userInfo: {
          id: user.id,
          username: user.username,
          nick_name: user.nick_name || '',
          avatar_url: user.avatar_url ? (user.avatar_url.startsWith('http') ? user.avatar_url : `${PUBLIC_ORIGIN}${user.avatar_url}`) : null,
          phone: user.phone,
          email: user.email,
          is_admin: user.is_admin || false,
          isAdmin: user.is_admin || false,
          app_user: user.app_user || true,
          symbol: user.symbol,
          points: user.points
        },
        invite_result: inviteResult || null
      }
    });
  } catch (error) {
    console.error('=== 手机号验证码登录失败 ===');
    console.error('错误信息:', error.message);
    console.error('错误堆栈:', error.stack);
    return res.status(500).json({
      code: 500,
      message: error.message || '登录失败',
      data: null
    });
  }
});

/**
 * POST /api/sms/reset-password
 * 手机号重置密码
 */
router.post('/reset-password', async (req, res) => {
  console.log('=== 收到手机号重置密码请求 ===');
  console.log('请求体:', { ...req.body, newPassword: '***' });

  try {
    const { phone, code, newPassword } = req.body;

    if (!phone || !code || !newPassword) {
      return res.status(400).json({
        code: 400,
        message: '请填写完整信息',
        data: null
      });
    }

    if (!validatePhone(phone)) {
      return res.status(400).json({
        code: 400,
        message: '请输入有效的手机号',
        data: null
      });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({
        code: 400,
        message: '密码长度不能少于6位',
        data: null
      });
    }

    console.log('正在验证验证码...');
    await SmsVerificationCode.verify(phone, code, 'reset_password');

    console.log('正在查找用户...');
    const user = await User.findByPhone(phone);
    if (!user) {
      return res.status(400).json({
        code: 400,
        message: '该手机号未注册',
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

    await SmsVerificationCode.markAsUsed(phone, 'reset_password');

    console.log('密码重置成功:', user.username);

    return res.json({
      code: 200,
      message: '密码重置成功',
      data: null
    });
  } catch (error) {
    console.error('=== 手机号重置密码失败 ===');
    console.error('错误信息:', error.message);
    return res.status(500).json({
      code: 500,
      message: error.message || '重置密码失败',
      data: null
    });
  }
});

module.exports = router;
