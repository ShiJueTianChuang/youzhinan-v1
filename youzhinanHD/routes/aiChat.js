/**
 * AI 聊天路由
 * 路由前缀：/api/ai
 */
const express = require('express');
const axios = require('axios');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const {
  decryptApiKey,
  getUserId,
  getProviderConfig,
  callAIModel,
  callAIModelWithImage,
  callAIModelForFile,
  callAIModelForFileStream,
  DEFAULT_API_KEY,
  DEFAULT_API_URL,
  DEFAULT_MODEL,
  DEFAULT_SYSTEM_PROMPT,
  db
} = require('../utils/aiService');
const { extractTextFromFile, getFileCategory } = require('../utils/documentParser');

// 常见问题缓存（快速回复，仅对平台默认模型生效）
const FAQ_CACHE = {
  '你好': '您好！我是壹问，有什么可以帮助您的吗？😊',
  '您好': '您好！很高兴为您服务，请问有什么需要帮助的吗？',
  'hello': 'Hello! I\'m Yiwen, your intelligent assistant. How can I help you today? 😊',
  'hi': 'Hi there! I\'m Yiwen, how can I assist you today?',
  '你是谁': '我是壹问，是有壹有伴平台的 AI 智能助手，专门为您提供咨询和帮助服务。',
  '你是谁？': '我是壹问，是有壹有伴平台的 AI 智能助手。',
  '你叫什么': '我叫壹问，很高兴认识你！',
  '你叫什么名字': '我叫壹问，是有壹有伴的智能助手！',
  '谢谢': '不客气！能帮到您我很开心，有任何问题随时找我哦！😊',
  '谢谢你': '不客气！这是我应该做的，有问题随时来找我！😊',
  '感谢': '不用客气！能帮到您是我的荣幸，祝您一切顺利！',
  '再见': '再见！祝您有美好的一天，欢迎下次再来！👋',
  '拜拜': '拜拜！下次见！👋',
  '88': '拜拜！下次见！👋',
  '晚安': '晚安！祝您做个好梦！🌙',
  '早安': '早上好！祝您今天充满活力！☀️',
  '早上好': '早上好！祝您今天充满活力！☀️',
  '下午好': '下午好！祝您下午愉快！',
  '在吗': '我在的！随时为您服务，请问有什么需要帮助的？',
  '有人吗': '有的！我在这里，请问有什么可以帮您？',
  'help': 'I\'m here to help! What do you need assistance with?',
  'help me': 'Of course! I\'m here to help. What do you need?',
  'who are you': 'I\'m Yiwen, an AI assistant, here to help you with any questions or tasks.',
  'what is your name': 'My name is Yiwen! Nice to meet you!',
  'thank you': 'You\'re welcome! I\'m always here to help. 😊',
  'thanks': 'You\'re welcome! Feel free to ask me anything! 😊'
};

// 获取服务商中文名
function getProviderName(provider) {
  const names = {
    doubao: '豆包',
    kimi: '月之暗面',
    openai: 'OpenAI',
    deepseek: '深度求索',
    qwen: '通义千问',
    glm: '智谱AI'
  };
  return names[provider] || provider;
}

/**
 * POST /api/ai/chat
 * AI 聊天接口
 */
