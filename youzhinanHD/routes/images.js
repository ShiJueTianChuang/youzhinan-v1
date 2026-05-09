const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const jwt = require('jsonwebtoken');
const { authenticate } = require('../middleware/auth');

const PUBLIC_ORIGIN = (process.env.PUBLIC_ORIGIN || 'https://your-domain.com').replace(/\/$/, '');

// 确保上传目录存在
const uploadDir = path.join(__dirname, '../uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// 配置multer存储
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = file.mimetype === 'image/png' ? '.png' : '.jpg';
    cb(null, `images-${uniqueSuffix}${ext}`);
  }
});

// 与 info 配图一致：仅 JPG/PNG，便于微信分享卡片使用同域图
const fileFilter = (req, file, cb) => {
  const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png'];
  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('只允许上传 JPG、PNG 图片'), false);
  }
};

// 创建multer实例
const upload = multer({
  storage: storage,
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB文件大小限制
  },
  fileFilter: fileFilter
});

// 可选认证中间件 - 不强制要求token，但如果提供了就验证
const optionalAuth = (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.split(' ')[1];
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      req.user = decoded;
    }
  } catch (error) {
    // token无效时不报错，只是不设置req.user
    console.log('图片上传：token无效或过期，但不影响上传');
  }
  next();
};

// 上传图片 - 使用 upload.any() 兼容所有字段名
// 微信小程序使用 wx.uploadFile 时表单字段名通常为 'file'
// APP使用 Retrofit 时表单字段名为 'image'
router.post('/upload', optionalAuth, upload.any(), (req, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ error: '未选择文件' });
    }

    const file = req.files[0];

    // 构建图片URL
    const imageUrl = `/uploads/${file.filename}`;
    const fullUrl = `${PUBLIC_ORIGIN}${imageUrl}`;

    const responseData = {
      success: true,
      message: '图片上传成功',
      data: {
        filename: file.filename,
        url: imageUrl,
        fullUrl: fullUrl,
        size: file.size,
        mimetype: file.mimetype,
        path: file.path
      }
    };

    // 如果用户已认证，添加用户信息
    if (req.user) {
      responseData.userId = req.user.userId || req.user.id;
    }

    console.log(`图片上传成功: ${fullUrl}${req.user ? ', 用户: ' + (req.user.userId || req.user.id) : ', 未登录'}`);

    res.json(responseData);
  } catch (error) {
    console.error('上传图片时出错:', error);
    res.status(500).json({ error: '上传图片失败', message: error.message });
  }
});

// 获取图片列表
router.get('/list', (req, res) => {
  try {
    // 读取上传目录中的所有文件
    fs.readdir(uploadDir, (err, files) => {
      if (err) {
        console.error('读取上传目录失败:', err);
        return res.status(500).json({ error: '读取图片列表失败' });
      }

      // 过滤出图片文件
      const imageFiles = files.filter(file => {
        const ext = path.extname(file).toLowerCase();
        return ['.jpg', '.jpeg', '.png', '.gif'].includes(ext);
      });

      // 构建图片信息列表
      const images = imageFiles.map(filename => {
        const filePath = path.join(uploadDir, filename);
        let size = 0;
        let modifiedTime = new Date();

        try {
          const stats = fs.statSync(filePath);
          size = stats.size;
          modifiedTime = stats.mtime;
        } catch (err) {
          console.error('获取文件信息失败:', err);
        }

        return {
          filename: filename,
          url: `/uploads/${filename}`,
          fullUrl: `${PUBLIC_ORIGIN}/uploads/${filename}`,
          size: size,
          modifiedTime: modifiedTime.toISOString()
        };
      });

      // 按修改时间倒序排序
      images.sort((a, b) => new Date(b.modifiedTime) - new Date(a.modifiedTime));

      res.json({
        success: true,
        data: images,
        total: images.length
      });
    });
  } catch (error) {
    console.error('获取图片列表时出错:', error);
    res.status(500).json({ error: '获取图片列表失败', message: error.message });
  }
});

// 删除图片 - 需要认证
router.delete('/delete/:filename', authenticate, (req, res) => {
  try {
    const filename = req.params.filename;
    const filePath = path.join(uploadDir, filename);

    // 检查文件是否存在
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: '图片不存在' });
    }

    // 删除文件
    fs.unlinkSync(filePath);

    res.json({
      success: true,
      message: '图片删除成功'
    });
  } catch (error) {
    console.error('删除图片时出错:', error);
    res.status(500).json({ error: '删除图片失败', message: error.message });
  }
});

// 批量删除图片 - 需要认证
router.delete('/batch-delete', authenticate, (req, res) => {
  try {
    const { filenames } = req.body;

    if (!Array.isArray(filenames) || filenames.length === 0) {
      return res.status(400).json({ error: '请提供要删除的图片文件名列表' });
    }

    let deletedCount = 0;
    const errors = [];

    // 遍历删除每个文件
    filenames.forEach(filename => {
      try {
        const filePath = path.join(uploadDir, filename);

        // 检查文件是否存在
        if (fs.existsSync(filePath)) {
          // 删除文件
          fs.unlinkSync(filePath);
          deletedCount++;
        } else {
          errors.push(`文件 ${filename} 不存在`);
        }
      } catch (error) {
        console.error(`删除文件 ${filename} 时出错:`, error);
        errors.push(`删除文件 ${filename} 失败: ${error.message}`);
      }
    });

    res.json({
      success: true,
      message: `批量删除完成，成功删除 ${deletedCount} 张图片`,
      deletedCount: deletedCount,
      totalCount: filenames.length,
      errors: errors
    });
  } catch (error) {
    console.error('批量删除图片时出错:', error);
    res.status(500).json({ error: '批量删除图片失败', message: error.message });
  }
});

module.exports = router;