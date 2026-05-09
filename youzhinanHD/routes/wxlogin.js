const express = require('express');
const router = express.Router();
const { getSessionInfo, getDefaultAppId, getSupportedAppIds } = require('../utils/wechat');
const User = require('../models/user');
const { generateToken } = require('../middleware/auth');
const fs = require('fs');
const path = require('path');
const axios = require('axios');

// 错误码定义
const ERROR_CODES = {
  INVALID_CODE: { code: 40001, message: '无效的登录凭证' },
  WX_API_ERROR: { code: 40002, message: '微信接口调用失败' },
  TOKEN_EXPIRED: { code: 40003, message: 'Token已过期' },
  UNAUTHORIZED: { code: 40004, message: '未授权访问' },
  SERVER_ERROR: { code: 50000, message: '服务器内部错误' }
};

/**
 * POST /api/wxlogin/login
 * 微信登录接口
 */
router.post('/login', async (req, res) => {
  try {
    console.log('===== 接收到微信登录请求 =====');
    console.log('请求体:', JSON.stringify(req.body, null, 2));
    console.log('请求IP:', req.ip);
    console.log('请求Headers:', JSON.stringify(req.headers, null, 2));
    
    const { code, appid, nickName, avatarUrl, agreementAccepted } = req.body;

    // 校验用户是否同意协议（兼容旧版小程序前端未传该字段的情况）
    if (agreementAccepted === false) {
      return res.status(400).json({
        code: 400,
        message: '请先阅读并同意用户协议和隐私政策',
        data: null
      });
    }

    // 验证 code 参数
    if (!code || typeof code !== 'string') {
      console.error('缺少或无效的 code 参数');
      return res.status(400).json({
        code: ERROR_CODES.INVALID_CODE.code,
        message: '缺少或无效的登录凭证 code',
        data: null
      });
    }

    console.log('✓ code 参数有效:', code);
    console.log('✓ appid:', appid || '使用默认');
    console.log('✓ nickName:', nickName || '未提供');
    console.log('✓ avatarUrl:', avatarUrl || '未提供');
    
    // 调用微信 API 获取 session_info
    let sessionInfo;
    try {
      console.log('正在调用微信 API 获取 session_info...');
      sessionInfo = await getSessionInfo(code, appid || null);
      console.log('✓ 微信 API 调用成功');
      console.log('sessionInfo:', {
        openid: sessionInfo.openid,
        unionid: sessionInfo.unionid || '无',
        appid: sessionInfo.appid
      });
    } catch (error) {
      console.error('✗ 微信 API 调用失败:', error.message);
      return res.status(400).json({
        code: ERROR_CODES.WX_API_ERROR.code,
        message: `微信接口调用失败：${error.message}`,
        data: null
      });
    }

    const { openid, unionid } = sessionInfo;
    console.log('✓ openid:', openid);
    
    // 处理用户信息（昵称和头像）
    const userNickName = nickName || null;
    let userAvatarUrl = avatarUrl || null;
    
    console.log('用户昵称:', userNickName || '未提供');
    console.log('用户头像:', userAvatarUrl || '未提供');
    
    // 检查是否是临时路径（微信小程序临时文件）
    // 注意：微信小程序的头像 URL 是临时的，我们需要处理它
    // 创建头像存储目录
    const avatarDir = path.join(__dirname, '..', 'public', 'avatars');
    if (!fs.existsSync(avatarDir)) {
      fs.mkdirSync(avatarDir, { recursive: true, mode: 0o755 });
      console.log('创建头像存储目录:', avatarDir);
    }
    
    // 下载并保存头像的函数
    async function downloadAndSaveAvatar(avatarUrl, userId) {
      try {
        // 检查是否是有效的 URL
        if (!avatarUrl || typeof avatarUrl !== 'string') {
          console.log('无效的头像 URL:', avatarUrl);
          return null;
        }
        
        // 检查是否是微信小程序临时链接（这些链接会过期，不能直接使用）
        // 微信小程序临时链接格式：wxfile://tmp_xxx、http://tmp/xxx、https://tmp/xxx
        if (avatarUrl.includes('tmp/') || avatarUrl.includes('tmp.wx') || 
            avatarUrl.includes('http://tmp/') || avatarUrl.includes('wxfile://tmp_')) {
          console.log('检测到微信小程序临时链接，拒绝保存:', avatarUrl);
          return null; // 返回 null，让前端知道需要重新上传
        }
        
        // 检查是否是本地服务器的图片链接
        if (avatarUrl.includes('your-domain.com') || avatarUrl.includes('localhost') || avatarUrl.includes('127.0.0.1')) {
          console.log('检测到本地服务器图片链接，直接使用:', avatarUrl);
          return avatarUrl;
        }
        
        // 检查是否已经是本地路径
        if (!avatarUrl.startsWith('http')) {
          console.log('检测到本地路径，直接使用:', avatarUrl);
          return avatarUrl;
        }
        
        // 生成唯一的文件名
        const fileName = `avatar_${userId}_${Date.now()}.jpg`;
        const filePath = path.join(avatarDir, fileName);
        
        // 下载头像
        console.log('开始下载头像:', avatarUrl);
        const response = await axios.get(avatarUrl, { responseType: 'stream' });
        
        // 保存头像到服务器
        const writer = fs.createWriteStream(filePath);
        response.data.pipe(writer);
        
        return new Promise((resolve, reject) => {
          writer.on('finish', () => {
            // 返回相对于 public 目录的路径
            const savedPath = `/avatars/${fileName}`;
            console.log('头像下载并保存成功，保存路径:', savedPath);
            resolve(savedPath);
          });
          writer.on('error', reject);
        });
      } catch (error) {
        console.error('下载头像失败:', error.message);
        console.error('错误堆栈:', error.stack);
        return null; // 下载失败返回 null，不保存临时链接
      }
    }
    // 检查是否是微信小程序临时链接（这些链接会过期，不能直接使用）
    // 微信小程序临时链接格式：wxfile://tmp_xxx、http://tmp/xxx、https://tmp/xxx
    const isTempAvatar = userAvatarUrl && (
      userAvatarUrl.includes('tmp/') || 
      userAvatarUrl.includes('tmp.wx') || 
      userAvatarUrl.includes('http://tmp/') ||
      userAvatarUrl.includes('wxfile://tmp_')
    );
    
    if (isTempAvatar) {
      console.log('检测到微信小程序临时头像链接，将在响应中提示前端重新上传:', userAvatarUrl);
    }
    
    // 5. 查找或创建用户
    let user;
    try {
      console.log('正在查找用户...');
      user = await User.findByOpenid(openid);
      if (user) {
        console.log('✓ 找到现有用户:', {
          id: user.id,
          username: user.username,
          nick_name: user.nick_name
        });
      } else {
        console.log('○ 用户不存在，准备创建新用户');
      }
    } catch (error) {
      console.error('✗ 查找用户失败:', error.message);
      throw error;
    }
    
    if (!user) {
      // 用户不存在，创建新用户
      console.log('正在创建新用户...');
      try {
        user = await User.create({ 
          openid, 
          unionid, 
          nick_name: userNickName, 
          avatar_url: null // 创建时暂不存储头像，等待后续处理
        });
        console.log('✓ 创建新用户成功:', {
          id: user.id,
          openid: user.openid,
          nick_name: user.nick_name
        });
      } catch (error) {
        console.error('✗ 创建用户失败:', error.message);
        throw error;
      }
    } else {
      // 用户已存在，记录登录日志
      console.log('○ 用户已存在，记录登录');
    }
    
    // 处理头像下载和保存
    let savedAvatarUrl = null;
    
    if (userAvatarUrl && !isTempAvatar && (userAvatarUrl.startsWith('http://') || userAvatarUrl.startsWith('https://'))) {
      // 检测到网络头像路径且不是临时链接，下载并保存
      console.log('检测到网络头像路径，开始下载并保存');
      try {
        const savedPath = await downloadAndSaveAvatar(userAvatarUrl, user.id);
        if (savedPath) {
          savedAvatarUrl = savedPath;
          console.log('头像下载并保存成功:', savedAvatarUrl);
        } else {
          console.log('头像下载失败，不保存头像');
        }
      } catch (error) {
        console.error('头像处理过程中出错:', error.message);
        console.log('头像处理失败，不保存头像');
      }
    } else if (userAvatarUrl && !isTempAvatar) {
      // 非网络URL且不是临时链接，直接使用
      console.log('使用非网络头像URL:', userAvatarUrl);
      savedAvatarUrl = userAvatarUrl;
    } else if (isTempAvatar) {
      console.log('跳过临时头像链接保存');
    } else {
      console.log('没有提供头像URL');
    }
    
    console.log('处理头像后的savedAvatarUrl:', savedAvatarUrl);
    console.log('用户昵称:', userNickName);
    
    // 无论是否有昵称或头像，都尝试更新用户信息
    console.log('准备更新用户信息');
    try {
      // 构建更新数据
      const updateData = { wx_openid: user.openid };
      if (userNickName) {
        updateData.nick_name = userNickName;
        console.log('准备更新用户昵称:', userNickName);
      }
      if (savedAvatarUrl) {
        updateData.avatar_url = savedAvatarUrl;
        console.log('准备更新用户头像:', savedAvatarUrl);
      }
      
      console.log('更新数据:', updateData);
      
      // 检查是否有要更新的字段
      if (Object.keys(updateData).length > 1) { // 至少有一个非wx_openid字段
        user = await User.update(user.id, updateData);
        console.log(`更新用户信息成功: ${user.id}`);
        console.log(`更新后的用户昵称: ${user.nick_name}`);
        console.log(`更新后的用户头像: ${user.avatar_url}`);
      } else {
        console.log('没有需要更新的用户信息字段');
      }
    } catch (error) {
      console.error('更新用户信息失败:', error.message);
      console.error('错误堆栈:', error.stack);
      // 继续执行，不抛出错误，确保登录流程完成
    }
    
    console.log('返回响应前的用户信息:', {
      id: user.id,
      openid: user.openid,
      nick_name: user.nick_name,
      avatar_url: user.avatar_url,
      is_admin: user.is_admin
    });

    // 5. 生成 JWT Token
    const payload = {
      id: user.id,
      userId: user.id,
      user_id: user.id,
      openid: user.openid,
      wx_openid: user.wx_openid || user.openid
    };
    
    const token = generateToken(payload);
    console.log('✓ Token 生成成功');

    // 6. 返回响应
    console.log('===== 登录成功，返回响应 =====');
    return res.json({
      code: 200,
      message: '登录成功',
      data: {
        token: token,
        userInfo: {
          id: user.id,
          openid: user.openid,
          username: user.username,
          nick_name: user.nick_name,
          avatar_url: user.avatar_url,
          hasProfile: !!(user.nick_name && user.avatar_url),
          is_admin: user.is_admin || false,
          isAdmin: user.is_admin || false
        },
        avatarWarning: isTempAvatar ? '检测到临时头像链接，请使用 wx.uploadFile 上传头像文件' : undefined
      }
    });

  } catch (error) {
    console.error('微信登录失败:', error.message);
    return res.status(500).json({
      code: ERROR_CODES.SERVER_ERROR.code,
      message: ERROR_CODES.SERVER_ERROR.message,
      data: null
    });
  }
});