router.post('/chat', authenticate, async (req, res) => {
  try {
    const { message, useCustomModel = false, conversationHistory = [], enableThinking = false } = req.body;
    const userId = getUserId(req);

    if (!message || !message.trim()) {
      return res.status(400).json({ code: 400, message: '消息内容不能为空', data: null });
    }

    const trimmedMessage = message.trim();
    
    // 检查是否是常见问题（快速回复，仅对平台默认模型生效）
    if (!useCustomModel) {
      const cachedReply = FAQ_CACHE[trimmedMessage] || FAQ_CACHE[trimmedMessage.toLowerCase()];
      if (cachedReply) {
        return res.json({
          code: 200,
          message: 'success',
          data: {
            reply: cachedReply,
            model: 'faq-cache',
            timestamp: Math.floor(Date.now() / 1000)
          }
        });
      }
    }

    if (!Array.isArray(conversationHistory)) {
      return res.status(400).json({ code: 400, message: 'conversationHistory 必须是数组', data: null });
    }

    const MAX_HISTORY = 20;
    const trimmedHistory = conversationHistory.slice(-MAX_HISTORY);

    let apiKey, apiUrl, model;

    if (useCustomModel) {
      // 使用用户自定义模型
      const [rows] = await db.query(
        'SELECT provider, api_key, model_name FROM user_ai_model WHERE user_id = ? AND is_active = 1',
        [userId]
      );

      if (rows.length === 0) {
        return res.status(400).json({
          code: 400,
          message: '未绑定自定义 AI 模型，请先绑定或使用平台默认模型',
          data: null
        });
      }

      const userConfig = rows[0];
      const decryptedKey = decryptApiKey(userConfig.api_key);
      if (!decryptedKey) {
        return res.status(400).json({
          code: 400,
          message: 'API Key 解密失败，请重新绑定',
          data: null
        });
      }

      const providerConfig = getProviderConfig(userConfig.provider);
      apiKey = decryptedKey;
      apiUrl = providerConfig.url;
      if (enableThinking && providerConfig.reasoningModel) {
        model = providerConfig.reasoningModel;
      } else {
        model = userConfig.model_name || providerConfig.defaultModel;
      }
    } else {
      // 使用平台默认模型
      if (!DEFAULT_API_KEY) {
        return res.status(500).json({
          code: 500,
          message: '平台 AI 服务未配置',
          data: null
        });
      }
      apiKey = DEFAULT_API_KEY;
      apiUrl = DEFAULT_API_URL;
      if (enableThinking) {
        const providerConfig = getProviderConfig('doubao');
        model = providerConfig.reasoningModel;
        console.log('[SSE流] 开启深度思考，使用模型:', model);
      } else {
        model = DEFAULT_MODEL;
      }
    }

    // 调用 AI 模型（带超时重试）
    const result = await callAIModel(apiKey, apiUrl, model, trimmedMessage, trimmedHistory, DEFAULT_SYSTEM_PROMPT);

    res.json({
      code: 200,
      message: 'success',
      data: {
        reply: result.reply,
        thinking: result.thinking || '',
        model: result.model,
        timestamp: Math.floor(Date.now() / 1000)
      }
    });
  } catch (error) {
    console.error('AI 聊天失败:', error.message);

    if (error.response) {
      const status = error.response.status;
      const errMsg = error.response.data?.error?.message || error.response.data?.message || 'AI 服务请求失败';

      if (status === 401 || status === 403) {
        return res.status(400).json({
          code: 400,
          message: req.body.useCustomModel ? '自定义 API Key 无效，请检查配置' : '平台 AI 服务认证失败',
          data: null
        });
      }
      if (status === 429) {
        return res.status(429).json({
          code: 429,
          message: 'AI 服务请求过于频繁，请稍后再试',
          data: null
        });
      }
      return res.status(500).json({
        code: 500,
        message: `AI 服务错误：${errMsg}`,
        data: null
      });
    }

    res.status(500).json({
      code: 500,
      message: error.message || 'AI 聊天服务异常',
      data: null
    });
  }
});

/**
 * POST /api/ai/chat-stream
 * AI 聊天流式接口（SSE）
 */
