const express = require('express');
const multer = require('multer');
const path = require('path');
const router = express.Router();

let db;
try {
  db = require('../config/db');
} catch (error) {
  console.error('数据库连接失败:', error.message);
}

const { authenticate } = require('../middleware/auth');
const { geocodeAddress } = require('./gaode');

/** 对外展示用的站点根（与小程序 downloadFile / 分享图一致） */
const PUBLIC_ORIGIN = (process.env.PUBLIC_ORIGIN || 'https://your-domain.com').replace(/\/$/, '');

const ALLOWED_INFO_IMAGE_MIMES = new Set(['image/jpeg', 'image/jpg', 'image/png']);

/**
 * 将已存储的图片地址规范为「本站相对路径 /uploads/...」，便于前端用 API_BASE_URL 拼接；
 * 第三方 OSS/CDN 完整 URL 原样返回，需在公众平台单独配置 downloadFile。
 */
function normalizeStoredImageUrl(url) {
  if (url == null || typeof url !== 'string') return url;
  const u = url.trim();
  if (!u) return u;
  if (u.startsWith('/uploads/')) return u;
  if (!/^https?:\/\//i.test(u)) return u;
  try {
    const parsed = new URL(u);
    const host = parsed.hostname.toLowerCase();
    if (host === (process.env.PUBLIC_ORIGIN || 'https://your-domain.com').replace(/^https?:\/\//, '').replace(/\/$/, '') || host === 'localhost') {
      return `${parsed.pathname}${parsed.search || ''}`;
    }
  } catch (e) {
    /* ignore */
  }
  return u;
}

function normalizeImageList(urls) {
  if (!Array.isArray(urls)) return urls;
  return urls.map(normalizeStoredImageUrl);
}

function extForShareSafeImage(mimetype) {
  if (mimetype === 'image/png') return '.png';
  return '.jpg';
}

// 解析联系方式
const parseContact = (contact) => {
  if (!contact) return { phone: [], wechat: [], landline: [] };
  
  try {
    const parsed = JSON.parse(contact);
    return {
      phone: Array.isArray(parsed.phone) ? parsed.phone : (parsed.phone ? [parsed.phone] : []),
      wechat: Array.isArray(parsed.wechat) ? parsed.wechat : (parsed.wechat ? [parsed.wechat] : []),
      landline: Array.isArray(parsed.landline) ? parsed.landline : (parsed.landline ? [parsed.landline] : [])
    };
  } catch (e) {
    // 如果不是 JSON，当作旧格式（纯文本，当作手机号）
    return {
      phone: [contact],
      wechat: [],
      landline: []
    };
  }
};

// 获取服务器端口
const PORT = parseInt(process.env.PORT) || 3003;

// 配置multer用于文件上传
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'uploads/'); // 指定上传目录
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = extForShareSafeImage(file.mimetype);
    cb(null, file.fieldname + '-' + uniqueSuffix + ext);
  }
});

const upload = multer({ 
  storage: storage,
  limits: {
    fileSize: 5 * 1024 * 1024, // 限制文件大小为5MB
    files: 3 // 限制同时上传文件数量
  },
  fileFilter: (req, file, cb) => {
    if (ALLOWED_INFO_IMAGE_MIMES.has(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('只允许上传 JPG、PNG 图片（微信分享卡片仅支持 JPEG/PNG）'));
    }
  }
});

/** 捕获 multer 上传校验错误，返回 400 */
function handleInfoUploadError(req, res, next) {
  const run = upload.array('images', 3);
  run(req, res, (err) => {
    if (err) {
      const msg = err.message || '图片上传失败';
      return res.status(400).json({ error: msg });
    }
    next();
  });
}

