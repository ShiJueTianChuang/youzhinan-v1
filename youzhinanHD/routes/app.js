const express = require('express');
const router = express.Router();
const User = require('../models/user');
const { generateToken, authenticate } = require('../middleware/auth');
const bcrypt = require('bcryptjs');
const db = require('../config/db');
require('dotenv').config();

const PUBLIC_ORIGIN = (process.env.PUBLIC_ORIGIN || 'https://your-domain.com').replace(/\/$/, '');

const crypto = require('crypto');

function generateDefaultPassword() {
  return crypto.randomBytes(8).toString('hex');
}

/**
 * POST /api/app/quick-register
 * APP快速注册接口 - 支持灵活的用户信息
 * 不强制任何字段，可以只传昵称/头像，也可以传手机号/邮箱
 * 返回自动生成的账号和默认密码 (abcd1234)
 */
router.post('/quick-register', async (req, res) => {
  console.log('=== 收到APP快速注册请求 ===');
  console.log('请求体:', req.body);
  
  try {
    const { nick_name, nickName, nickname, avatar_url, avatarUrl, avatar, phone, email, agreementAccepted, invite_code } = req.body;

    // 校验用户是否同意协议
    if (!agreementAccepted) {
      return res.status(400).json({
        code: 400,
        message: '请先阅读并同意用户协议和隐私政策',
        data: null
      });
    }
    
    const userData = {
      nick_name: nick_name || nickName || nickname || null,
      avatar_url: avatar_url || avatarUrl || avatar || null,
      phone: phone || null,
      email: email || null
    };
    
    const { user, username, password } = await User.createAppUser(userData, generateDefaultPassword());

    if (invite_code) {
      try {
        const inviterId = parseInt(invite_code);
        if (!isNaN(inviterId) && inviterId > 0 && inviterId !== user.id) {
          const [inviter] = await db.query('SELECT id FROM users WHERE id = ?', [inviterId]);
          if (inviter.length > 0) {
            const conn = await db.getConnection();
            try {
              await conn.beginTransaction();
              const [existingInvite] = await conn.query('SELECT id FROM user_invitations WHERE invitee_id = ? FOR UPDATE', [user.id]);
              if (existingInvite.length === 0) {
                await conn.execute('INSERT INTO user_invitations (inviter_id, invitee_id) VALUES (?, ?)', [inviterId, user.id]);
                console.log('邀请记录已创建，邀请人:', inviterId);
              }
              await conn.commit();
            } catch (txError) {
              await conn.rollback();
              throw txError;
            } finally {
              conn.release();
            }
          }
        }
      } catch (inviteError) {
        console.error('处理邀请码失败:', inviteError.message);
      }
    }
    
    const payload = {
      id: user.id,
      userId: user.id,
      user_id: user.id
    };
    
    const token = generateToken(payload);
    
    console.log('APP快速注册成功:', username);
    
    return res.json({
      code: 200,
      message: '注册成功',
      data: {
        token: token,
        credentials: {
          username: username,
          password: password
        },
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
        }
      }
    });
  } catch (error) {
    console.error('=== APP快速注册失败 ===');
    console.error('错误信息:', error.message);
    console.error('错误堆栈:', error.stack);
    return res.status(500).json({
      code: 500,
      message: '服务器内部错误: ' + error.message,
      data: null
    });
  }
});

/**
 * POST /api/app/login
 * APP登录接口 - 支持账号/手机号/邮箱 + 密码登录
 */