router.post('/chat-stream', authenticate, async (req, res) => {
  try {
    const { message, useCustomModel = false, conversationHistory = [], enableThinking = false } = req.body;
    const userId = getUserId(req);

    if (!message || !message.trim()) {
      return res.status(400).json({ code: 400, message: '消息内容不能为空' });
    }

    const trimmedMessage = message.trim();
    
    // 检查是否是常见问题（快速回复，仅对平台默认模型生效）
    if (!useCustomModel) {
      const cachedReply = FAQ_CACHE[trimmedMessage] || FAQ_CACHE[trimmedMessage.toLowerCase()];
      if (cachedReply) {
        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');
        
        res.write(`data: ${JSON.stringify({ 
          type: 'complete', 
          content: cachedReply,
          model: 'faq-cache'
        })}\n\n`);
        res.write('data: [DONE]\n\n');
        return res.end();
      }
    }

    const parsedHistory = typeof conversationHistory === 'string' ? JSON.parse(conversationHistory) : 
                          (Array.isArray(conversationHistory) ? conversationHistory : []);
    const trimmedHistory = parsedHistory.slice(-20);

    let apiKey, apiUrl, model, useReasoningModel = false;
    let customDefaultModel = null;
    let isCustomModel = false;
    let customProvider = null;

    if (useCustomModel) {
      isCustomModel = true;
      const [rows] = await db.query(
        'SELECT provider, api_key, model_name FROM user_ai_model WHERE user_id = ? AND is_active = 1',
        [userId]
      );

      if (rows.length === 0) {
        return res.status(400).json({ code: 400, message: '未绑定自定义 AI 模型' });
      }

      const userConfig = rows[0];
      const decryptedKey = decryptApiKey(userConfig.api_key);
      if (!decryptedKey) {
        return res.status(400).json({ code: 400, message: 'API Key 解密失败' });
      }

      const providerConfig = getProviderConfig(userConfig.provider);
      apiKey = decryptedKey;
      apiUrl = providerConfig.url;
      customProvider = userConfig.provider;
      customDefaultModel = userConfig.model_name || providerConfig.defaultModel;
      if (enableThinking && providerConfig.reasoningModel) {
        model = providerConfig.reasoningModel;
        useReasoningModel = true;
      } else {
        model = customDefaultModel;
      }
    } else {
      if (!DEFAULT_API_KEY) {
        return res.status(500).json({ code: 500, message: '平台 AI 服务未配置' });
      }
      apiKey = DEFAULT_API_KEY;
      apiUrl = DEFAULT_API_URL;
      if (enableThinking) {
        const providerConfig = getProviderConfig('doubao');
        model = providerConfig.reasoningModel;
        useReasoningModel = true;
        console.log('[SSE流] 尝试深度思考模型:', model);
      } else {
        model = DEFAULT_MODEL;
      }
    }

    // 设置 SSE 响应头
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');

    const messages = [];
    if (DEFAULT_SYSTEM_PROMPT) {
      messages.push({ role: 'system', content: DEFAULT_SYSTEM_PROMPT });
    }
    messages.push(...trimmedHistory);
    messages.push({ role: 'user', content: trimmedMessage });

    const requestBody = {
      model: model,
      messages: messages,
      temperature: 0.7,
      max_tokens: 2048,
      stream: true
    };

    if (isCustomModel) {
      console.log('[SSE流] 自定义模型请求参数:', {
        provider: customProvider,
        model: model,
        apiUrl: apiUrl.substring(0, 60),
        apiKeyPrefix: apiKey?.substring(0, 10) + '...',
        enableThinking: enableThinking,
        useReasoningModel: useReasoningModel
      });
    }

    // 使用 axios 请求流式数据
    let response;
    try {
      response = await axios.post(apiUrl, requestBody, {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        },
        timeout: 180000,
        responseType: 'stream'
      });
      console.log('[SSE流] 请求成功, model:', model, 'url:', apiUrl.substring(0, 50));
    } catch (err) {
      console.error('[SSE流] 请求失败:', err.message);
      if (err.response) {
        console.error('[SSE流] 响应状态:', err.response.status);
        console.error('[SSE流] 响应数据:', JSON.stringify(err.response.data).substring(0, 500));
      }
      
      // 如果深度思考模型失败，回退到普通模型
      if (useReasoningModel) {
        const fallbackModel = isCustomModel ? customDefaultModel : DEFAULT_MODEL;
        console.log('[SSE流] 深度思考模型不可用，回退到普通模型:', fallbackModel);
        useReasoningModel = false;
        model = fallbackModel;
        
        try {
          response = await axios.post(apiUrl, { ...requestBody, model }, {
            headers: {
              'Authorization': `Bearer ${apiKey}`,
              'Content-Type': 'application/json'
            },
            timeout: 180000,
            responseType: 'stream'
          });
          console.log('[SSE流] 回退成功, model:', model);
        } catch (err2) {
          console.error('[SSE流] 回退也失败:', err2.message);
          if (!res.headersSent) {
            return res.status(500).json({
              code: 500,
              message: `AI 服务错误：${err2.response?.data?.error?.message || err2.message}`
            });
          }
          return;
        }
      } else if (isCustomModel) {
        // 自定义模型请求失败，明确提示用户
        if (!res.headersSent) {
          const errorMsg = err.response?.data?.error?.message || err.message;
          console.error('[SSE流] 自定义模型请求失败:', errorMsg);
          return res.status(500).json({
            code: 500,
            message: `自定义 AI 请求失败：${errorMsg}。请在设置中检查 API Key 和模型配置是否正确。`
          });
        }
        return;
      } else {
        if (!res.headersSent) {
          return res.status(500).json({
            code: 500,
            message: `AI 服务错误：${err.response?.data?.error?.message || err.message}`
          });
        }
        return;
      }
    }

    console.log('[SSE流] 请求成功, model:', model, 'url:', apiUrl.substring(0, 50));

    // 处理流式响应
    let fullThinking = '';
    let fullContent = '';
    let hasThinking = false;

    response.data.on('data', (chunk) => {
      const lines = chunk.toString().split('\n');
      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const data = line.substring(6);
          if (data.trim() === '[DONE]') {
            console.log('[SSE流] 收到[DONE]标记，结束思考:', fullThinking.length, '内容:', fullContent.length);
            res.write(`data: ${JSON.stringify({ type: 'complete', thinking: fullThinking, content: fullContent, model })}\n\n`);
            res.write('data: [DONE]\n\n');
            res.end();
            return;
          }
          try {
            const parsed = JSON.parse(data);
            const delta = parsed.choices?.[0]?.delta;
            const content = delta?.content || '';
            
            // 打印完整的delta对象，查看豆包实际返回的字段
            if (delta && Object.keys(delta).length > 0) {
              console.log('[SSE流] delta对象:', JSON.stringify(delta).substring(0, 200));
            }
            
            // 尝试所有可能的推理内容字段
            const reasoningContent = delta?.reasoning_content || delta?.reasoning || delta?.thought || delta?.thinking || '';
            if (reasoningContent) {
              hasThinking = true;
              fullThinking += reasoningContent;
              console.log('[SSE流] ✅ 收到思考内容, 长度:', reasoningContent.length, '内容:', reasoningContent.substring(0, 50));
            } else if (delta && Object.keys(delta).length > 0) {
              console.log('[SSE流] ❌ delta中有字段但没有reasoning_content:', JSON.stringify(delta));
            }
            
            if (content) fullContent += content;
            if (content || reasoningContent) {
              res.write(`data: ${JSON.stringify({ type: 'chunk', content, reasoning_content: reasoningContent })}\n\n`);
              // 强制刷新输出缓冲区
              if (res.flushHeaders) res.flush();
            }
          } catch (e) {
            console.log('[SSE流] 非JSON数据:', data.substring(0, 100));
          }
        }
      }
    });

    response.data.on('end', () => {
      if (!res.writableEnded) {
        console.log('[SSE流] 流结束，思考长度:', fullThinking.length, '内容长度:', fullContent.length);
        res.write(`data: ${JSON.stringify({ type: 'complete', thinking: fullThinking, content: fullContent, model })}\n\n`);
        res.write('data: [DONE]\n\n');
        res.end();
      }
    });

    response.data.on('error', (error) => {
      console.error('流式响应错误:', error.message);
      res.write(`data: ${JSON.stringify({ type: 'error', message: error.message })}\n\n`);
      res.end();
    });

  } catch (error) {
    console.error('流式聊天失败:', error.message);
    console.error('错误堆栈:', error.stack);
    if (!res.headersSent) {
      res.status(500).json({ 
        code: 500, 
        message: error.message,
        errorType: error.name 
      });
    }
  }
});