// 获取所有信息
router.get('/', async (req, res) => {
  try {
    if (!db) {
      return res.status(503).json([]);
    }
    
    // 尝试解析token以便返回收藏状态
    let userId = null;
    let openid = null;
    const authHeader = req.headers.authorization;
    if (authHeader) {
      try {
        const token = authHeader.split(' ')[1];
        const decoded = require('jsonwebtoken').verify(token, process.env.JWT_SECRET);
        userId = decoded.id || decoded.userId || decoded.user_id;
        openid = decoded.openid || decoded.wx_openid;
      } catch (e) {
        // ignore invalid token
      }
    }

    const { search } = req.query;
    let rows;
    
    if (search) {
      // 构建模糊查询 SQL
      const searchQuery = `%${search}%`;
      
      // 定义中英文分类映射
      const categoryMap = {
        '酒吧': ['酒吧', 'bar'],
        'bar': ['酒吧', 'bar'],
        '民宿': ['民宿', 'homestay'],
        'homestay': ['民宿', 'homestay'],
        '公园': ['公园', 'park'],
        'park': ['公园', 'park'],
        '其他': ['其他', 'others'],
        'others': ['其他', 'others']
      };
      
      // 构建分类搜索条件
      let categorySearchConditions = '';
      let queryParams = [searchQuery]; // 初始包含 store_name 的搜索参数
      
      // 检查是否需要特殊处理分类搜索
      if (categoryMap[search]) {
        // 如果是精确匹配的分类关键词，同时搜索中英文分类
        const categories = categoryMap[search];
        const placeholders = categories.map(() => 'category = ?').join(' OR ');
        categorySearchConditions = `OR (${placeholders}) OR `;
        queryParams = queryParams.concat(categories);
      } else {
        // 否则使用模糊分类搜索
        categorySearchConditions = 'OR category LIKE ? OR ';
        queryParams.push(searchQuery);
      }
      
      // 添加其他搜索条件的参数
      queryParams.push(searchQuery, searchQuery, searchQuery, searchQuery);
      
      [rows] = await db.query(
        `SELECT * FROM info 
         WHERE store_name LIKE ? 
            ${categorySearchConditions}
            province LIKE ? 
            OR city LIKE ? 
            OR district LIKE ? 
            OR address LIKE ?
         ORDER BY sort_order ASC`,
        queryParams
      );
    } else {
      [rows] = await db.query('SELECT * FROM info ORDER BY sort_order ASC');
    }
    
    // 处理每条记录的图片字段和联系方式
    const processedRows = rows.map(row => {
      let images = [];
      if (row.images) {
        if (typeof row.images === 'string') {
          try {
            images = JSON.parse(row.images);
            if (!Array.isArray(images)) images = [];
          } catch (e) {
            images = [];
          }
        } else if (Array.isArray(row.images)) {
          images = row.images;
        }
      }
      
      // 解析联系方式为对象格式
      let contactObj = { phone: [], landline: [], wechat: [] };
      if (row.contact) {
        try {
          contactObj = typeof row.contact === 'string' ? JSON.parse(row.contact) : row.contact;
        } catch (e) {
          // 如果是旧格式，尝试转换
          contactObj = { phone: [row.contact], landline: [], wechat: [] };
        }
      }
      
      // 返回列表时不脱敏，返回完整联系方式；图片统一为 /uploads/... 或第三方 URL
      return { ...row, images: normalizeImageList(images), contact: contactObj };
    });
    
    // 如果有用户信息，查询收藏数据并标记
    if ((userId || openid) && processedRows.length > 0) {
      const ids = processedRows.map(r => r.id);
      let favoriteRows = [];
      try {
        const placeholders = ids.map(() => '?').join(',');
        const params = [];
        let query = 'SELECT info_id FROM favorites WHERE (';
        const conditions = [];
        if (openid) {
          conditions.push('openid = ?');
          params.push(openid);
        }
        if (userId) {
          conditions.push('user_id = ?');
          params.push(userId);
        }
        query += conditions.join(' OR ') + ') AND info_id IN (' + placeholders + ')';
        params.push(...ids);
        const [favRes] = await db.query(query, params);
        favoriteRows = favRes;
      } catch (e) {
        console.error('获取收藏状态失败:', e.message);
      }
      const favSet = new Set(favoriteRows.map(r => r.info_id));
      processedRows.forEach(r => {
        r.isFavorited = favSet.has(r.id);
      });
    }

    res.json(processedRows);
  } catch (error) {
    console.error(error.message);
    res.status(500).json([]);
  }
});

