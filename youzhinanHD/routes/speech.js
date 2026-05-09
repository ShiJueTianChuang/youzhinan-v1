const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const { authenticate } = require('../middleware/auth');
const { textToSpeech, speechToText, VOICE_TYPES } = require('../utils/speechService');

const tempAudioDir = path.join(__dirname, '..', 'uploads', 'temp-audio');
const fs = require('fs');
if (!fs.existsSync(tempAudioDir)) {
  fs.mkdirSync(tempAudioDir, { recursive: true });
}

const audioUpload = multer({
  dest: tempAudioDir,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const allowedExts = ['.wav', '.mp3', '.m4a', '.ogg'];
    if (allowedExts.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error('只支持 wav/mp3/m4a/ogg 格式'));
    }
  }
});

router.get('/voices', (req, res) => {
  res.json({
    code: 200,
    message: 'success',
    data: VOICE_TYPES
  });
});

router.post('/tts', authenticate, async (req, res) => {
  try {
    const { text, voiceType = 'xiaofeng' } = req.body;

    if (!text || !text.trim()) {
      return res.status(400).json({
        code: 400,
        message: '文本内容不能为空',
        data: null
      });
    }

    if (text.length > 5000) {
      return res.status(400).json({
        code: 400,
        message: '文本长度不能超过5000字',
        data: null
      });
    }

    const result = await textToSpeech(text.trim(), voiceType);

    if (result.success) {
      res.json({
        code: 200,
        message: 'success',
        data: {
          url: result.url,
          fileName: result.fileName
        }
      });
    } else {
      res.status(500).json({
        code: 500,
        message: result.message,
        data: null
      });
    }
  } catch (error) {
    console.error('语音合成失败:', error.message);
    res.status(500).json({
      code: 500,
      message: error.message || '语音合成服务异常',
      data: null
    });
  }
});

router.post('/asr', authenticate, audioUpload.single('audio'), async (req, res) => {
  try {
    console.log('[ASR Route] 收到请求');
    
    if (!req.file) {
      console.error('[ASR Route] 没有上传文件');
      return res.status(400).json({
        code: 400,
        message: '请上传音频文件',
        data: null
      });
    }

    console.log('[ASR Route] 文件信息:', {
      originalname: req.file.originalname,
      mimetype: req.file.mimetype,
      size: req.file.size,
      path: req.file.path
    });

    const audioBuffer = fs.readFileSync(req.file.path);
    const ext = path.extname(req.file.originalname).toLowerCase().substring(1);
    
    console.log('[ASR Route] 开始识别, 格式:', ext);
    const result = await speechToText(audioBuffer, ext, 16000);

    // 清理临时文件
    try {
      fs.unlinkSync(req.file.path);
      console.log('[ASR Route] 临时文件已删除');
    } catch (e) {
      console.warn('[ASR Route] 删除临时文件失败:', e.message);
    }

    if (result.success) {
      console.log('[ASR Route] 识别成功');
      res.json({
        code: 200,
        message: 'success',
        data: { text: result.text }
      });
    } else {
      console.error('[ASR Route] 识别失败:', result.message);
      res.status(500).json({
        code: 500,
        message: result.message,
        data: null
      });
    }
  } catch (error) {
    console.error('[ASR Route] 异常:', error.message, error.stack);
    if (req.file && fs.existsSync(req.file.path)) {
      try {
        fs.unlinkSync(req.file.path);
      } catch (e) {}
    }
    res.status(500).json({
      code: 500,
      message: error.message || '语音识别服务异常',
      data: null
    });
  }
});

module.exports = router;