/**
 * POST /api/wxlogin/userinfo
 * 获取/更新用户详情
 */
router.post('/userinfo', async (req, res) => {
  try {
    const userData = req.body;
    const { userId, openid } = userData;

    // 验证用户标识
    if (!userId && !openid) {
      return res.status(400).json({
        code: 400,
        message: '缺少用户标识参数',
        data: null
      });
    }

    // 验证用户数据格式，支持多种字段名格式
    const { nickName, avatarUrl, nickname, avatar, userInfo } = userData;
    
    // 处理嵌套的userInfo对象
    const nestedUserInfo = userInfo || {};
    const nestedNickName = nestedUserInfo.nickName || nestedUserInfo.nickname;
    const nestedAvatarUrl = nestedUserInfo.avatarUrl || nestedUserInfo.avatar;
    
    // 优先级：直接字段 > 嵌套在userInfo中的字段
    const userNickName = nickName || nickname || nestedNickName;
    const userAvatarUrl = avatarUrl || avatar || nestedAvatarUrl;

    console.log('接收到的用户数据:', userData);
    console.log('处理后的用户昵称:', userNickName);
    console.log('处理后的用户头像:', userAvatarUrl);

    // 查找用户
    let user;
    if (userId) {
      user = await User.findById(userId);
    } else if (openid) {
      user = await User.findByOpenid(openid);
    }
    
    if (!user) {
      console.log(`用户不存在: ${userId || openid}`);
      return res.status(404).json({
        code: 404,
        message: '用户不存在',
        data: null
      });
    }

    const actualUserId = user.id;

    // 创建头像存储目录
    const avatarDir = path.join(__dirname, '..', 'public', 'avatars');
    if (!fs.existsSync(avatarDir)) {
      fs.mkdirSync(avatarDir, { recursive: true, mode: 0o755 });
      console.log('创建头像存储目录:', avatarDir);
    }
    
    // 下载并保存头像的函数
    async function downloadAndSaveAvatar(avatarUrl, userId) {
      try {
        // 检查是否是有效的URL
        if (!avatarUrl || typeof avatarUrl !== 'string' || !avatarUrl.startsWith('http')) {
          console.log('无效的头像URL:', avatarUrl);
          return null;
        }
        
        // 生成唯一的文件名
        const fileName = `avatar_${userId}_${Date.now()}.jpg`;
        const filePath = path.join(avatarDir, fileName);
        
        // 下载头像
        const response = await axios.get(avatarUrl, { responseType: 'stream' });
        
        // 保存头像到服务器
        const writer = fs.createWriteStream(filePath);
        response.data.pipe(writer);
        
        return new Promise((resolve, reject) => {
          writer.on('finish', () => {
            // 返回相对于public目录的路径
            resolve(`/avatars/${fileName}`);
          });
          writer.on('error', reject);
        });
      } catch (error) {
        console.error('下载头像失败:', error.message);
        return null;
      }
    }
    
    let savedAvatarUrl = userAvatarUrl;
    
    if (userAvatarUrl && (userAvatarUrl.startsWith('http://') || userAvatarUrl.startsWith('https://'))) {
      // 检测到网络头像路径，下载并保存
      console.log('检测到网络头像路径，开始下载并保存');
      const savedPath = await downloadAndSaveAvatar(userAvatarUrl, actualUserId);
      if (savedPath) {
        savedAvatarUrl = savedPath;
        console.log('头像下载并保存成功:', savedPath);
      } else {
        console.log('头像下载失败，使用原始路径');
      }
    }
    
    // 无论是否有昵称或头像，都尝试更新用户信息
    console.log('准备更新用户信息');
    try {
      // 构建更新数据
      const updateData = { wx_openid: user.openid };
      if (userNickName) {
        updateData.nick_name = userNickName;
      }
      if (savedAvatarUrl) {
        updateData.avatar_url = savedAvatarUrl;
      }
      
      console.log('更新数据:', updateData);
      user = await User.update(actualUserId, updateData);
      console.log(`更新用户信息成功: ${actualUserId}`);
      console.log(`更新后的用户昵称: ${user.nick_name}`);
      console.log(`更新后的用户头像: ${user.avatar_url}`);
    } catch (error) {
      console.error('更新用户信息失败:', error.message);
      throw error;
    }

    // 返回安全的用户信息
    const safeUserInfo = User.getSafeUserInfo(user);
    return res.json({
      code: 200,
      message: '获取用户信息成功',
      data: {
        userInfo: safeUserInfo
      }
    });

  } catch (error) {
    console.error('获取/更新用户信息失败:', error.message);
    return res.status(500).json({
      code: ERROR_CODES.SERVER_ERROR.code,
      message: ERROR_CODES.SERVER_ERROR.message,
      data: null
    });
  }
});

/**
 * GET /api/wxlogin/test
 * 测试接口，用于验证微信登录功能是否正常
 */
router.get('/test', (req, res) => {
  return res.json({
    code: 200,
    message: '微信登录服务正常运行',
    data: {
      timestamp: new Date().toISOString(),
      service: '微信登录服务',
      status: 'running'
    }
  });
});

router.get('/miniprograms', (req, res) => {
  const appids = getSupportedAppIds();
  const defaultAppId = getDefaultAppId();
  
  return res.json({
    code: 200,
    message: '获取成功',
    data: {
      count: appids.length,
      defaultAppId: defaultAppId,
      appids: appids
    }
  });
});

module.exports = router;
