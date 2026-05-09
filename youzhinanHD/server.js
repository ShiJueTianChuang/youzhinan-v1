require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const multer = require('multer');

const app = express();
const PORT = process.env.PORT || 3000;

try {
  const compression = require('compression');
  app.use(compression({
    filter: (req, res) => {
      if (req.headers['x-no-compression']) return false;
      const contentType = res.getHeader('Content-Type');
      if (contentType && (contentType.startsWith('image/') || contentType.startsWith('video/'))) return false;
      return compression.filter(req, res);
    },
    level: 6
  }));
  console.log('[启动] compression 中间件已启用');
} catch (e) {
  console.warn('[启动] compression 模块不可用，跳过:', e.message);
}

const corsOrigin = process.env.CORS_ORIGIN;
const corsOptions = corsOrigin
  ? {
      origin: corsOrigin.split(',').map(s => s.trim()),
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization'],
      credentials: true
    }
  : {
      origin: '*',
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization']
    };
app.use(cors(corsOptions));

app.use(bodyParser.json({ limit: '50mb' }));
app.use(bodyParser.urlencoded({ extended: true, limit: '50mb' }));

const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

try {
  const { thumbnailMiddleware } = require('./utils/thumbnailMiddleware');
  app.use('/uploads', thumbnailMiddleware(uploadsDir));
  console.log('[启动] 缩略图中间件已启用');
} catch (e) {
  console.warn('[启动] 缩略图中间件不可用，跳过:', e.message);
}

app.use('/uploads', express.static(path.join(__dirname, 'uploads'), {
  maxAge: '30d',
  immutable: true,
  etag: true,
  lastModified: true
}));
app.use(express.static(path.join(__dirname)));

const userRouter = require('./routes/user');
const infoRouter = require('./routes/info');
const categoryRouter = require('./routes/category');
const imagesRouter = require('./routes/images');
const speechRouter = require('./routes/speech');
const aiChatRouter = require('./routes/aiChat');
const aiModelRouter = require('./routes/aiModel');
const adminRouter = require('./routes/admin');
const adminSubmissionsRouter = require('./routes/adminSubmissions');
const submissionsRouter = require('./routes/submissions');
const statsRouter = require('./routes/stats');
const aboutRouter = require('./routes/about');
const appRouter = require('./routes/app');
const appVersionRouter = require('./routes/appVersion');
const lotteryRouter = require('./routes/lottery');
const messagesRouter = require('./routes/messages');
const regionsRouter = require('./routes/regions');
const smsAuthRouter = require('./routes/smsAuth');
const emailAuthRouter = require('./routes/emailAuth');
const wxloginRouter = require('./routes/wxlogin');
const gaodeRouter = require('./routes/gaode');
const customerServiceRouter = require('./routes/customerService');
const nearbyRouter = require('./routes/nearby');

app.use('/api/user', userRouter);
app.use('/api/info', infoRouter);
app.use('/api/category', categoryRouter);
app.use('/api/images', imagesRouter);
app.use('/api/speech', speechRouter);
app.use('/api/ai', aiChatRouter);
app.use('/api/ai-model', aiModelRouter);
app.use('/api/admin', adminRouter);
app.use('/api/admin/submissions', adminSubmissionsRouter);
app.use('/api/submissions', submissionsRouter);
app.use('/api/stats', statsRouter);
app.use('/api/about', aboutRouter);
app.use('/api/app', appRouter);
app.use('/api/app-version', appVersionRouter);
app.use('/api/lottery', lotteryRouter);
app.use('/api/messages', messagesRouter);
app.use('/api/regions', regionsRouter);
app.use('/api/sms-auth', smsAuthRouter);
app.use('/api/email-auth', emailAuthRouter);
app.use('/api/wxlogin', wxloginRouter);
app.use('/api/gaode', gaodeRouter);
app.use('/api/customer-service', customerServiceRouter);
app.use('/api/nearby', nearbyRouter);

app.get('/invite/:code', (req, res) => {
  res.sendFile(path.join(__dirname, 'invite.html'));
});

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.use((req, res) => {
  res.status(404).json({ error: '接口不存在', path: req.originalUrl });
});

app.use((err, req, res, next) => {
  console.error('服务器错误:', err);
  res.status(500).json({ error: '服务器内部错误', message: err.message });
});

app.listen(PORT, () => {
  console.log(`服务器运行在端口 ${PORT}`);
  console.log(`健康检查: http://localhost:${PORT}/api/health`);
});

module.exports = app;
