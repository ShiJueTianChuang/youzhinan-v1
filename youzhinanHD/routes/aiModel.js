/**
 * 用户 AI 模型管理路由
 * 路由前缀：/api/user/ai-model
 */
const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const {
  encryptApiKey,
  getUserId,
  getProviderConfig,
  callAIModel,
  db
} = require('../utils/aiService');

/**
 * POST /api/user/ai-model/bind
 * 用户绑定 AI 模型
 */
router.post('/bind', authenticate, async (req, res) => {
  try {
    const userId = getUserId(req);
    const { provider, apiKey, modelName } = req.body;

    if (!provider || !apiKey) {
      return res.status(400).json({
        code: 400,
        message: '缺少必要参数（provider, apiKey）',
        data: null
      });
    }

    // 验证 provider 是否支持
    const supportedProviders = ['doubao', 'openai', 'deepseek', 'qwen', 'kimi', 'glm'];
    if (!supportedProviders.includes(provider)) {
      return res.status(400).json({
        code: 400,
        message: `不支持的服务商：${provider}，支持：${supportedProviders.join(', ')}`,
        data: null
      });
    }

    // 获取 provider 默认模型名
    const providerConfig = getProviderConfig(provider);
    const finalModelName = modelName || providerConfig.defaultModel;

    // 验证 API Key 有效性（尝试调用一次，失败不阻止绑定）
    try {
      await callAIModel(apiKey, providerConfig.url, finalModelName, '你好');
      console.log('API Key 验证成功, provider:', provider, 'model:', finalModelName);
    } catch (verifyErr) {
      console.warn('API Key 预验证失败，但仍允许绑定:', verifyErr.message);
      // 不阻止绑定，用户可能在聊天时会收到错误提示
    }

    // 加密存储 API Key
    const encryptedKey = encryptApiKey(apiKey);

    // 检查是否已绑定（upsert）
    const [existing] = await db.query(
      'SELECT id FROM user_ai_model WHERE user_id = ?',
      [userId]
    );

    let result;
    if (existing.length > 0) {
      await db.query(
        'UPDATE user_ai_model SET provider = ?, api_key = ?, model_name = ?, is_active = 1, updated_at = NOW() WHERE user_id = ?',
        [provider, encryptedKey, finalModelName, userId]
      );
      result = { id: existing[0].id };
    } else {
      const [insertResult] = await db.query(
        'INSERT INTO user_ai_model (user_id, provider, api_key, model_name, is_active) VALUES (?, ?, ?, ?, 1)',
        [userId, provider, encryptedKey, finalModelName]
      );
      result = { id: insertResult.insertId };
    }

    res.json({
      code: 200,
      message: '绑定成功',
      data: {
        id: result.id,
        provider: provider,
        modelName: finalModelName,
        bindTime: Math.floor(Date.now() / 1000)
      }
    });
  } catch (error) {
    console.error('绑定 AI 模型失败:', error.message);
    res.status(500).json({
      code: 500,
      message: error.message || '绑定失败',
      data: null
    });
  }
});

/**
 * POST /api/user/ai-model/unbind
 * 用户解绑 AI 模型
 */
router.post('/unbind', authenticate, async (req, res) => {
  try {
    const userId = getUserId(req);

    const [result] = await db.query(
      'DELETE FROM user_ai_model WHERE user_id = ?',
      [userId]
    );

    if (result.affectedRows === 0) {
      return res.status(400).json({
        code: 400,
        message: '未绑定 AI 模型',
        data: null
      });
    }

    res.json({
      code: 200,
      message: '解绑成功',
      data: null
    });
  } catch (error) {
    console.error('解绑 AI 模型失败:', error.message);
    res.status(500).json({
      code: 500,
      message: error.message || '解绑失败',
      data: null
    });
  }
});

/**
 * GET /api/user/ai-model/status
 * 查询用户 AI 模型绑定状态
 */
router.get('/status', authenticate, async (req, res) => {
  try {
    const userId = getUserId(req);

    const [rows] = await db.query(
      'SELECT provider, model_name, is_active, created_at FROM user_ai_model WHERE user_id = ?',
      [userId]
    );

    if (rows.length === 0) {
      return res.json({
        code: 200,
        message: 'success',
        data: {
          isBound: false,
          provider: null,
          modelName: null,
          bindTime: null
        }
      });
    }

    const config = rows[0];
    res.json({
      code: 200,
      message: 'success',
      data: {
        isBound: true,
        provider: config.provider,
        modelName: config.model_name,
        bindTime: Math.floor(new Date(config.created_at).getTime() / 1000)
      }
    });
  } catch (error) {
    console.error('查询 AI 模型状态失败:', error.message);
    res.status(500).json({
      code: 500,
      message: error.message || '查询失败',
      data: null
    });
  }
});

module.exports = router;