router.post('/login', async (req, res) => {
  console.log('=== 收到APP登录请求 ===');
  console.log('请求体:', req.body);
  
  try {
    const { account, username, phone, email, password, agreementAccepted } = req.body;

    // 校验用户是否同意协议
    if (!agreementAccepted) {
      return res.status(400).json({
        code: 400,
        message: '请先阅读并同意用户协议和隐私政策',
        data: null
      });
    }

    const finalAccount = account || username || phone || email;

    if (!finalAccount || !password) {
      console.log('错误: 缺少账号或密码');
      return res.status(400).json({
        code: 400,
        message: '请输入账号和密码',
        data: null
      });
    }

    console.log('正在查找用户:', finalAccount);
    let user = await User.findByIdentifier(finalAccount);
    console.log('查询到的用户:', user);

    let passwordMatch = false;
    if (user) {
      // 微信用户可能未设置密码（password 为空）
      if (!user.password || user.password === '') {
        console.log('该账号未设置密码（可能是微信登录用户）');
        return res.status(401).json({
          code: 401,
          message: '该账号未设置密码，请使用其他方式登录',
          data: null
        });
      }
      console.log('正在验证密码...');
      passwordMatch = await bcrypt.compare(password, user.password);
      console.log('密码验证完成');
    }
    
    if (!user) {
      console.log('错误: 用户不存在');
      return res.status(401).json({
        code: 401,
        message: '用户不存在',
        data: null
      });
    } else if (!passwordMatch) {
      console.log('错误: 密码不匹配');
      return res.status(401).json({
        code: 401,
        message: '密码错误',
        data: null
      });
    }

    const payload = {
      id: user.id,
      userId: user.id,
      user_id: user.id,
      openid: user.openid,
      wx_openid: user.wx_openid || user.openid
    };

    const token = generateToken(payload);
    console.log('登录成功，生成token');

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
          symbol: user.symbol,
          points: user.points
        }
      }
    });
  } catch (error) {
    console.error('=== APP登录失败 ===');
    console.error('错误信息:', error.message);
    console.error('错误堆栈:', error.stack);
    return res.status(500).json({
      code: 500,
      message: '服务器内部错误: ' + error.message,
      data: null
    });
  }
});

/**
 * POST /api/app/reset-password
 * APP重置密码接口
 * 允许用户通过账号/手机号/邮箱重置密码为默认密码
 */
router.post('/reset-password', async (req, res) => {
  console.log('=== 收到APP重置密码请求 ===');
  console.log('请求体:', req.body);
  
  try {
    const { account } = req.body;

    if (!account) {
      console.log('错误: 缺少账号');
      return res.status(400).json({
        code: 400,
        message: '请输入账号/手机号/邮箱',
        data: null
      });
    }

    console.log('正在查找用户:', account);
    const user = await User.findByIdentifier(account);

    if (!user) {
      console.log('错误: 用户不存在');
      return res.status(404).json({
        code: 404,
        message: '用户不存在',
        data: null
      });
    }

    const resetPassword = generateDefaultPassword();
    const hashedPassword = await bcrypt.hash(resetPassword, 10);
    
    await db.query(
      'UPDATE users SET password = ? WHERE id = ?',
      [hashedPassword, user.id]
    );

    console.log('密码重置成功:', user.username);

    return res.json({
      code: 200,
      message: '密码重置成功',
      data: {
        username: user.username,
        newPassword: resetPassword
      }
    });
  } catch (error) {
    console.error('=== APP重置密码失败 ===');
    console.error('错误信息:', error.message);
    console.error('错误堆栈:', error.stack);
    return res.status(500).json({
      code: 500,
      message: '服务器内部错误: ' + error.message,
      data: null
    });
  }
});

/**
 * POST /api/app/change-password
 * APP修改密码接口 - 需要登录
 * 用户修改自己的密码
 */
router.post('/change-password', authenticate, async (req, res) => {
  console.log('=== 收到APP修改密码请求 ===');
  
  try {
    const userId = req.user.id || req.user.userId || req.user.user_id;
    const { oldPassword, newPassword } = req.body;

    if (!oldPassword || !newPassword) {
      console.log('错误: 缺少旧密码或新密码');
      return res.status(400).json({
        code: 400,
        message: '请输入旧密码和新密码',
        data: null
      });
    }

    if (newPassword.length < 6) {
      console.log('错误: 新密码长度不足');
      return res.status(400).json({
        code: 400,
        message: '新密码长度不能少于6位',
        data: null
      });
    }

    console.log('正在查找用户:', userId);
    const user = await User.findById(userId);

    if (!user) {
      console.log('错误: 用户不存在');
      return res.status(404).json({
        code: 404,
        message: '用户不存在',
        data: null
      });
    }

    const oldPasswordMatch = await bcrypt.compare(oldPassword, user.password);
    
    if (!oldPasswordMatch) {
      console.log('错误: 旧密码不正确');
      return res.status(401).json({
        code: 401,
        message: '旧密码不正确',
        data: null
      });
    }

    const hashedNewPassword = await bcrypt.hash(newPassword, 10);
    
    await db.query(
      'UPDATE users SET password = ? WHERE id = ?',
      [hashedNewPassword, userId]
    );

    console.log('密码修改成功:', user.username);

    return res.json({
      code: 200,
      message: '密码修改成功',
      data: null
    });
  } catch (error) {
    console.error('=== APP修改密码失败 ===');
    console.error('错误信息:', error.message);
    console.error('错误堆栈:', error.stack);
    return res.status(500).json({
      code: 500,
      message: '服务器内部错误: ' + error.message,
      data: null
    });
  }
});

