const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const db = require('../config/db');
const { authenticate, requireAdmin } = require('../middleware/auth');

const apkDir = path.join(__dirname, '..', 'uploads', 'apk');
if (!fs.existsSync(apkDir)) {
  fs.mkdirSync(apkDir, { recursive: true });
}

const calculateMD5 = (filePath) => {
  return new Promise((resolve, reject) => {
    const hash = crypto.createHash('md5');
    const stream = fs.createReadStream(filePath);
    
    stream.on('error', reject);
    stream.on('data', (chunk) => hash.update(chunk));
    stream.on('end', () => resolve(hash.digest('hex')));
  });
};

const apkStorage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, apkDir),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname) || '.apk';
    cb(null, `app-${Date.now()}${ext}`);
  }
});

const apkUpload = multer({
  storage: apkStorage,
  limits: { fileSize: 200 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (ext === '.apk') {
      cb(null, true);
    } else {
      cb(new Error('只允许上传 APK 文件'));
    }
  }
});

router.get('/check', async (req, res) => {
  try {
    const currentVersionCode = parseInt(req.query.versionCode || req.query.version_code) || 0;

    const [rows] = await db.query(
      'SELECT * FROM app_version WHERE is_active = 1 ORDER BY version_code DESC LIMIT 1'
    );

    if (rows.length === 0) {
      return res.json({
        code: 200,
        message: 'success',
        data: { hasUpdate: false }
      });
    }

    const latest = rows[0];

    if (latest.version_code <= currentVersionCode) {
      return res.json({
        code: 200,
        message: 'success',
        data: { hasUpdate: false }
      });
    }

    res.json({
      code: 200,
      message: 'success',
      data: {
        hasUpdate: true,
        versionCode: latest.version_code,
        versionName: latest.version_name,
        downloadUrl: latest.download_url,
        updateDescription: latest.update_description || '',
        forceUpdate: latest.force_update === 1,
        fileSize: latest.file_size || 0,
        md5: latest.md5 || ''
      }
    });
  } catch (error) {
    console.error('检查更新失败:', error.message);
    res.status(500).json({
      code: 500,
      message: '检查更新失败',
      data: null
    });
  }
});

router.post('/upload-apk', authenticate, requireAdmin, apkUpload.single('apk'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ code: 400, message: '请上传 APK 文件', data: null });
    }

    const filePath = path.join(apkDir, req.file.filename);
    const md5 = await calculateMD5(filePath);
    const fileSize = req.file.size;
    const downloadUrl = `${process.env.PUBLIC_ORIGIN || 'https://your-domain.com'}/uploads/apk/${req.file.filename}`;

    res.json({
      code: 200,
      message: '上传成功',
      data: {
        downloadUrl: downloadUrl,
        fileSize: fileSize,
        fileName: req.file.filename,
        md5: md5
      }
    });
  } catch (error) {
    console.error('APK 上传失败:', error.message);
    res.status(500).json({ code: 500, message: error.message, data: null });
  }
});

router.post('/publish', authenticate, requireAdmin, async (req, res) => {
  try {
    const { versionCode, versionName, downloadUrl, updateDescription, forceUpdate, fileSize, md5 } = req.body;

    if (!versionCode || !versionName || !downloadUrl) {
      return res.status(400).json({
        code: 400,
        message: '缺少必要参数（versionCode, versionName, downloadUrl）',
        data: null
      });
    }

    const [existing] = await db.query(
      'SELECT id FROM app_version WHERE version_code = ?',
      [versionCode]
    );

    if (existing.length > 0) {
      return res.status(400).json({
        code: 400,
        message: '该版本号已存在',
        data: null
      });
    }

    await db.query('UPDATE app_version SET is_active = 0');

    const [result] = await db.query(
      'INSERT INTO app_version (version_code, version_name, download_url, update_description, force_update, file_size, md5, is_active) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [
        parseInt(versionCode),
        versionName,
        downloadUrl,
        updateDescription || '',
        forceUpdate ? 1 : 0,
        parseInt(fileSize) || 0,
        md5 || null,
        1
      ]
    );

    res.json({
      code: 200,
      message: '发布成功',
      data: { id: result.insertId }
    });
  } catch (error) {
    console.error('发布版本失败:', error.message);
    res.status(500).json({ code: 500, message: error.message, data: null });
  }
});

router.get('/list', authenticate, requireAdmin, async (req, res) => {
  try {
    const [rows] = await db.query(
      'SELECT * FROM app_version ORDER BY version_code DESC LIMIT 20'
    );

    res.json({
      code: 200,
      message: 'success',
      data: rows
    });
  } catch (error) {
    console.error('获取版本列表失败:', error.message);
    res.status(500).json({ code: 500, message: error.message, data: null });
  }
});

router.delete('/:id', authenticate, requireAdmin, async (req, res) => {
  try {
    const [result] = await db.query('DELETE FROM app_version WHERE id = ?', [req.params.id]);

    if (result.affectedRows === 0) {
      return res.status(404).json({ code: 404, message: '版本不存在', data: null });
    }

    res.json({ code: 200, message: '删除成功', data: null });
  } catch (error) {
    console.error('删除版本失败:', error.message);
    res.status(500).json({ code: 500, message: error.message, data: null });
  }
});

router.put('/:id/activate', authenticate, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;

    const [versionCheck] = await db.query(
      'SELECT id FROM app_version WHERE id = ?',
      [id]
    );

    if (versionCheck.length === 0) {
      return res.status(404).json({ code: 404, message: '版本不存在', data: null });
    }

    await db.query('UPDATE app_version SET is_active = 0');
    await db.query('UPDATE app_version SET is_active = 1 WHERE id = ?', [id]);

    res.json({ code: 200, message: '激活成功', data: null });
  } catch (error) {
    console.error('激活版本失败:', error.message);
    res.status(500).json({ code: 500, message: error.message, data: null });
  }
});

router.put('/:id/deactivate', authenticate, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;

    const [result] = await db.query(
      'UPDATE app_version SET is_active = 0 WHERE id = ?',
      [id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ code: 404, message: '版本不存在', data: null });
    }

    res.json({ code: 200, message: '停用成功', data: null });
  } catch (error) {
    console.error('停用版本失败:', error.message);
    res.status(500).json({ code: 500, message: error.message, data: null });
  }
});

router.get('/latest-apk', async (req, res) => {
  try {
    const [rows] = await db.query(
      'SELECT download_url FROM app_version WHERE is_active = 1 ORDER BY version_code DESC LIMIT 1'
    );

    if (rows.length === 0 || !rows[0].download_url) {
      return res.status(404).json({ code: 404, message: '暂无可下载的版本', data: null });
    }

    res.redirect(rows[0].download_url);
  } catch (error) {
    console.error('获取最新APK失败:', error.message);
    res.status(500).json({ code: 500, message: '获取下载链接失败', data: null });
  }
});

module.exports = router;
