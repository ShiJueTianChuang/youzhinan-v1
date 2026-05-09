const crypto = require('crypto');
const WebSocket = require('ws');
const fs = require('fs');
const path = require('path');

const keysPath = path.join(__dirname, '..', 'config', 'api_keys.json');
let keys = {};
try {
  keys = JSON.parse(fs.readFileSync(keysPath, 'utf8'));
} catch (e) {
  console.error('读取 api_keys.json 失败:', e.message);
}

const APP_ID = keys.xunfei?.app_id || '';
const API_KEY = keys.xunfei?.api_key || '';
const API_SECRET = (keys.xunfei?.api_secret || '').trim();
console.log('[SpeechService] 服务已初始化', {
  appId: APP_ID ? '***configured***' : 'missing',
  apiKey: API_KEY ? '***configured***' : 'missing',
  apiSecret: API_SECRET ? `***${API_SECRET.length} chars***` : 'missing'
});

const TTS_URL = 'wss://tts-api.xfyun.cn/v2/tts';
const ASR_URL = 'wss://iat-api.xfyun.cn/v2/iat';

const audioDir = path.join(__dirname, '..', 'uploads', 'audio');
if (!fs.existsSync(audioDir)) {
  fs.mkdirSync(audioDir, { recursive: true });
}

/**
 * 将音频文件转换为 wav 格式(使用 FFmpeg)
 */
async function convertToWav(inputPath) {
  const { exec } = require('child_process');
  const outputPath = inputPath.replace(/\.[^.]+$/, '.wav');
  
  return new Promise((resolve, reject) => {
    const cmd = `ffmpeg -i "${inputPath}" -ar 16000 -ac 1 -f wav "${outputPath}"`;
    console.log('[AudioConvert] 执行转换:', cmd);
    
    exec(cmd, (error, stdout, stderr) => {
      if (error) {
        console.error('[AudioConvert] 转换失败:', error.message);
        return reject(new Error('音频格式转换失败，请安装 FFmpeg'));
      }
      console.log('[AudioConvert] 转换成功:', outputPath);
      resolve(outputPath);
    });
  });
}

/**
 * 将音频 Buffer 转换为 wav Buffer
 * 纯 PCM 封装，无需 FFmpeg
 */
function convertAudioBufferToWav(buffer, sampleRate = 16000, channels = 1, bitsPerSample = 16) {
  const pcmData = buffer;
  const wavHeader = Buffer.alloc(44);
  
  // RIFF header
  wavHeader.write('RIFF', 0);
  wavHeader.writeUInt32LE(36 + pcmData.length, 4);
  wavHeader.write('WAVE', 8);
  
  // fmt chunk
  wavHeader.write('fmt ', 12);
  wavHeader.writeUInt32LE(16, 16); // Subchunk1Size
  wavHeader.writeUInt16LE(1, 20);  // AudioFormat (PCM)
  wavHeader.writeUInt16LE(channels, 22);
  wavHeader.writeUInt32LE(sampleRate, 24);
  wavHeader.writeUInt32LE(sampleRate * channels * bitsPerSample / 8, 28); // ByteRate
  wavHeader.writeUInt16LE(channels * bitsPerSample / 8, 32); // BlockAlign
  wavHeader.writeUInt16LE(bitsPerSample, 34);
  
  // data chunk
  wavHeader.write('data', 36);
  wavHeader.writeUInt32LE(pcmData.length, 40);
  
  return Buffer.concat([wavHeader, pcmData]);
}

/**
 * 生成讯飞 WebSocket 鉴权 URL
 * 鉴权方式：HMAC-SHA256 签名，参数拼在 URL 后
 */
function assembleAuthUrl(hostUrl, apiKey, apiSecret) {
  const ul = new URL(hostUrl);
  const date = new Date().toUTCString();
  const signString = `host: ${ul.host}\ndate: ${date}\nGET ${ul.pathname} HTTP/1.1`;
  const signature = crypto
    .createHmac('sha256', apiSecret)
    .update(signString)
    .digest('base64');
  const authorizationOrigin = `api_key="${apiKey}", algorithm="hmac-sha256", headers="host date request-line", signature="${signature}"`;
  const authorization = Buffer.from(authorizationOrigin).toString('base64');
  return `${hostUrl}?authorization=${authorization}&date=${encodeURIComponent(date)}&host=${ul.host}`;
}

/**
 * 文本转语音（TTS）- 使用讯飞 WebSocket API
 */