router.post('/image-understand', authenticate, async (req, res) => {
  try {
    const { message, imageBase64, imageMimeType = 'image/jpeg', useCustomModel = false, conversationHistory = [] } = req.body;
    const userId = getUserId(req);

    if (!imageBase64) {
      return res.status(400).json({ code: 400, message: '图片数据不能为空', data: null });
    }

    const userMessage = (message || '请描述这张图片的内容').trim();

    const MAX_HISTORY = 20;
    const trimmedHistory = Array.isArray(conversationHistory) ? conversationHistory.slice(-MAX_HISTORY) : [];

    let apiKey, apiUrl, model;

    if (useCustomModel) {
      const [rows] = await db.query(
        'SELECT provider, api_key, model_name FROM user_ai_model WHERE user_id = ? AND is_active = 1',
        [userId]
      );

      if (rows.length === 0) {
        return res.status(400).json({
          code: 400,
          message: '未绑定自定义 AI 模型，请先绑定或使用平台默认模型',
          data: null
        });
      }

      const userConfig = rows[0];
      const decryptedKey = decryptApiKey(userConfig.api_key);
      if (!decryptedKey) {
        return res.status(400).json({
          code: 400,
          message: 'API Key 解密失败，请重新绑定',
          data: null
        });
      }

      const providerConfig = getProviderConfig(userConfig.provider);
      apiKey = decryptedKey;
      apiUrl = providerConfig.url;
      
      // 检查服务商是否支持视觉模型
      const noVisionProviders = ['kimi', 'deepseek', 'glm'];
      if (noVisionProviders.includes(userConfig.provider)) {
        return res.status(400).json({
          code: 400,
          message: `该服务商（${getProviderName(userConfig.provider)}）不支持图片分析，请切换回平台默认模型后再发送图片`,
          data: null
        });
      }
      model = providerConfig.visionModel;
    } else {
      if (!DEFAULT_API_KEY) {
        return res.status(500).json({
          code: 500,
          message: '平台 AI 服务未配置',
          data: null
        });
      }
      apiKey = DEFAULT_API_KEY;
      apiUrl = DEFAULT_API_URL;
      const providerConfig = getProviderConfig('doubao');
      model = providerConfig.visionModel;
    }

    const visionSystemPrompt = '你是一个专业的图像理解助手，能够准确描述和分析图片内容。请用中文回答。';
    
    // 使用流式调用图片识别
    const requestBody = {
      model: model,
      messages: [
        { role: 'system', content: visionSystemPrompt },
        ...trimmedHistory,
        {
          role: 'user',
          content: [
            { type: 'text', text: userMessage },
            {
              type: 'image_url',
              image_url: {
                url: `data:${imageMimeType};base64,${imageBase64}`
              }
            }
          ]
        }
      ],
      temperature: 0.7,
      max_tokens: 2048,
      stream: true
    };

    console.log('[AI 识图流式] 开始请求:', { 
      apiUrl, 
      model, 
      messageLength: userMessage.length, 
      imageBase64Length: imageBase64.length,
      hasApiKey: !!apiKey
    });

    // 使用 axios 请求流式数据
    const response = await axios.post(apiUrl, requestBody, {
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      timeout: 180000,
      responseType: 'stream'
    });

    console.log('[AI 识图流式] 请求成功，model:', model, 'url:', apiUrl.substring(0, 50));

    // 设置 SSE 响应头
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');

    // 处理流式响应
    let fullThinking = '';
    let fullContent = '';

    response.data.on('data', (chunk) => {
      const lines = chunk.toString().split('\n');
      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const data = line.substring(6);
          if (data.trim() === '[DONE]') {
            console.log('[AI 识图流式] 收到[DONE]标记，结束思考:', fullThinking.length, '内容:', fullContent.length);
            res.write(`data: ${JSON.stringify({ type: 'complete', thinking: fullThinking, content: fullContent, model })}\n\n`);
            res.write('data: [DONE]\n\n');
            res.end();
            return;
          }
          try {
            const parsed = JSON.parse(data);
            const delta = parsed.choices?.[0]?.delta;
            const content = delta?.content || '';
            
            // 打印完整的 delta 对象，查看豆包实际返回的字段
            if (delta && Object.keys(delta).length > 0) {
              console.log('[AI 识图流式] delta 对象:', JSON.stringify(delta).substring(0, 200));
            }
            
            // 尝试所有可能的推理内容字段
            const reasoningContent = delta?.reasoning_content || delta?.reasoning || delta?.thought || delta?.thinking || '';
            if (reasoningContent) {
              fullThinking += reasoningContent;
              console.log('[AI 识图流式] ✅ 收到思考内容，长度:', reasoningContent.length, '内容:', reasoningContent.substring(0, 50));
            } else if (delta && Object.keys(delta).length > 0) {
              console.log('[AI 识图流式] ❌ delta 中有字段但没有 reasoning_content:', JSON.stringify(delta));
            }
            
            if (content) fullContent += content;
            if (content || reasoningContent) {
              res.write(`data: ${JSON.stringify({ type: 'chunk', content, reasoning_content: reasoningContent })}\n\n`);
              // 强制刷新输出缓冲区
              if (res.flushHeaders) res.flush();
            }
          } catch (e) {
            console.log('[AI 识图流式] 非 JSON 数据:', data.substring(0, 100));
          }
        }
      }
    });

    response.data.on('end', () => {
      if (!res.writableEnded) {
        console.log('[AI 识图流式] 流结束，思考长度:', fullThinking.length, '内容长度:', fullContent.length);
        res.write(`data: ${JSON.stringify({ type: 'complete', thinking: fullThinking, content: fullContent, model })}\n\n`);
        res.write('data: [DONE]\n\n');
        res.end();
      }
    });

    response.data.on('error', (error) => {
      console.error('[AI 识图流式] 流式响应错误:', error.message);
      res.write(`data: ${JSON.stringify({ type: 'error', message: error.message })}\n\n`);
      res.end();
    });

  } catch (error) {
    console.error('AI 识图失败:', error.message);

    if (error.response) {
      const status = error.response.status;
      const errMsg = error.response.data?.error?.message || error.response.data?.message || 'AI 服务请求失败';

      if (status === 401 || status === 403) {
        return res.status(400).json({
          code: 400,
          message: req.body.useCustomModel ? '自定义 API Key 无效，请检查配置' : '平台 AI 服务认证失败',
          data: null
        });
      }
      if (status === 429) {
        return res.status(429).json({
          code: 429,
          message: 'AI 服务请求过于频繁，请稍后再试',
          data: null
        });
      }
      return res.status(500).json({
        code: 500,
        message: `AI 服务错误：${errMsg}`,
        data: null
      });
    }

    res.status(500).json({
      code: 500,
      message: error.message || 'AI 识图服务异常',
      data: null
    });
  }
});