/**
 * POST /api/app/register
 * 安卓APP注册接口
 */
router.post('/register', async (req, res) => {
  console.log('=== 收到APP注册请求 ===');
  console.log('请求体:', req.body);
  
  try {
    const { username, password, nick_name, nickName, nickname, phone, email, avatar_url, avatarUrl, avatar, agreementAccepted, invite_code } = req.body;

    // 校验用户是否同意协议
    if (!agreementAccepted) {
      return res.status(400).json({
        code: 400,
        message: '请先阅读并同意用户协议和隐私政策',
        data: null
      });
    }

    const finalNickName = nick_name || nickName || nickname;
    const finalAvatarUrl = avatar_url || avatarUrl || avatar;

    if (!username || !password) {
      console.log('错误: 缺少用户名或密码');
      return res.status(400).json({
        code: 400,
        message: '请填写完整信息',
        data: null
      });
    }

    if (password.length < 6) {
      console.log('错误: 密码长度不足6位');
      return res.status(400).json({
        code: 400,
        message: '密码长度不能少于6位',
        data: null
      });
    }

    console.log('正在检查用户名是否存在:', username);
    const existingUser = await User.findByUsername(username);
    if (existingUser) {
      console.log('错误: 用户名已存在');
      return res.status(400).json({
        code: 400,
        message: '用户名已存在',
        data: null
      });
    }

    console.log('正在加密密码...');
    const hashedPassword = await bcrypt.hash(password, 10);

    console.log('正在创建用户...');
    const user = await User.createWithUsername({
      username,
      password: hashedPassword,
      nick_name: finalNickName || username,
      phone: phone || null,
      email: email || null,
      avatar_url: finalAvatarUrl || null
    });

    console.log('用户创建成功:', user.username);

    if (invite_code) {
      try {
        const inviterId = parseInt(invite_code);
        if (!isNaN(inviterId) && inviterId > 0 && inviterId !== user.id) {
          const [inviter] = await db.query('SELECT id FROM users WHERE id = ?', [inviterId]);
          if (inviter.length > 0) {
            const [existingInvite] = await db.query('SELECT id FROM user_invitations WHERE invitee_id = ?', [user.id]);
            if (existingInvite.length === 0) {
              await db.execute('INSERT INTO user_invitations (inviter_id, invitee_id) VALUES (?, ?)', [inviterId, user.id]);
              console.log('邀请记录已创建，邀请人:', inviterId);
            }
          }
        }
      } catch (inviteError) {
        console.error('处理邀请码失败:', inviteError.message);
      }
    }

    const payload = {
      id: user.id,
      userId: user.id,
      user_id: user.id
    };

    console.log('正在生成token...');
    const token = generateToken(payload);

    console.log('注册成功，返回响应');

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
        }
      }
    });
  } catch (error) {
    console.error('=== APP注册失败 ===');
    console.error('错误信息:', error.message);
    console.error('错误堆栈:', error.stack);
    return res.status(500).json({
      code: 500,
      message: '服务器内部错误: ' + error.message,
      data: null
    });
  }
});

/**
 * POST /api/app/carrier-login
 * 运营商一键登录接口
 */
router.post('/carrier-login', async (req, res) => {
  console.log('=== 收到运营商一键登录请求 ===');
  console.log('请求体:', req.body);
  
  try {
    const { token, carrier, agreementAccepted } = req.body;

    // 校验用户是否同意协议
    if (!agreementAccepted) {
      return res.status(400).json({
        code: 400,
        message: '请先阅读并同意用户协议和隐私政策',
        data: null
      });
    }

    if (!token) {
      console.log('错误: 缺少运营商token');
      return res.status(400).json({
        code: 400,
        message: '缺少运营商token',
        data: null
      });
    }

    console.log('运营商类型:', carrier || 'unknown');
    console.log('运营商token已接收，长度:', token.length);

    let phone = null;

    try {
      phone = await verifyCarrierToken(token, carrier);
      console.log('运营商验证成功，手机号:', phone);
    } catch (verifyError) {
      console.error('运营商token验证失败:', verifyError.message);
      return res.status(400).json({
        code: 400,
        message: '运营商验证失败: ' + verifyError.message,
        data: null
      });
    }

    if (!phone) {
      console.log('错误: 未能获取手机号');
      return res.status(400).json({
        code: 400,
        message: '未能获取手机号',
        data: null
      });
    }

    console.log('正在查找或创建用户，手机号:', phone);
    let user = await User.findByPhone(phone);
    
    if (!user) {
      console.log('用户不存在，创建新用户');
      const maxUsername = await User.getMaxUsername(true);
      const nextUsername = maxUsername + 1;
      const username = nextUsername.toString().padStart(3, '0');
      const defaultPassword = generateDefaultPassword();
      const hashedPassword = await bcrypt.hash(defaultPassword, 10);
      
      user = await User.createWithUsername({
        username,
        password: hashedPassword,
        nick_name: `用户${phone.slice(-4)}`,
        phone: phone
      });
      
      console.log('新用户创建成功:', username);
    } else {
      console.log('用户已存在:', user.username);
    }

    const payload = {
      id: user.id,
      userId: user.id,
      user_id: user.id
    };

    console.log('正在生成token...');
    const authToken = generateToken(payload);

    console.log('运营商一键登录成功');

    return res.json({
      code: 200,
      message: '登录成功',
      data: {
        token: authToken,
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
        }
      }
    });
  } catch (error) {
    console.error('=== 运营商一键登录失败 ===');
    console.error('错误信息:', error.message);
    console.error('错误堆栈:', error.stack);
    return res.status(500).json({
      code: 500,
      message: '服务器内部错误: ' + error.message,
      data: null
    });
  }
});