function textToSpeech(text, voiceType = 'xiaofeng', format = 'mp3') {
  return new Promise((resolve, reject) => {
    if (!APP_ID || !API_KEY || !API_SECRET) {
      console.error('[TTS] API 配置缺失:', { APP_ID: !!APP_ID, API_KEY: !!API_KEY, API_SECRET: !!API_SECRET });
      return resolve({ success: false, message: '讯飞 API 配置缺失' });
    }

    console.log('[TTS] 开始合成:', { text: text.substring(0, 50), voiceType, APP_ID });
    const authUrl = assembleAuthUrl(TTS_URL, API_KEY, API_SECRET);
    console.log('[TTS] 鉴权URL已生成');
    const ws = new WebSocket(authUrl);

    let audioChunks = [];
    let hasError = false;

    ws.on('open', () => {
      console.log('[TTS] WebSocket 已连接');
      const request = {
        common: { app_id: APP_ID },
        business: {
          aue: format === 'mp3' ? 'lame' : 'raw',
          sfl: format === 'mp3' ? 1 : 0,
          auf: 'audio/L16;rate=16000',
          vcn: voiceType,
          speed: 50,
          volume: 50,
          pitch: 50,
          bgs: 0,
          tte: 'UTF8'
        },
        data: {
          status: 2,
          text: Buffer.from(text).toString('base64')
        }
      };
      ws.send(JSON.stringify(request));
    });

    ws.on('message', (data) => {
      try {
        const resp = JSON.parse(data);
        console.log('[TTS] 讯飞响应:', JSON.stringify(resp).substring(0, 200));
        if (resp.code !== 0) {
          hasError = true;
          ws.close();
          console.error('[TTS] 讯飞返回错误:', resp.code, resp.message);
          return resolve({
            success: false,
            message: `讯飞 TTS 错误: ${resp.message || resp.code}`
          });
        }
        if (resp.data && resp.data.audio) {
          audioChunks.push(Buffer.from(resp.data.audio, 'base64'));
        }
        if (resp.data && resp.data.status === 2) {
          ws.close();
        }
      } catch (e) {
        hasError = true;
        ws.close();
        return resolve({ success: false, message: '解析讯飞 TTS 响应失败' });
      }
    });

    ws.on('close', () => {
      if (hasError) return;
      if (audioChunks.length === 0) {
        console.error('[TTS] 未收到音频数据');
        return resolve({ success: false, message: '讯飞 TTS 未返回音频数据' });
      }
      const audioBuffer = Buffer.concat(audioChunks);
      const fileName = `tts-${Date.now()}.${format}`;
      const filePath = path.join(audioDir, fileName);
      try {
        fs.writeFileSync(filePath, audioBuffer);
        console.log('[TTS] 合成成功:', fileName, '大小:', audioBuffer.length);
        resolve({
          success: true,
          fileName: fileName,
          filePath: filePath,
          url: `${process.env.PUBLIC_ORIGIN || 'https://your-domain.com'}/uploads/audio/${fileName}`
        });
      } catch (e) {
        console.error('[TTS] 文件写入失败:', e.message);
        resolve({ success: false, message: `音频文件写入失败: ${e.message}` });
      }
    });

    ws.on('error', (err) => {
      console.error('[TTS] WebSocket 错误:', err.message);
      resolve({ success: false, message: `WebSocket 连接失败: ${err.message}` });
    });

    // 超时保护
    setTimeout(() => {
      if (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING) {
        ws.close();
        if (!hasError) {
          hasError = true;
          resolve({ success: false, message: '讯飞 TTS 请求超时' });
        }
      }
    }, 30000);
  });
}

/**
 * 语音转文本（ASR）- 使用讯飞 WebSocket API
 * 
 * 讯飞 ASR API 音频格式说明:
 * - raw: 原始 PCM 数据(base64编码), 不含 WAV 头
 * - wav: 完整的 WAV 文件(base64编码), 包含 WAV 头
 * - mp3: MP3 音频(base64编码)
 * - opus: Opus 编码音频
 * - speex: Speex 编码音频
 * 
 * 注意: 讯飞语音听写 API 对 "wav" 格式的支持有限,
 * 建议使用 "raw" 格式发送纯 PCM 数据
 */
