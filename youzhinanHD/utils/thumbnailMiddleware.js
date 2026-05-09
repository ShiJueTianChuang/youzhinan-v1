const path = require('path');
const fs = require('fs');

let sharp;
try {
  sharp = require('sharp');
} catch (e) {
  console.warn('[缩略图] sharp 模块加载失败，缩略图功能不可用:', e.message);
  sharp = null;
}

const THUMBNAILS_DIR = 'thumbnails';

const SIZE_PRESETS = {
  small: { width: 300, height: 300, quality: 70 },
  medium: { width: 600, height: 600, quality: 75 },
  large: { width: 1200, height: 1200, quality: 80 }
};

function getThumbDir(uploadsDir) {
  const thumbDir = path.join(uploadsDir, THUMBNAILS_DIR);
  if (!fs.existsSync(thumbDir)) {
    fs.mkdirSync(thumbDir, { recursive: true });
  }
  return thumbDir;
}

async function getOrCreateThumbnail(originalPath, uploadsDir, size = 'small') {
  if (!sharp) return null;

  const preset = SIZE_PRESETS[size] || SIZE_PRESETS.small;
  const thumbDir = getThumbDir(uploadsDir);

  const ext = path.extname(originalPath).toLowerCase();
  const baseName = path.basename(originalPath, ext);
  const thumbFileName = `${baseName}_${size}.webp`;
  const thumbPath = path.join(thumbDir, thumbFileName);

  if (fs.existsSync(thumbPath)) {
    const thumbStat = fs.statSync(thumbPath);
    const origStat = fs.statSync(originalPath);
    if (thumbStat.mtimeMs > origStat.mtimeMs) {
      return thumbPath;
    }
  }

  try {
    await sharp(originalPath, { failOn: 'none' })
      .resize(preset.width, preset.height, {
        fit: 'inside',
        withoutEnlargement: true
      })
      .webp({ quality: preset.quality })
      .toFile(thumbPath);

    return thumbPath;
  } catch (err) {
    console.error(`[缩略图] 生成失败: ${originalPath}`, err.message);
    return null;
  }
}

function thumbnailMiddleware(uploadsDir) {
  return async (req, res, next) => {
    const sizeParam = req.query.size;
    if (!sizeParam || !sharp) {
      return next();
    }

    const preset = SIZE_PRESETS[sizeParam];
    if (!preset) {
      return next();
    }

    const requestedPath = req.path;
    const originalPath = path.join(uploadsDir, requestedPath);

    if (!fs.existsSync(originalPath)) {
      return next();
    }

    try {
      const thumbPath = await getOrCreateThumbnail(originalPath, uploadsDir, sizeParam);

      if (thumbPath) {
        res.setHeader('Content-Type', 'image/webp');
        res.setHeader('Cache-Control', 'public, max-age=2592000, immutable');
        res.setHeader('Vary', 'Accept');
        res.sendFile(thumbPath, (err) => {
          if (err) {
            console.error('[缩略图] 发送失败:', err.message);
            next();
          }
        });
      } else {
        next();
      }
    } catch (err) {
      console.error('[缩略图] 中间件错误:', err.message);
      next();
    }
  };
}

module.exports = {
  thumbnailMiddleware,
  getOrCreateThumbnail,
  SIZE_PRESETS
};