/**
 * 验证运营商token并获取手机号
 * @param {string} token - 运营商token
 * @param {string} carrier - 运营商类型 (cmcc/unicom/telecom)
 * @returns {Promise<string>} 手机号
 */
async function verifyCarrierToken(token, carrier) {
  const axios = require('axios');
  
  const carrierConfig = {
    cmcc: {
      apiUrl: process.env.CMCC_API_URL || 'https://api.cmcc.com/verify',
      appId: process.env.CMCC_APP_ID || '',
      appSecret: process.env.CMCC_APP_SECRET || ''
    },
    unicom: {
      apiUrl: process.env.UNICOM_API_URL || 'https://api.unicom.com/verify',
      appId: process.env.UNICOM_APP_ID || '',
      appSecret: process.env.UNICOM_APP_SECRET || ''
    },
    telecom: {
      apiUrl: process.env.TELECOM_API_URL || 'https://api.telecom.com/verify',
      appId: process.env.TELECOM_APP_ID || '',
      appSecret: process.env.TELECOM_APP_SECRET || ''
    }
  };

  const config = carrierConfig[carrier] || carrierConfig.cmcc;

  if (!config.appId || !config.appSecret) {
    console.warn('运营商配置未设置，使用演示模式');
    return '138' + Math.floor(Math.random() * 100000000).toString().padStart(8, '0');
  }

  try {
    const response = await axios.post(config.apiUrl, {
      token: token,
      appId: config.appId,
      appSecret: config.appSecret
    }, {
      timeout: 10000
    });

    if (response.data && response.data.code === 200 && response.data.phone) {
      return response.data.phone;
    } else {
      throw new Error(response.data.message || '验证失败');
    }
  } catch (error) {
    console.error('调用运营商API失败:', error.message);
    throw error;
  }
}

/**
 * POST /api/app/wx-login
 * 安卓APP微信登录接口 (如果APP集成了微信SDK)
 */
router.post('/wx-login', async (req, res) => {
  try {
    const { code, appid, nickName, avatarUrl, agreementAccepted } = req.body;

    // 校验用户是否同意协议
    if (!agreementAccepted) {
      return res.status(400).json({
        code: 400,
        message: '请先阅读并同意用户协议和隐私政策',
        data: null
      });
    }

    if (!code) {
      return res.status(400).json({
        code: 400,
        message: '缺少登录凭证',
        data: null
      });
    }

    const { getSessionInfo } = require('../utils/wechat');
    const sessionInfo = await getSessionInfo(code, appid);
    const { openid, unionid } = sessionInfo;

    let user = await User.findByOpenid(openid);

    if (!user) {
      user = await User.create({
        openid,
        unionid,
        username: `wx_${openid.slice(0, 10)}`,
        password: await bcrypt.hash('default123', 10),
        nick_name: nickName || '微信用户',
        avatar_url: avatarUrl || null
      });
    } else {
      if (nickName || avatarUrl) {
        const updateData = {};
        if (nickName) updateData.nick_name = nickName;
        if (avatarUrl) updateData.avatar_url = avatarUrl;
        if (Object.keys(updateData).length > 0) {
          user = await User.update(user.id, updateData);
        }
      }
    }

    const payload = {
      id: user.id,
      userId: user.id,
      user_id: user.id,
      openid: user.openid
    };

    const token = generateToken(payload);

    return res.json({
      code: 200,
      message: '登录成功',
      data: {
        token: token,
        userInfo: {
          id: user.id,
          username: user.username,
          nick_name: user.nick_name || '',
          avatar_url: user.avatar_url,
          is_admin: user.is_admin || false,
          isAdmin: user.is_admin || false
        }
      }
    });
  } catch (error) {
    console.error('APP微信登录失败:', error);
    return res.status(500).json({
      code: 500,
      message: error.message || '服务器内部错误',
      data: null
    });
  }
});