function speechToText(audioBuffer, audioFormat = 'wav', sampleRate = 16000) {
  return new Promise((resolve, reject) => {
    console.log('[ASR] 开始识别:', { audioFormat, sampleRate, bufferSize: audioBuffer.length });
    
    if (!APP_ID || !API_KEY || !API_SECRET) {
      console.error('[ASR] API 配置缺失:', { APP_ID: !!APP_ID, API_KEY: !!API_KEY, API_SECRET: !!API_SECRET });
      return resolve({ success: false, message: '讯飞 API 配置缺失' });
    }

    const authUrl = assembleAuthUrl(ASR_URL, API_KEY, API_SECRET);
    console.log('[ASR] 鉴权URL已生成');
    const ws = new WebSocket(authUrl);

    let resultText = '';
    let hasError = false;

    // 提取 PCM 数据(去除 WAV 头)
    let pcmData = audioBuffer;
    if (audioFormat === 'wav') {
      // WAV 文件前44字节是文件头,讯飞 raw 格式只需要 PCM 数据
      if (audioBuffer.length > 44) {
        // 验证是否为有效的 WAV 文件
        const riffHeader = audioBuffer.subarray(0, 4).toString();
        if (riffHeader === 'RIFF') {
          pcmData = audioBuffer.subarray(44); // 跳过 WAV 头,只取 PCM 数据
          console.log('[ASR] 已提取 PCM 数据,大小:', pcmData.length, 'bytes');
        } else {
          console.warn('[ASR] WAV 文件头验证失败,使用原始数据');
        }
      }
    }

    // 讯飞语音听写 API 编码格式
    // 使用 raw + PCM 数据是最稳定的方式
    let encodingValue = 'raw';
    
    if (audioFormat === 'mp3') {
      encodingValue = 'mp3';
      pcmData = audioBuffer; // MP3 不需要提取
    } else if (audioFormat === 'opus' || audioFormat === 'ogg' || audioFormat === 'webm') {
      encodingValue = 'opus';
      pcmData = audioBuffer;
    } else if (audioFormat === 'speex') {
      encodingValue = 'speex';
      pcmData = audioBuffer;
    }

    ws.on('open', () => {
      console.log('[ASR] WebSocket 已连接');
      
      // 讯飞语音听写 API 请求
      // 使用 raw 编码发送 PCM 数据,这是讯飞最稳定的方式
      // 注意: raw 格式不支持 auf 参数
      const business = {
        language: 'zh_cn',
        domain: 'iat',
        accent: 'mandarin',
        aue: encodingValue,
        vad_eos: 2000,
        dwa: 'wpgs',
        nbest: 1,
        wbest: 1,
        ptt: 1
      };
      
      // 只有非 raw 格式才设置 auf 参数
      if (encodingValue !== 'raw') {
        business.auf = 'audio/L16;rate=' + sampleRate + ';channels=1';
      }
      
      const request = {
        common: {
          app_id: APP_ID
        },
        business: business,
        data: {
          status: 2,
          format: encodingValue,
          encoding: 'raw',
          audio: pcmData.toString('base64')
        }
      };
      
      console.log('[ASR] 发送请求:', { aue: encodingValue, pcmSize: pcmData.length });
      ws.send(JSON.stringify(request));
    });

    ws.on('message', (data) => {
      try {
        const resp = JSON.parse(data);
        console.log('[ASR] 讯飞响应:', JSON.stringify(resp).substring(0, 300));
        if (resp.code !== 0) {
          hasError = true;
          ws.close();
          console.error('[ASR] 讯飞返回错误:', resp.code, resp.message);
          return resolve({
            success: false,
            message: `讯飞 ASR 错误: ${resp.message || resp.code}`
          });
        }
        if (resp.data && resp.data.result) {
          const result = resp.data.result;
          if (result.ws) {
            resultText += result.ws.map(w => w.cw.map(c => c.w).join('')).join('');
          }
        }
        if (resp.data && resp.data.status === 2) {
          ws.close();
        }
      } catch (e) {
        hasError = true;
        ws.close();
        console.error('[ASR] 解析响应失败:', e.message);
        return resolve({ success: false, message: '解析讯飞 ASR 响应失败' });
      }
    });

    ws.on('close', () => {
      console.log('[ASR] WebSocket 连接关闭');
      if (hasError) return;
      console.log('[ASR] 识别成功:', resultText);
      resolve({ success: true, text: resultText });
    });

    ws.on('error', (err) => {
      console.error('[ASR] WebSocket 错误:', err.message);
      resolve({ success: false, message: `WebSocket 连接失败: ${err.message}` });
    });

    // 超时保护
    setTimeout(() => {
      if (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING) {
        ws.close();
        if (!hasError) {
          hasError = true;
          console.error('[ASR] 请求超时');
          resolve({ success: false, message: '讯飞 ASR 请求超时' });
        }
      }
    }, 30000);
  });
}

const VOICE_TYPES = [
  { id: 'xiaoyan', name: '小燕', gender: 'female', desc: '标准女声' },
  { id: 'xiaoyu', name: '小宇', gender: 'male', desc: '标准男声' },
  { id: 'catherine', name: 'Catherine', gender: 'female', desc: '英语女声' },
  { id: 'henry', name: 'Henry', gender: 'male', desc: '英语男声' },
  { id: 'victor', name: 'Vitor', gender: 'male', desc: '葡萄牙语男声' },
  { id: 'xiaoqi', name: '小琪', gender: 'female', desc: '粤语女声' },
  { id: 'xiaojuan', name: '小娟', gender: 'female', desc: '台湾女声' },
  { id: 'aisjiuxu', name: '艾丝', gender: 'female', desc: '甜美女声' },
  { id: 'aisxping', name: '小萍', gender: 'female', desc: '清新女声' },
  { id: 'aisjinger', name: '小婧儿', gender: 'female', desc: '甜美童声' }
];

module.exports = {
  textToSpeech,
  speechToText,
  VOICE_TYPES,
  audioDir
};
