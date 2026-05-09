/**
 * AI 服务工具模块
 * 提供加密解密、模型调用等共享功能
 */
const crypto = require('crypto');
const axios = require('axios');
const db = require('../config/db');
require('dotenv').config();

// 平台默认豆包 AI 配置
const DEFAULT_API_KEY = process.env.ARK_API_KEY || '';
const DEFAULT_API_URL = process.env.ARK_API_URL || 'https://ark.cn-beijing.volces.com/api/v3/chat/completions';
const DEFAULT_MODEL = process.env.ARK_MODEL || 'doubao-seed-2-0-lite-260215';
const DEFAULT_SYSTEM_PROMPT = process.env.AI_SYSTEM_PROMPT || '你是用户的智能助手，请提供专业、友好的帮助。';

// API Key 加密密钥
const ENCRYPTION_KEY = process.env.AI_ENCRYPTION_KEY;
if (!ENCRYPTION_KEY) {
  console.error('❌ AI_ENCRYPTION_KEY 环境变量未设置，API Key 加密功能不可用！');
}
const IV_LENGTH = 16;

/**
 * 加密 API Key
 */
function encryptApiKey(apiKey) {
  const key = crypto.createHash('sha256').update(ENCRYPTION_KEY).digest();
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);
  let encrypted = cipher.update(apiKey, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  return iv.toString('hex') + ':' + encrypted;
}

/**
 * 解密 API Key
 */
function decryptApiKey(encryptedKey) {
  try {
    const key = crypto.createHash('sha256').update(ENCRYPTION_KEY).digest();
    const parts = encryptedKey.split(':');
    if (parts.length !== 2) return null;
    const iv = Buffer.from(parts[0], 'hex');
    const encrypted = parts[1];
    const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  } catch (e) {
    console.error('解密 API Key 失败:', e.message);
    return null;
  }
}

/**
 * 从请求中获取用户 ID
 */
function getUserId(req) {
  return req.user?.id || req.user?.userId || req.user?.user_id;
}

/**
 * 获取不同 provider 的 API 配置
 */
function getProviderConfig(provider) {
  const configs = {
    doubao: {
      url: 'https://ark.cn-beijing.volces.com/api/v3/chat/completions',
      defaultModel: process.env.ARK_MODEL || 'doubao-seed-2-0-lite-260215',
      visionModel: process.env.ARK_VISION_MODEL || process.env.ARK_MODEL || 'doubao-seed-1-6-vision-250815',
      reasoningModel: process.env.ARK_REASONING_MODEL || 'deepseek-r1-250120'
    },
    openai: {
      url: 'https://api.openai.com/v1/chat/completions',
      defaultModel: 'gpt-3.5-turbo',
      visionModel: 'gpt-4o',
      reasoningModel: 'o3-mini'
    },
    deepseek: {
      url: 'https://api.deepseek.com/v1/chat/completions',
      defaultModel: 'deepseek-chat',
      visionModel: 'deepseek-chat',
      reasoningModel: 'deepseek-reasoner'
    },
    qwen: {
      url: 'https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions',
      defaultModel: 'qwen-turbo',
      visionModel: 'qwen-vl-plus',
      reasoningModel: 'qwq-32b'
    },
    kimi: {
      url: 'https://api.moonshot.cn/v1/chat/completions',
      defaultModel: 'moonshot-v1-8k',
      visionModel: 'moonshot-v1-8k',
      reasoningModel: 'moonshot-v1-8k'
    },
    glm: {
      url: 'https://open.bigmodel.cn/api/paas/v4/chat/completions',
      defaultModel: 'glm-4-flash',
      visionModel: 'glm-4v-flash',
      reasoningModel: 'glm-4-flash'
    }
  };
  return configs[provider] || configs.doubao;
}

/**
 * 调用 AI 模型（兼容 OpenAI Chat Completions 格式）
 */