/**
 * GET /api/app/info
 * 获取APP信息列表 - 兼容APP格式
 */
router.get('/info', async (req, res) => {
  console.log('=== 收到APP获取信息列表请求 ===');
  
  try {
    const [rows] = await db.query('SELECT * FROM info ORDER BY id ASC');
    
    const processedRows = rows.map(row => {
      let images = [];
      if (row.images) {
        if (typeof row.images === 'string') {
          try {
            images = JSON.parse(row.images);
            if (!Array.isArray(images)) images = [];
          } catch (e) {
            images = [];
          }
        } else if (Array.isArray(row.images)) {
          images = row.images;
        }
      }
      
      const fullImages = images.map(img => {
        if (img.startsWith('http')) return img;
        return `${PUBLIC_ORIGIN}${img}`;
      });
      
      return {
        id: row.id,
        store_name: row.store_name,
        category: row.category,
        province: row.province,
        city: row.city,
        district: row.district,
        address: row.address,
        contact: row.contact,
        description: row.description || '',
        business_hours: row.business_hours || '',
        price: row.price ? parseFloat(row.price) : 0,
        images: fullImages,
        latitude: row.latitude ? parseFloat(row.latitude) : 0,
        longitude: row.longitude ? parseFloat(row.longitude) : 0,
        rating: row.rating ? parseInt(row.rating) : 0,
        view_count: row.view_count ? parseInt(row.view_count) : 0,
        created_at: row.created_at,
        updated_at: row.updated_at
      };
    });
    
    console.log(`返回 ${processedRows.length} 条信息给APP`);
    
    return res.json({
      code: 200,
      message: '获取成功',
      data: processedRows
    });
  } catch (error) {
    console.error('=== APP获取信息列表失败 ===');
    console.error('错误信息:', error.message);
    return res.status(500).json({
      code: 500,
      message: '服务器内部错误',
      data: null
    });
  }
});

/**
 * GET /api/app/config
 * 获取APP配置信息
 */
router.get('/config', (req, res) => {
  return res.json({
    code: 200,
    message: '获取成功',
    data: {
      apiVersion: '1.0.0',
      serverTime: new Date().toISOString(),
      features: {
        lottery: true,
        favorites: true,
        messages: true,
        imageUpload: true
      }
    }
  });
});

/**
 * GET /api/app/agreement
 * 获取用户服务协议（公开接口，无需登录）
 */
router.get('/agreement', async (req, res) => {
  try {
    const [rows] = await db.query('SELECT * FROM about_settings WHERE type = ?', ['agreement']);
    if (rows.length > 0) {
      return res.json({
        code: 200,
        message: '获取成功',
        data: {
          title: rows[0].title,
          content: rows[0].content
        }
      });
    } else {
      return res.json({
        code: 200,
        message: '获取成功',
        data: {
          title: '用户服务协议',
          content: '暂无协议内容'
        }
      });
    }
  } catch (error) {
    console.error('获取用户协议失败:', error);
    return res.status(500).json({
      code: 500,
      message: '服务器内部错误',
      data: null
    });
  }
});

/**
 * GET /api/app/privacy
 * 获取隐私政策（公开接口，无需登录）
 */
router.get('/privacy', async (req, res) => {
  try {
    const [rows] = await db.query('SELECT * FROM about_settings WHERE type = ?', ['privacy']);
    if (rows.length > 0) {
      return res.json({
        code: 200,
        message: '获取成功',
        data: {
          title: rows[0].title,
          content: rows[0].content
        }
      });
    } else {
      return res.json({
        code: 200,
        message: '获取成功',
        data: {
          title: '隐私政策',
          content: '暂无隐私政策内容'
        }
      });
    }
  } catch (error) {
    console.error('获取隐私政策失败:', error);
    return res.status(500).json({
      code: 500,
      message: '服务器内部错误',
      data: null
    });
  }
});

module.exports = router;

module.exports = router;