/**
 * POST /api/ai/file-analyze
 * AI 文件分析接口
 */
router.post('/file-analyze', authenticate, async (req, res) => {
  try {
    const { message, fileBase64, fileName, useCustomModel = false, conversationHistory = [] } = req.body;
    const userId = getUserId(req);

    if (!fileBase64) {
      return res.status(400).json({ code: 400, message: '文件数据不能为空', data: null });
    }

    const userMessage = (message || '请分析这个文件的内容').trim();

    const MAX_HISTORY = 20;
    const trimmedHistory = Array.isArray(conversationHistory) ? conversationHistory.slice(-MAX_HISTORY) : [];

    let apiKey, apiUrl, model, visionModel;

    if (useCustomModel) {
      const [rows] = await db.query(
        'SELECT provider, api_key, model_name FROM user_ai_model WHERE user_id = ? AND is_active = 1',
        [userId]
      );

      if (rows.length === 0) {
        return res.status(400).json({
          code: 400,
          message: '未绑定自定义 AI 模型，请先绑定或使用平台默认模型',
          data: null
        });
      }

      const userConfig = rows[0];
      const decryptedKey = decryptApiKey(userConfig.api_key);
      if (!decryptedKey) {
        return res.status(400).json({
          code: 400,
          message: 'API Key 解密失败，请重新绑定',
          data: null
        });
      }

      const providerConfig = getProviderConfig(userConfig.provider);
      apiKey = decryptedKey;
      apiUrl = providerConfig.url;
      model = userConfig.model_name || providerConfig.defaultModel;
      visionModel = providerConfig.visionModel;
    } else {
      if (!DEFAULT_API_KEY) {
        return res.status(500).json({
          code: 500,
          message: '平台 AI 服务未配置',
          data: null
        });
      }
      apiKey = DEFAULT_API_KEY;
      apiUrl = DEFAULT_API_URL;
      model = DEFAULT_MODEL;
      const providerConfig = getProviderConfig('doubao');
      visionModel = providerConfig.visionModel;
    }

    const fileExtension = fileName?.split('.').pop()?.toLowerCase() || '';
    const textExtensions = ['txt', 'md', 'csv', 'json', 'xml', 'html', 'css', 'js', 'ts', 'py', 'java', 'c', 'cpp', 'h', 'log', 'yml', 'yaml', 'toml', 'ini', 'cfg', 'conf'];
    const fileCategory = getFileCategory(fileExtension);

    if (textExtensions.includes(fileExtension)) {
      let systemPrompt = DEFAULT_SYSTEM_PROMPT;

      if (['txt', 'md', 'log'].includes(fileExtension)) {
        systemPrompt = '你是一个专业的文本分析助手，擅长分析文本文件内容。请用中文回答，提取文本的关键信息。';
      } else if (['csv', 'json', 'xml'].includes(fileExtension)) {
        systemPrompt = '你是一个专业的数据分析助手，擅长解析结构化数据。请用中文回答，提取数据的关键信息。';
      } else {
        systemPrompt = '你是一个专业的代码/技术分析助手。请用中文回答，分析文件内容。';
      }

      let fileContent = '';
      try {
        fileContent = Buffer.from(fileBase64, 'base64').toString('utf-8');
      } catch (e) {
        console.error('文件解码失败:', e.message);
        return res.status(400).json({
          code: 400,
          message: '文件解码失败，请检查文件格式',
          data: null
        });
      }

      const MAX_TEXT_LENGTH = 30000;
      const truncatedContent = fileContent.length > MAX_TEXT_LENGTH
        ? fileContent.substring(0, MAX_TEXT_LENGTH) + '\n\n[...文件内容过长，已截断...]'
        : fileContent;

      const fullMessage = fileName ?
        `请分析文件 "${fileName}" 的内容：\n\n${truncatedContent}\n\n用户问题：${userMessage}` :
        `请分析文件内容：\n\n${truncatedContent}\n\n用户问题：${userMessage}`;

      const result = await callAIModelForFile(apiKey, apiUrl, model, fullMessage, trimmedHistory, systemPrompt);

      return res.json({
        code: 200,
        message: 'success',
        data: {
          reply: result.reply,
          thinking: result.thinking || '',
          model: result.model,
          timestamp: Math.floor(Date.now() / 1000)
        }
      });
    }

    if (fileCategory === 'image') {
      const imageMimeType = require('../utils/documentParser').IMAGE_MIME_MAP[fileExtension] || 'image/jpeg';
      const visionSystemPrompt = '你是一个专业的图像理解助手，能够准确描述和分析图片内容。请用中文回答。';
      const result = await callAIModelWithImage(
        apiKey, apiUrl, visionModel, userMessage, fileBase64, imageMimeType, trimmedHistory, visionSystemPrompt
      );

      return res.json({
        code: 200,
        message: 'success',
        data: {
          reply: result.reply,
          thinking: result.thinking || '',
          model: result.model,
          timestamp: Math.floor(Date.now() / 1000)
        }
      });
    }

    if (fileCategory === 'pdf' || fileCategory === 'word' || fileCategory === 'excel') {
      console.log(`[文件分析] 开始解析 ${fileCategory} 文件: ${fileName}`);

      const extractResult = await extractTextFromFile(fileBase64, fileName);

      if (!extractResult.success) {
        const fallbackMessage = fileName ?
          `用户上传了文件 "${fileName}"，但系统无法提取文件内容（${extractResult.error}）。请根据文件名和类型给出一般性说明，并告知用户可以尝试上传文本格式文件。用户问题：${userMessage}` :
          `用户上传了文件，但系统无法提取文件内容（${extractResult.error}）。用户问题：${userMessage}`;

        const result = await callAIModelForFile(apiKey, apiUrl, model, fallbackMessage, trimmedHistory, DEFAULT_SYSTEM_PROMPT);

        return res.json({
          code: 200,
          message: 'success',
          data: {
            reply: result.reply,
            model: result.model,
            timestamp: Math.floor(Date.now() / 1000)
          }
        });
      }

      const systemPromptMap = {
        pdf: '你是一个专业的文档分析助手，擅长分析 PDF 文档内容。请用中文回答，提取文档的关键信息。',
        word: '你是一个专业的文档分析助手，擅长分析 Word 文档内容。请用中文回答，提取文档的关键信息。',
        excel: '你是一个专业的数据分析助手，擅长分析 Excel 表格数据。请用中文回答，提取数据的关键信息和统计特征。'
      };

      const MAX_TEXT_LENGTH = 30000;
      const extractedText = extractResult.text;
      const truncatedText = extractedText.length > MAX_TEXT_LENGTH
        ? extractedText.substring(0, MAX_TEXT_LENGTH) + '\n\n[...文件内容过长，已截断...]'
        : extractedText;

      const fullMessage = fileName ?
        `请分析文件 "${fileName}" 的内容：\n\n${truncatedText}\n\n用户问题：${userMessage}` :
        `请分析文件内容：\n\n${truncatedText}\n\n用户问题：${userMessage}`;

      const result = await callAIModelForFile(apiKey, apiUrl, model, fullMessage, trimmedHistory, systemPromptMap[fileCategory]);

      return res.json({
        code: 200,
        message: 'success',
        data: {
          reply: result.reply,
          thinking: result.thinking || '',
          model: result.model,
          timestamp: Math.floor(Date.now() / 1000)
        }
      });
    }

    const fallbackMessage = fileName ?
      `用户上传了文件 "${fileName}"（类型: .${fileExtension}），系统暂不支持该文件类型的自动解析。请根据文件名和扩展名给出一般性说明，并建议用户将文件转换为支持的格式（txt、pdf、docx、xlsx 等）。用户问题：${userMessage}` :
      `用户上传了文件，系统暂不支持该文件类型的自动解析。用户问题：${userMessage}`;

    const result = await callAIModelForFile(apiKey, apiUrl, model, fallbackMessage, trimmedHistory, DEFAULT_SYSTEM_PROMPT);

    res.json({
      code: 200,
      message: 'success',
      data: {
        reply: result.reply,
        thinking: result.thinking || '',
        model: result.model,
        timestamp: Math.floor(Date.now() / 1000)
      }
    });
  } catch (error) {
    console.error('AI 文件分析失败:', error.message);

    if (error.response) {
      const status = error.response.status;
      const errMsg = error.response.data?.error?.message || error.response.data?.message || 'AI 服务请求失败';

      if (status === 401 || status === 403) {
        return res.status(400).json({
          code: 400,
          message: req.body.useCustomModel ? '自定义 API Key 无效，请检查配置' : '平台 AI 服务认证失败',
          data: null
        });
      }
      if (status === 429) {
        return res.status(429).json({
          code: 429,
          message: 'AI 服务请求过于频繁，请稍后再试',
          data: null
        });
      }
      return res.status(500).json({
        code: 500,
        message: `AI 服务错误：${errMsg}`,
        data: null
      });
    }

    res.status(500).json({
      code: 500,
      message: error.message || 'AI 文件分析服务异常',
      data: null
    });
  }
});