async function callAIModel(apiKey, apiUrl, model, userMessage, conversationHistory = [], systemPrompt = null) {
  const messages = [];

  if (systemPrompt) {
    messages.push({ role: 'system', content: systemPrompt });
  }

  if (conversationHistory.length > 0) {
    messages.push(...conversationHistory);
  }

  messages.push({ role: 'user', content: userMessage });

  const requestBody = {
    model: model,
    messages: messages,
    temperature: 0.7,
    max_tokens: 2048
  };

  // 重试逻辑
  const maxRetries = 3;
  let lastError;
  
  for (let i = 0; i < maxRetries; i++) {
    try {
      const response = await axios.post(apiUrl, requestBody, {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        },
        timeout: 120000,  // 120 秒超时（推理模型思考时间长）
      });

      const data = response.data;
      if (data.choices && data.choices.length > 0) {
        const choice = data.choices[0];
        // 尝试多个可能的思考内容字段
        const thinking = choice.message?.reasoning_content || 
                        choice.message?.reasoning || 
                        choice.message?.thought || 
                        choice.message?.thinking || 
                        '';
        return {
          reply: choice.message?.content || choice.text || '',
          thinking: thinking,
          model: data.model || model
        };
      }
      
      throw new Error('AI 模型返回格式异常');
    } catch (error) {
      lastError = error;
      console.warn(`AI 请求失败（第${i + 1}次）:`, error.message);
      
      // 如果是最后一次重试，抛出错误
      if (i === maxRetries - 1) {
        throw error;
      }
      
      // 等待一段时间后重试（递增延迟）
      await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1)));
    }
  }
  
  throw lastError;
}

async function callAIModelWithImage(apiKey, apiUrl, model, userMessage, imageBase64, imageMimeType = 'image/jpeg', conversationHistory = [], systemPrompt = null) {
  const messages = [];

  if (systemPrompt) {
    messages.push({ role: 'system', content: systemPrompt });
  }

  if (conversationHistory.length > 0) {
    messages.push(...conversationHistory);
  }

  const userContent = [
    { type: 'text', text: userMessage },
    {
      type: 'image_url',
      image_url: {
        url: `data:${imageMimeType};base64,${imageBase64}`
      }
    }
  ];

  messages.push({ role: 'user', content: userContent });

  const requestBody = {
    model: model,
    messages: messages,
    temperature: 0.7,
    max_tokens: 2048
  };

  console.log('[AI 识图] 开始请求:', { 
    apiUrl, 
    model, 
    messageLength: userMessage.length, 
    imageBase64Length: imageBase64.length,
    hasApiKey: !!apiKey
  });

  const maxRetries = 3;
  let lastError;

  for (let i = 0; i < maxRetries; i++) {
    try {
      const response = await axios.post(apiUrl, requestBody, {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        },
        timeout: 60000,
      });

      console.log('[AI 识图] 响应状态:', response.status);
      console.log('[AI 识图] 完整响应数据:', JSON.stringify(response.data).substring(0, 500));
      
      const data = response.data;
      if (data.choices && data.choices.length > 0) {
        const choice = data.choices[0];
        console.log('[AI 识图] choice 对象:', JSON.stringify(choice).substring(0, 300));
        
        // 尝试多个可能的思考内容字段
        const thinking = choice.message?.reasoning_content || 
                        choice.message?.reasoning || 
                        choice.message?.thought || 
                        choice.message?.thinking || 
                        '';
        
        console.log('[AI 识图] 提取思考内容:', thinking ? `有思考内容 (${thinking.length}字符)` : '无思考内容');
        
        return {
          reply: choice.message?.content || choice.text || '',
          thinking: thinking,
          model: data.model || model
        };
      }

      throw new Error('AI 模型返回格式异常');
    } catch (error) {
      lastError = error;
      console.warn(`AI 识图请求失败（第${i + 1}次）:`, error.message);
      if (error.response) {
        console.warn('[AI 识图] 响应状态:', error.response.status);
        console.warn('[AI 识图] 响应数据:', JSON.stringify(error.response.data));
      }

      if (i === maxRetries - 1) {
        throw error;
      }

      await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1)));
    }
  }

  throw lastError;
}