// 微信小程序专用API - 返回兼容的数据格式
router.get('/wechat', async (req, res) => {
  try {
    const [rows] = await db.query('SELECT * FROM info ORDER BY sort_order ASC');
    
    // 转换为微信小程序兼容格式
    const wechatData = rows.map(row => {
      // 处理图片数据
      let images = [];
      if (row.images) {
        if (Array.isArray(row.images)) {
          // 已经是数组，直接使用
          images = row.images;
        } else if (typeof row.images === 'string') {
          // 是字符串，需要解析
          try {
            images = JSON.parse(row.images);
            if (!Array.isArray(images)) images = [];
          } catch (e) {
            images = [];
          }
        }
      }
      
      const normalized = normalizeImageList(images);
      const fullImages = normalized.map((img) => {
        if (!img || typeof img !== 'string') return img;
        if (/^https?:\/\//i.test(img)) return img;
        return `${PUBLIC_ORIGIN}${img.startsWith('/') ? '' : '/'}${img}`;
      });
      
      // 根据分类确定标签
      const tags = [];
      // 只添加唯一标签，避免重复
      if (row.category && ['酒吧', '民宿', '公园', '休闲'].includes(row.category)) {
        tags.push(row.category);
      }
      
      // 处理评分：1-100分整数，支持"暂无评分"
      let ratingDisplay;  // 显示用的字符串
      let ratingValue;    // 数字值，用于筛选
      if (row.rating === null || row.rating === undefined || row.rating === '') {
        ratingDisplay = "暂无评分";
        ratingValue = null;
      } else {
        const ratingNum = parseInt(row.rating);
        if (isNaN(ratingNum)) {
          ratingDisplay = "暂无评分";
          ratingValue = null;
        } else {
          // 限制评分范围为1-100整数
          ratingValue = Math.max(1, Math.min(100, ratingNum));
          ratingDisplay = `${ratingValue}分`;
        }
      }

      // 解析联系方式为对象格式
      let contactObj = { phone: [], landline: [], wechat: [] };
      if (row.contact) {
        try {
          contactObj = typeof row.contact === 'string' ? JSON.parse(row.contact) : row.contact;
        } catch (e) {
          // 如果是旧格式，尝试转换
          contactObj = { phone: [row.contact], landline: [], wechat: [] };
        }
      }

      return {
        id: row.id,
        name: row.store_name,
        category: row.category,
        province: row.province,
        city: row.city,
        district: row.district,
        address: row.address,
        contact: contactObj,  // 返回完整联系方式对象，由小程序端自行脱敏
        description: row.description || '',
        business_hours: row.business_hours || '',
        price: row.price,
        latitude: row.latitude ? parseFloat(row.latitude) : null,
        longitude: row.longitude ? parseFloat(row.longitude) : null,
        rating: ratingValue,
        ratingDisplay: ratingDisplay,
        tags: tags,
        images: fullImages,
        image_url: fullImages.length > 0 ? fullImages[0] : '',
        addTime: new Date(row.created_at).getTime()
      };
    });
    
    res.json(wechatData);
  } catch (error) {
    console.error(error.message);
    res.status(500).json({ error: '服务器内部错误' });
  }
});

// 搜索信息
router.get('/search', async (req, res) => {
  try {
    const { q } = req.query;
    if (!q) {
      return res.status(400).json({ error: '搜索关键词不能为空' });
    }
    
    // 构建模糊查询SQL
    const searchQuery = `%${q}%`;
    
    // 定义中英文分类映射
    const categoryMap = {
      '酒吧': ['酒吧', 'bar'],
      'bar': ['酒吧', 'bar'],
      '民宿': ['民宿', 'homestay'],
      'homestay': ['民宿', 'homestay'],
      '公园': ['公园', 'park'],
      'park': ['公园', 'park'],
      '其他': ['其他', 'others'],
      'others': ['其他', 'others']
    };
    
    // 构建分类搜索条件
    let categorySearchConditions = '';
    let queryParams = [searchQuery]; // 初始包含 store_name 的搜索参数
    
    // 检查是否需要特殊处理分类搜索
    if (categoryMap[q]) {
      // 如果是精确匹配的分类关键词，同时搜索中英文分类
      const categories = categoryMap[q];
      const placeholders = categories.map(() => 'category = ?').join(' OR ');
      categorySearchConditions = `OR (${placeholders}) OR `;
      queryParams = queryParams.concat(categories);
    } else {
      // 否则使用模糊分类搜索
      categorySearchConditions = 'OR category LIKE ? OR ';
      queryParams.push(searchQuery);
    }
    
    // 添加其他搜索条件的参数
    queryParams.push(searchQuery, searchQuery, searchQuery, searchQuery);
    
    const [rows] = await db.query(
      `SELECT * FROM info 
       WHERE store_name LIKE ? 
          ${categorySearchConditions}
          province LIKE ? 
          OR city LIKE ? 
          OR district LIKE ? 
          OR address LIKE ?
       ORDER BY sort_order ASC`,
      queryParams
    );
    
    res.json(rows);
  } catch (error) {
    console.error(error.message);
    res.status(500).json({ error: '服务器内部错误' });
  }
});

// 获取单条信息
router.get('/:id', async (req, res) => {
  try {
    const [rows] = await db.query('SELECT * FROM info WHERE id = ?', [req.params.id]);
    if (rows.length === 0) {
      return res.status(404).json({ error: '信息不存在' });
    }
    
    const row = rows[0];
    // 处理图片字段
    let images = [];
    if (row.images) {
      if (typeof row.images === 'string') {
        try {
          images = JSON.parse(row.images);
          if (!Array.isArray(images)) images = [];
        } catch (e) {
          images = [];
        }
      } else if (Array.isArray(row.images)) {
        images = row.images;
      }
    }
    
    res.json({ ...row, images: normalizeImageList(images) });
  } catch (error) {
    console.error(error.message);
    res.status(500).json({ error: '服务器内部错误' });
  }
});

// 增加查看次数
router.post('/:id/view', async (req, res) => {
  try {
    const infoId = req.params.id;
    
    // 先检查信息是否存在
    const [rows] = await db.query('SELECT id FROM info WHERE id = ?', [infoId]);
    if (rows.length === 0) {
      return res.status(404).json({ error: '信息不存在' });
    }
    
    // 增加查看次数
    await db.query('UPDATE info SET view_count = view_count + 1 WHERE id = ?', [infoId]);
    
    res.json({ success: true, message: '查看次数已增加' });
  } catch (error) {
    console.error('增加查看次数失败:', error.message);
    res.status(500).json({ error: '服务器内部错误' });
  }
});

// 获取完整联系方式 - 需要登录，每日限6次
router.post('/:id/contact', authenticate, async (req, res) => {
  try {
    const infoId = req.params.id;
    const userId = req.user.id || req.user.user_id;
    const { type = 'phone', index = 0 } = req.body;
    
    if (!userId) {
      return res.status(401).json({ code: 401, message: '请先登录' });
    }
    
    // 检查信息是否存在
    const [infoRows] = await db.query('SELECT contact FROM info WHERE id = ?', [infoId]);
    if (infoRows.length === 0) {
      return res.status(404).json({ code: 404, message: '信息不存在' });
    }
    
    const contactData = parseContact(infoRows[0].contact);
    const contacts = contactData[type] || [];
    
    if (contacts.length === 0) {
      return res.status(400).json({ code: 400, message: '该信息暂无此类型联系方式' });
    }
    
    const contactIndex = Math.min(Math.max(0, index), contacts.length - 1);
    const contactValue = contacts[contactIndex];
    
    if (!contactValue) {
      return res.status(400).json({ code: 400, message: '联系方式不存在' });
    }
    
    // 检查今日拨打次数
    const today = new Date().toISOString().split('T')[0];
    const [countRows] = await db.query(
      'SELECT COUNT(*) as count FROM call_records WHERE user_id = ? AND DATE(called_at) = ?',
      [userId, today]
    );
    const todayCount = countRows[0].count;
    
    if (todayCount >= 6) {
      return res.status(429).json({ code: 429, message: '今日拨打次数已达上限（6次）' });
    }
    
    // 记录拨打历史
    await db.query(
      'INSERT INTO call_records (user_id, info_id, contact_type, contact_value) VALUES (?, ?, ?, ?)',
      [userId, infoId, type, contactValue]
    );
    
    // 返回完整联系方式
    res.json({ 
      code: 200, 
      message: '获取成功', 
      data: { 
        contact: contactValue,
        type: type,
        index: contactIndex,
        remaining: 6 - todayCount - 1
      } 
    });
    
  } catch (error) {
    console.error('获取联系方式失败:', error.message);
    res.status(500).json({ code: 500, message: '服务器内部错误' });
  }
});

// 添加信息（支持图片上传）- 需要认证
router.post('/', authenticate, handleInfoUploadError, async (req, res) => {
  try {
    console.log('Add Info - Request Body Keys:', Object.keys(req.body || {}));
    console.log('Add Info - Request Body Content:', req.body);
    console.log('Add Info - Request Files:', req.files);
    
    const { store_name, category, province, city, district, address, contact, description, business_hours, price, latitude, longitude, rating } = req.body;
    
    // 检查必要字段
    if (!store_name || typeof store_name !== 'string' || store_name.trim() === '') {
      return res.status(400).json({ error: '店名不能为空' });
    }
    if (!category || typeof category !== 'string' || category.trim() === '') {
      return res.status(400).json({ error: '分类不能为空' });
    }
    if (!province || typeof province !== 'string' || province.trim() === '') {
      return res.status(400).json({ error: '省份不能为空' });
    }
    if (!city || typeof city !== 'string' || city.trim() === '') {
      return res.status(400).json({ error: '城市不能为空' });
    }
    if (!district || typeof district !== 'string' || district.trim() === '') {
      return res.status(400).json({ error: '区县不能为空' });
    }
    if (!address || typeof address !== 'string' || address.trim() === '') {
      return res.status(400).json({ error: '地址不能为空' });
    }
    
    // 检查字段长度
    if (store_name.length > 100) {
      return res.status(400).json({ error: '店名长度不能超过100个字符' });
    }
    if (category.length > 50) {
      return res.status(400).json({ error: '分类长度不能超过50个字符' });
    }
    if (province.length > 50) {
      return res.status(400).json({ error: '省份长度不能超过50个字符' });
    }
    if (city.length > 50) {
      return res.status(400).json({ error: '城市长度不能超过50个字符' });
    }
    if (district.length > 50) {
      return res.status(400).json({ error: '区县长度不能超过50个字符' });
    }
    if (address.length > 1000) {
      return res.status(400).json({ error: '地址长度不能超过 1000 个字符' });
    }
    if (contact && contact.length > 5000) {
      return res.status(400).json({ error: '联系方式长度不能超过 5000 个字符' });
    }
    if (description && description.length > 5000) {
      return res.status(400).json({ error: '描述长度不能超过5000个字符' });
    }
    if (business_hours && business_hours.length > 200) {
      return res.status(400).json({ error: '营业时间长度不能超过200个字符' });
    }
    // 处理空值，转换为空字符串、undefined或null为null
    const processedPrice = (price === '' || price === undefined || price === null || price === 'null') ? null : parseFloat(price);
    let processedLatitude = (latitude === '' || latitude === undefined || latitude === null || latitude === 'null') ? null : parseFloat(latitude);
    let processedLongitude = (longitude === '' || longitude === undefined || longitude === null || longitude === 'null') ? null : parseFloat(longitude);
    
    // 处理评分：1-100分整数，支持null和"暂无评分"
    let processedRating;
    // 检查是否为null、undefined或空字符串，或者是"暂无评分"字符串
    if (rating === '' || rating === undefined || rating === null || rating === 'null' || rating === '暂无评分') {
      processedRating = null;
    } else {
      // 尝试转换为整数
      const ratingNum = parseInt(rating);
      if (isNaN(ratingNum)) {
        return res.status(400).json({ error: '评分必须是有效的数字或空' });
      } else {
        // 限制评分范围为1-100整数
        processedRating = Math.max(1, Math.min(100, ratingNum));
      }
    }
    
    // 验证数值有效性
    if (processedPrice !== null && isNaN(processedPrice)) {
      return res.status(400).json({ error: '价格必须是有效的数字' });
    }
    if (processedLatitude !== null && isNaN(processedLatitude)) {
      return res.status(400).json({ error: '纬度必须是有效的数字' });
    }
    if (processedLongitude !== null && isNaN(processedLongitude)) {
      return res.status(400).json({ error: '经度必须是有效的数字' });
    }
    
    // 如果没有提供经纬度，自动调用高德地理编码获取坐标
    if (processedLatitude === null || processedLongitude === null) {
      try {
        const geoResult = await geocodeAddress(province, city, district, address);
        if (geoResult) {
          processedLatitude = geoResult.latitude;
          processedLongitude = geoResult.longitude;
          console.log(`管理员新增信息 - 地理编码成功: ${province}${city}${district}${address} -> (${processedLatitude}, ${processedLongitude})`);
        } else {
          console.warn(`管理员新增信息 - 地理编码未找到匹配位置: ${province}${city}${district}${address}`);
        }
      } catch (geoError) {
        console.error('管理员新增信息 - 地理编码异常:', geoError);
      }
    }
    
    // 处理上传的图片
    let imageUrls = [];
    if (req.files && req.files.length > 0) {
      imageUrls = req.files.map(file => `/uploads/${file.filename}`);
    }
    
    // 处理图片库引用的图片
    if (req.body.library_images) {
      try {
        console.log('处理图片库引用:', req.body.library_images);
        const libraryUrls = JSON.parse(req.body.library_images);
        if (Array.isArray(libraryUrls)) {
          imageUrls = [...imageUrls, ...libraryUrls.map(normalizeStoredImageUrl)];
          imageUrls = imageUrls.slice(0, 3);
          console.log('合并后的图片URL:', imageUrls);
        }
      } catch (error) {
        console.error('解析library_images失败:', error);
        // 即使解析失败，也继续执行，不影响其他功能
      }
    }
    
    console.log('最终图片URL列表:', imageUrls);
    
    // 将图片路径转换为JSON字符串
    const imagesJson = JSON.stringify(imageUrls);
    
    const [result] = await db.query(
      'INSERT INTO info (store_name, category, province, city, district, address, contact, description, business_hours, price, images, latitude, longitude, rating) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [store_name, category, province, city, district, address, contact, description, business_hours, processedPrice, imagesJson, processedLatitude, processedLongitude, processedRating]
    );
    
    res.json({ id: result.insertId, message: '信息添加成功' });
  } catch (error) {
    console.error('添加信息错误:', error.message);
    res.status(500).json({ error: '服务器内部错误' });
  }
});

// 更新信息（支持图片上传）- 需要认证
router.put('/:id', authenticate, handleInfoUploadError, async (req, res) => {
  try {
    console.log('Update Info - Request Body Keys:', Object.keys(req.body || {}));
    console.log('Update Info - Request Body Content:', req.body);
    console.log('Update Info - Request Files:', req.files);
    
    const { store_name, category, province, city, district, address, contact, description, business_hours, price, latitude, longitude, rating } = req.body;
    
    // 检查必要字段
    if (!store_name || typeof store_name !== 'string' || store_name.trim() === '') {
      return res.status(400).json({ error: '店名不能为空' });
    }
    if (!category || typeof category !== 'string' || category.trim() === '') {
      return res.status(400).json({ error: '分类不能为空' });
    }
    if (!province || typeof province !== 'string' || province.trim() === '') {
      return res.status(400).json({ error: '省份不能为空' });
    }
    if (!city || typeof city !== 'string' || city.trim() === '') {
      return res.status(400).json({ error: '城市不能为空' });
    }
    if (!district || typeof district !== 'string' || district.trim() === '') {
      return res.status(400).json({ error: '区县不能为空' });
    }
    if (!address || typeof address !== 'string' || address.trim() === '') {
      return res.status(400).json({ error: '地址不能为空' });
    }
    
    // 检查字段长度
    if (store_name.length > 100) {
      return res.status(400).json({ error: '店名长度不能超过100个字符' });
    }
    if (category.length > 50) {
      return res.status(400).json({ error: '分类长度不能超过50个字符' });
    }
    if (province.length > 50) {
      return res.status(400).json({ error: '省份长度不能超过50个字符' });
    }
    if (city.length > 50) {
      return res.status(400).json({ error: '城市长度不能超过50个字符' });
    }
    if (district.length > 50) {
      return res.status(400).json({ error: '区县长度不能超过50个字符' });
    }
    if (address.length > 1000) {
      return res.status(400).json({ error: '地址长度不能超过 1000 个字符' });
    }
    if (contact && contact.length > 5000) {
      return res.status(400).json({ error: '联系方式长度不能超过 5000 个字符' });
    }
    if (description && description.length > 5000) {
      return res.status(400).json({ error: '描述长度不能超过5000个字符' });
    }
    if (business_hours && business_hours.length > 200) {
      return res.status(400).json({ error: '营业时间长度不能超过200个字符' });
    }
    // 处理空值，转换为空字符串、undefined或null为null
    const processedPrice = (price === '' || price === undefined || price === null || price === 'null') ? null : parseFloat(price);
    let processedLatitude = (latitude === '' || latitude === undefined || latitude === null || latitude === 'null') ? null : parseFloat(latitude);
    let processedLongitude = (longitude === '' || longitude === undefined || longitude === null || longitude === 'null') ? null : parseFloat(longitude);
    
    // 处理评分：1-100分整数，支持null
    let processedRating;
    if (rating === '' || rating === undefined || rating === null || rating === 'null' || rating === '暂无评分') {
      processedRating = null;
    } else {
      const ratingNum = parseInt(rating);
      if (isNaN(ratingNum)) {
        return res.status(400).json({ error: '评分必须是有效的数字或空' });
      } else {
        // 限制评分范围为1-100整数
        processedRating = Math.max(1, Math.min(100, ratingNum));
      }
    }
    
    // 验证数值有效性
    if (processedPrice !== null && isNaN(processedPrice)) {
      return res.status(400).json({ error: '价格必须是有效的数字' });
    }
    if (processedLatitude !== null && isNaN(processedLatitude)) {
      return res.status(400).json({ error: '纬度必须是有效的数字' });
    }
    if (processedLongitude !== null && isNaN(processedLongitude)) {
      return res.status(400).json({ error: '经度必须是有效的数字' });
    }
    
    // 如果没有提供经纬度，自动调用高德地理编码获取坐标
    if (processedLatitude === null || processedLongitude === null) {
      try {
        const geoResult = await geocodeAddress(province, city, district, address);
        if (geoResult) {
          processedLatitude = geoResult.latitude;
          processedLongitude = geoResult.longitude;
          console.log(`管理员更新信息 - 地理编码成功: ${province}${city}${district}${address} -> (${processedLatitude}, ${processedLongitude})`);
        } else {
          console.warn(`管理员更新信息 - 地理编码未找到匹配位置: ${province}${city}${district}${address}`);
        }
      } catch (geoError) {
        console.error('管理员更新信息 - 地理编码异常:', geoError);
      }
    }
    
    // 先查询原有记录以获取旧图片路径
    const [existingInfo] = await db.query('SELECT images FROM info WHERE id = ?', [req.params.id]);
    
    if (existingInfo.length === 0) {
      return res.status(404).json({ error: '信息不存在' });
    }
    
    let imageUrls = [];
    
    console.log('接收到的library_images:', req.body.library_images);
    
    // 优先处理图片库引用的图片（这是用户在编辑界面选择的）
    if (req.body.library_images) {
      try {
        console.log('处理图片库引用:', req.body.library_images);
        const libraryUrls = JSON.parse(req.body.library_images);
        if (Array.isArray(libraryUrls)) {
          imageUrls = libraryUrls.map(normalizeStoredImageUrl);
          imageUrls = imageUrls.slice(0, 3);
          console.log('使用图片库图片:', imageUrls);
        }
      } catch (error) {
        console.error('解析library_images失败:', error);
        // 即使解析失败，也继续执行，不影响其他功能
      }
    }
    
    // 如果没有图片库引用，再处理上传的图片
    if (imageUrls.length === 0 && req.files && req.files.length > 0) {
      imageUrls = req.files.map(file => `/uploads/${file.filename}`);
      console.log('使用上传的图片:', imageUrls);
    }
    
    // 如果没有任何图片（既没有上传新图片，也没有选择图片库图片），使用空数组
    // 这样用户可以删除所有图片
    console.log('最终图片 URL 列表:', imageUrls);
    
    const imagesJson = JSON.stringify(imageUrls);
    
    const [result] = await db.query(
      'UPDATE info SET store_name = ?, category = ?, province = ?, city = ?, district = ?, address = ?, contact = ?, description = ?, business_hours = ?, price = ?, latitude = ?, longitude = ?, rating = ?, images = ? WHERE id = ?',
      [store_name, category, province, city, district, address, contact, description, business_hours, processedPrice, processedLatitude, processedLongitude, processedRating, imagesJson, req.params.id]
    );
    
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: '信息不存在' });
    }
    
    res.json({ message: '信息更新成功' });
  } catch (error) {
    console.error('更新信息错误:', error.message);
    res.status(500).json({ error: '服务器内部错误' });
  }
});

// 删除信息 - 需要认证
router.delete('/:id', authenticate, async (req, res) => {
  try {
    const [result] = await db.query('DELETE FROM info WHERE id = ?', [req.params.id]);
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: '信息不存在' });
    }
    res.json({ message: '信息删除成功' });
  } catch (error) {
    console.error(error.message);
    res.status(500).json({ error: '服务器内部错误' });
  }
});

module.exports = router;

module.exports = router;