/**
 * POST /api/ai/file-analyze-stream
 * AI 文件分析流式接口
 */
router.post('/file-analyze-stream', authenticate, async (req, res) => {
  try {
    const { message, fileBase64, fileName, useCustomModel = false, enableThinking = false, conversationHistory = [] } = req.body;
    const userId = getUserId(req);

    if (!fileBase64) {
      return res.status(400).json({ code: 400, message: '文件数据不能为空', data: null });
    }

    const userMessage = (message || '请分析这个文件的内容').trim();

    const MAX_HISTORY = 20;
    const trimmedHistory = Array.isArray(conversationHistory) ? conversationHistory.slice(-MAX_HISTORY) : [];

    let apiKey, apiUrl, model;

    if (useCustomModel) {
      const [rows] = await db.query(
        'SELECT provider, api_key, model_name FROM user_ai_model WHERE user_id = ? AND is_active = 1',
        [userId]
      );

      if (rows.length === 0) {
        return res.status(400).json({
          code: 400,
          message: '未绑定自定义 AI 模型，请先绑定或使用平台默认模型',
          data: null
        });
      }

      const userConfig = rows[0];
      const decryptedKey = decryptApiKey(userConfig.api_key);
      if (!decryptedKey) {
        return res.status(400).json({
          code: 400,
          message: 'API Key 解密失败，请重新绑定',
          data: null
        });
      }

      const providerConfig = getProviderConfig(userConfig.provider);
      apiKey = decryptedKey;
      apiUrl = providerConfig.url;
      model = userConfig.model_name || providerConfig.defaultModel;
    } else {
      if (!DEFAULT_API_KEY) {
        return res.status(500).json({
          code: 500,
          message: '平台 AI 服务未配置',
          data: null
        });
      }
      apiKey = DEFAULT_API_KEY;
      apiUrl = DEFAULT_API_URL;
      model = DEFAULT_MODEL;
    }

    const fileExtension = fileName?.split('.').pop()?.toLowerCase() || '';
    const textExtensions = ['txt', 'md', 'csv', 'json', 'xml', 'html', 'css', 'js', 'ts', 'py', 'java', 'c', 'cpp', 'h', 'log', 'yml', 'yaml', 'toml', 'ini', 'cfg', 'conf'];
    const fileCategory = getFileCategory(fileExtension);

    if (textExtensions.includes(fileExtension)) {
      let systemPrompt = DEFAULT_SYSTEM_PROMPT;

      if (['txt', 'md', 'log'].includes(fileExtension)) {
        systemPrompt = '你是一个专业的文本分析助手，擅长分析文本文件内容。请用中文回答，提取文本的关键信息。';
      } else if (['csv', 'json', 'xml'].includes(fileExtension)) {
        systemPrompt = '你是一个专业的数据分析助手，擅长解析结构化数据。请用中文回答，提取数据的关键信息。';
      } else {
        systemPrompt = '你是一个专业的代码/技术分析助手。请用中文回答，分析文件内容。';
      }

      let fileContent = '';
      try {
        fileContent = Buffer.from(fileBase64, 'base64').toString('utf-8');
      } catch (e) {
        console.error('文件解码失败:', e.message);
        return res.status(400).json({
          code: 400,
          message: '文件解码失败，请检查文件格式',
          data: null
        });
      }

      const MAX_TEXT_LENGTH = 30000;
      const truncatedContent = fileContent.length > MAX_TEXT_LENGTH
        ? fileContent.substring(0, MAX_TEXT_LENGTH) + '\n\n[...文件内容过长，已截断...]'
        : fileContent;

      const fullMessage = fileName ?
        `请分析文件 "${fileName}" 的内容：\n\n${truncatedContent}\n\n用户问题：${userMessage}` :
        `请分析文件内容：\n\n${truncatedContent}\n\n用户问题：${userMessage}`;

      await callAIModelForFileStream(apiKey, apiUrl, model, fullMessage, res, trimmedHistory, systemPrompt, enableThinking);
      return;
    }

    if (fileCategory === 'pdf' || fileCategory === 'word' || fileCategory === 'excel') {
      console.log(`[文件流式分析] 开始解析 ${fileCategory} 文件: ${fileName}`);

      const extractResult = await extractTextFromFile(fileBase64, fileName);

      if (!extractResult.success) {
        const fallbackMessage = fileName ?
          `用户上传了文件 "${fileName}"，但系统无法提取文件内容（${extractResult.error}）。请根据文件名和类型给出一般性说明，并告知用户可以尝试上传文本格式文件。用户问题：${userMessage}` :
          `用户上传了文件，但系统无法提取文件内容（${extractResult.error}）。用户问题：${userMessage}`;

        await callAIModelForFileStream(apiKey, apiUrl, model, fallbackMessage, res, trimmedHistory, DEFAULT_SYSTEM_PROMPT, enableThinking);
        return;
      }

      const systemPromptMap = {
        pdf: '你是一个专业的文档分析助手，擅长分析 PDF 文档内容。请用中文回答，提取文档的关键信息。',
        word: '你是一个专业的文档分析助手，擅长分析 Word 文档内容。请用中文回答，提取文档的关键信息。',
        excel: '你是一个专业的数据分析助手，擅长分析 Excel 表格数据。请用中文回答，提取数据的关键信息和统计特征。'
      };

      const MAX_TEXT_LENGTH = 30000;
      const extractedText = extractResult.text;
      const truncatedText = extractedText.length > MAX_TEXT_LENGTH
        ? extractedText.substring(0, MAX_TEXT_LENGTH) + '\n\n[...文件内容过长，已截断...]'
        : extractedText;

      const fullMessage = fileName ?
        `请分析文件 "${fileName}" 的内容：\n\n${truncatedText}\n\n用户问题：${userMessage}` :
        `请分析文件内容：\n\n${truncatedText}\n\n用户问题：${userMessage}`;

      await callAIModelForFileStream(apiKey, apiUrl, model, fullMessage, res, trimmedHistory, systemPromptMap[fileCategory], enableThinking);
      return;
    }

    const fallbackMessage = fileName ?
      `用户上传了文件 "${fileName}"（类型: .${fileExtension}），系统暂不支持该文件类型的自动解析。请根据文件名和扩展名给出一般性说明，并建议用户将文件转换为支持的格式（txt、pdf、docx、xlsx 等）。用户问题：${userMessage}` :
      `用户上传了文件，系统暂不支持该文件类型的自动解析。用户问题：${userMessage}`;

    await callAIModelForFileStream(apiKey, apiUrl, model, fallbackMessage, res, trimmedHistory, DEFAULT_SYSTEM_PROMPT, enableThinking);

  } catch (error) {
    console.error('AI 文件流式分析失败:', error.message);

    if (!res.headersSent) {
      if (error.response) {
        const status = error.response.status;
        const errMsg = error.response.data?.error?.message || error.response.data?.message || 'AI 服务请求失败';

        if (status === 401 || status === 403) {
          return res.status(400).json({
            code: 400,
            message: req.body.useCustomModel ? '自定义 API Key 无效，请检查配置' : '平台 AI 服务认证失败',
            data: null
          });
        }
        if (status === 429) {
          return res.status(429).json({
            code: 429,
            message: 'AI 服务请求过于频繁，请稍后再试',
            data: null
          });
        }
        return res.status(500).json({
          code: 500,
          message: `AI 服务错误：${errMsg}`,
          data: null
        });
      }

      res.status(500).json({
        code: 500,
        message: error.message || 'AI 文件分析服务异常',
        data: null
      });
    } else {
      res.write(`data: ${JSON.stringify({ type: 'error', message: error.message })}\n\n`);
      res.end();
    }
  }
});

module.exports = router;