async function callAIModelForFile(apiKey, apiUrl, model, userMessage, conversationHistory = [], systemPrompt = null) {
  const messages = [];

  if (systemPrompt) {
    messages.push({ role: 'system', content: systemPrompt });
  }

  if (conversationHistory.length > 0) {
    messages.push(...conversationHistory);
  }

  messages.push({ role: 'user', content: userMessage });

  const requestBody = {
    model: model,
    messages: messages,
    temperature: 0.7,
    max_tokens: 4096
  };

  console.log('[AI 文件分析] 开始请求:', {
    apiUrl,
    model,
    messageLength: userMessage.length,
    historyLength: conversationHistory.length,
    hasApiKey: !!apiKey
  });

  const maxRetries = 3;
  let lastError;

  for (let i = 0; i < maxRetries; i++) {
    try {
      const response = await axios.post(apiUrl, requestBody, {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        },
        timeout: 60000,
      });

      console.log('[AI 文件分析] 响应状态:', response.status);

      const data = response.data;
      if (data.choices && data.choices.length > 0) {
        const choice = data.choices[0];
        return {
          reply: choice.message?.content || choice.text || '',
          thinking: choice.message?.reasoning_content || '',
          model: data.model || model
        };
      }

      throw new Error('AI 模型返回格式异常');
    } catch (error) {
      lastError = error;
      console.warn(`AI 文件分析请求失败（第${i + 1}次）:`, error.message);
      if (error.response) {
        console.warn('[AI 文件分析] 响应状态:', error.response.status);
        console.warn('[AI 文件分析] 响应数据:', JSON.stringify(error.response.data));
      }

      if (i === maxRetries - 1) {
        throw error;
      }

      await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1)));
    }
  }

  throw lastError;
}

async function callAIModelForFileStream(apiKey, apiUrl, model, userMessage, res, conversationHistory = [], systemPrompt = null, enableThinking = false) {
  const messages = [];

  if (systemPrompt) {
    messages.push({ role: 'system', content: systemPrompt });
  }

  if (conversationHistory.length > 0) {
    messages.push(...conversationHistory);
  }

  messages.push({ role: 'user', content: userMessage });

  const requestBody = {
    model: model,
    messages: messages,
    temperature: 0.7,
    max_tokens: 4096,
    stream: true
  };

  console.log('[AI 文件流式] 开始请求:', {
    apiUrl,
    model,
    messageLength: userMessage.length,
    historyLength: conversationHistory.length,
    hasApiKey: !!apiKey
  });

  const response = await axios.post(apiUrl, requestBody, {
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    timeout: 180000,
    responseType: 'stream'
  });

  console.log('[AI 文件流式] 请求成功，model:', model, 'url:', apiUrl.substring(0, 50));

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');

  let fullThinking = '';
  let fullContent = '';

  response.data.on('data', (chunk) => {
    const lines = chunk.toString().split('\n');
    for (const line of lines) {
      if (line.startsWith('data: ')) {
        const data = line.substring(6);
        if (data.trim() === '[DONE]') {
          console.log('[AI 文件流式] 收到[DONE]标记，思考:', fullThinking.length, '内容:', fullContent.length);
          res.write(`data: ${JSON.stringify({ type: 'complete', thinking: fullThinking, content: fullContent, model })}\n\n`);
          res.write('data: [DONE]\n\n');
          res.end();
          return;
        }
        try {
          const parsed = JSON.parse(data);
          const delta = parsed.choices?.[0]?.delta;
          const content = delta?.content || '';

          if (delta && Object.keys(delta).length > 0) {
            console.log('[AI 文件流式] delta:', JSON.stringify(delta).substring(0, 200));
          }

          const reasoningContent = delta?.reasoning_content || delta?.reasoning || delta?.thought || delta?.thinking || '';
          if (reasoningContent) {
            fullThinking += reasoningContent;
            console.log('[AI 文件流式] 思考内容，长度:', reasoningContent.length, '内容:', reasoningContent.substring(0, 50));
          }

          if (content) fullContent += content;
          if (content || reasoningContent) {
            res.write(`data: ${JSON.stringify({ type: 'chunk', content, reasoning_content: reasoningContent })}\n\n`);
            if (res.flushHeaders) res.flush();
          }
        } catch (e) {
          console.log('[AI 文件流式] 非 JSON 数据:', data.substring(0, 100));
        }
      }
    }
  });

  response.data.on('end', () => {
    if (!res.writableEnded) {
      console.log('[AI 文件流式] 流结束，思考:', fullThinking.length, '内容:', fullContent.length);
      res.write(`data: ${JSON.stringify({ type: 'complete', thinking: fullThinking, content: fullContent, model })}\n\n`);
      res.write('data: [DONE]\n\n');
      res.end();
    }
  });

  response.data.on('error', (error) => {
    console.error('[AI 文件流式] 流式响应错误:', error.message);
    res.write(`data: ${JSON.stringify({ type: 'error', message: error.message })}\n\n`);
    res.end();
  });
}

module.exports = {
  encryptApiKey,
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
};
