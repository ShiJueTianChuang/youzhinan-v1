/**
 * 投稿相关路由
 * 用户上传信息 -> 后端审核 -> 上架到 info 表
 * 必填：店名、省、城市、区县市、详细地址
 * 选填：营业时间、价格、描述、联系方式、图片（最多3张）
 */
const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const router = express.Router();
const db = require('../config/db');
const { authenticate } = require('../middleware/auth');

const ensureDirectory = (dirPath) => {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true, mode: 0o755 });
  }
};

const submissionStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = path.join(__dirname, '../uploads/submissions');
    ensureDirectory(dir);
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = file.mimetype === 'image/png' ? '.png' : '.jpg';
    cb(null, `submission-${uniqueSuffix}${ext}`);
  }
});

const ALLOWED_SUBMISSION_MIMES = new Set(['image/jpeg', 'image/jpg', 'image/png']);

const submissionUpload = multer({
  storage: submissionStorage,
  limits: { fileSize: 5 * 1024 * 1024, files: 3 },
  fileFilter: (req, file, cb) => {
    if (ALLOWED_SUBMISSION_MIMES.has(file.mimetype)) cb(null, true);
    else cb(new Error('只允许上传 JPG、PNG 图片'), false);
  }
});

// 可选认证 - 有 token 则解析用户，无 token 则允许匿名投稿（但无法管理）
const optionalAuth = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    req.user = null;
    return next();
  }
  try {
    const token = authHeader.split(' ')[1];
    const decoded = require('jsonwebtoken').verify(token, process.env.JWT_SECRET);
    req.user = decoded;
  } catch (e) {
    req.user = null;
  }
  next();
};

// 获取当前用户标识（用于查询我的投稿）
const getSubmitterCondition = (req) => {
  const user = req.user;
  if (!user) return null;
  const userId = user.id || user.userId || user.user_id;
  const openid = user.openid || user.wx_openid;
  if (userId) return { type: 'user_id', value: userId };
  if (openid) return { type: 'openid', value: openid };
  return null;
};

/**
 * POST /api/submissions - 提交投稿
 * 支持匿名投稿（无 token）或登录投稿（有 token 可后续管理）
 */
router.post('/', optionalAuth, submissionUpload.array('images', 3), async (req, res) => {
  try {
    if (!db) return res.status(503).json({ code: 503, message: '服务暂不可用' });

    const { store_name, category, province, city, district, address, business_hours, price, description, contact } = req.body;

    // 必填校验
    if (!store_name || !store_name.trim()) return res.status(400).json({ code: 400, message: '店名不能为空' });
    if (!category || !String(category).trim()) return res.status(400).json({ code: 400, message: '请选择分类' });
    if (!province || !province.trim()) return res.status(400).json({ code: 400, message: '省不能为空' });
    if (!city || !city.trim()) return res.status(400).json({ code: 400, message: '城市不能为空' });
    if (!district || !district.trim()) return res.status(400).json({ code: 400, message: '区县市不能为空' });
    if (!address || !address.trim()) return res.status(400).json({ code: 400, message: '详细地址不能为空' });

    // 长度校验
    if (store_name.length > 100) return res.status(400).json({ code: 400, message: '店名不能超过100字' });
    if (province.length > 50 || city.length > 50 || district.length > 50) return res.status(400).json({ code: 400, message: '地区信息过长' });
    if (address.length > 1000) return res.status(400).json({ code: 400, message: '详细地址不能超过1000字' });
    if (business_hours && business_hours.length > 200) return res.status(400).json({ code: 400, message: '营业时间不能超过200字' });
    if (description && description.length > 5000) return res.status(400).json({ code: 400, message: '描述不能超过5000字' });
    if (contact && contact.length > 5000) return res.status(400).json({ code: 400, message: '联系方式过长' });

    const processedPrice = (price === '' || price === undefined || price === null) ? null : parseFloat(price);
    if (processedPrice !== null && isNaN(processedPrice)) return res.status(400).json({ code: 400, message: '价格格式无效' });

    let imageUrls = [];
    if (req.files && req.files.length > 0) {
      imageUrls = req.files.map(f => `/uploads/submissions/${f.filename}`);
    }
    if (req.body.library_images) {
      try {
        const lib = JSON.parse(req.body.library_images);
        if (Array.isArray(lib)) imageUrls = [...imageUrls, ...lib].slice(0, 3);
      } catch (e) {}
    }
    imageUrls = imageUrls.slice(0, 3);

    const submitter = getSubmitterCondition(req);
    const submitterId = submitter && submitter.type === 'user_id' ? submitter.value : null;
    const submitterOpenid = submitter && submitter.type === 'openid' ? submitter.value : null;
    const submitterType = submitter ? (submitter.type === 'openid' ? 'wechat' : 'app') : 'anonymous';

    const categoryVal = (category && String(category).trim()) || null;
    const [result] = await db.query(
      `INSERT INTO info_submissions (submitter_id, submitter_openid, submitter_type, store_name, category, province, city, district, address, business_hours, price, description, contact, images, status) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending')`,
      [submitterId, submitterOpenid, submitterType, store_name.trim(), categoryVal, province.trim(), city.trim(), district.trim(), address.trim(), business_hours || null, processedPrice, description || null, contact || null, JSON.stringify(imageUrls)]
    );

    res.json({ code: 200, message: '投稿成功，请等待审核', data: { id: result.insertId } });
  } catch (err) {
    console.error('投稿失败:', err);
    res.status(500).json({ code: 500, message: err.message || '服务器错误' });
  }
});

/**
 * GET /api/submissions/my - 获取我的投稿列表（需登录）
 */
router.get('/my', authenticate, async (req, res) => {
  try {
    if (!db) return res.status(503).json({ code: 503, message: '服务暂不可用' });
    const submitter = getSubmitterCondition(req);
    if (!submitter) return res.status(400).json({ code: 400, message: '无法识别用户身份' });

    let rows;
    if (submitter.type === 'user_id') {
      [rows] = await db.query('SELECT * FROM info_submissions WHERE submitter_id = ? AND deleted_at IS NULL ORDER BY created_at DESC', [submitter.value]);
    } else {
      [rows] = await db.query('SELECT * FROM info_submissions WHERE submitter_openid = ? AND deleted_at IS NULL ORDER BY created_at DESC', [submitter.value]);
    }

    const list = rows.map(r => {
      let images = [];
      if (r.images) {
        try {
          images = typeof r.images === 'string' ? JSON.parse(r.images) : r.images;
          if (!Array.isArray(images)) images = [];
        } catch (e) {}
      }
      return {
        id: r.id,
        store_name: r.store_name,
        category: r.category || null,
        province: r.province,
        city: r.city,
        district: r.district,
        address: r.address,
        business_hours: r.business_hours,
        price: r.price,
        description: r.description,
        contact: r.contact,
        images,
        status: r.status,
        reject_reason: r.reject_reason,
        info_id: r.info_id,
        created_at: r.created_at,
        updated_at: r.updated_at
      };
    });

    res.json({ code: 200, message: '获取成功', data: { list } });
  } catch (err) {
    console.error('获取我的投稿失败:', err);
    res.status(500).json({ code: 500, message: '服务器错误' });
  }
});

/**
 * GET /api/submissions/:id - 获取单条投稿详情（需为本人或管理员）
 */
router.get('/:id', authenticate, async (req, res) => {
  try {
    if (!db) return res.status(503).json({ code: 503, message: '服务暂不可用' });
    const [rows] = await db.query('SELECT * FROM info_submissions WHERE id = ?', [req.params.id]);
    if (rows.length === 0) return res.status(404).json({ code: 404, message: '投稿不存在' });

    const r = rows[0];
    const submitter = getSubmitterCondition(req);
    const isOwner = submitter && (
      (submitter.type === 'user_id' && r.submitter_id == submitter.value) ||
      (submitter.type === 'openid' && r.submitter_openid === submitter.value)
    );
    if (!isOwner) return res.status(403).json({ code: 403, message: '无权查看' });
    if (r.deleted_at) return res.status(404).json({ code: 404, message: '投稿已删除' });

    let images = [];
    if (r.images) {
      try {
        images = typeof r.images === 'string' ? JSON.parse(r.images) : r.images;
        if (!Array.isArray(images)) images = [];
      } catch (e) {}
    }

    res.json({
      code: 200,
      data: {
        id: r.id,
        store_name: r.store_name,
        category: r.category || null,
        province: r.province,
        city: r.city,
        district: r.district,
        address: r.address,
        business_hours: r.business_hours,
        price: r.price,
        description: r.description,
        contact: r.contact,
        images,
        status: r.status,
        reject_reason: r.reject_reason,
        info_id: r.info_id,
        created_at: r.created_at,
        updated_at: r.updated_at
      }
    });
  } catch (err) {
    console.error('获取投稿详情失败:', err);
    res.status(500).json({ code: 500, message: '服务器错误' });
  }
});

/**
 * PUT /api/submissions/:id - 编辑投稿（仅限待审核且本人）
 */
router.put('/:id', authenticate, submissionUpload.array('images', 3), async (req, res) => {
  try {
    if (!db) return res.status(503).json({ code: 503, message: '服务暂不可用' });
    const [rows] = await db.query('SELECT * FROM info_submissions WHERE id = ?', [req.params.id]);
    if (rows.length === 0) return res.status(404).json({ code: 404, message: '投稿不存在' });

    const r = rows[0];
    if (r.deleted_at) return res.status(404).json({ code: 404, message: '投稿已删除' });
    if (r.status !== 'pending') return res.status(400).json({ code: 400, message: '仅待审核的投稿可编辑' });

    const submitter = getSubmitterCondition(req);
    const isOwner = submitter && (
      (submitter.type === 'user_id' && r.submitter_id == submitter.value) ||
      (submitter.type === 'openid' && r.submitter_openid === submitter.value)
    );
    if (!isOwner) return res.status(403).json({ code: 403, message: '无权编辑' });

    const { store_name, category, province, city, district, address, business_hours, price, description, contact } = req.body;
    if (!store_name || !store_name.trim()) return res.status(400).json({ code: 400, message: '店名不能为空' });
    if (!category || !category.trim()) return res.status(400).json({ code: 400, message: '请选择分类' });
    if (!province || !province.trim()) return res.status(400).json({ code: 400, message: '省不能为空' });
    if (!city || !city.trim()) return res.status(400).json({ code: 400, message: '城市不能为空' });
    if (!district || !district.trim()) return res.status(400).json({ code: 400, message: '区县市不能为空' });
    if (!address || !address.trim()) return res.status(400).json({ code: 400, message: '详细地址不能为空' });

    const processedPrice = (price === '' || price === undefined || price === null) ? null : parseFloat(price);
    if (processedPrice !== null && isNaN(processedPrice)) return res.status(400).json({ code: 400, message: '价格格式无效' });

    let imageUrls = [];
    if (req.files && req.files.length > 0) {
      imageUrls = req.files.map(f => `/uploads/submissions/${f.filename}`);
    }
    if (req.body.library_images) {
      try {
        const lib = JSON.parse(req.body.library_images);
        if (Array.isArray(lib)) imageUrls = [...imageUrls, ...lib].slice(0, 3);
      } catch (e) {}
    }
    if (imageUrls.length === 0 && r.images) {
      try {
        const old = typeof r.images === 'string' ? JSON.parse(r.images) : r.images;
        if (Array.isArray(old)) imageUrls = old.slice(0, 3);
      } catch (e) {}
    }
    imageUrls = imageUrls.slice(0, 3);

    await db.query(
      `UPDATE info_submissions SET store_name=?, category=?, province=?, city=?, district=?, address=?, business_hours=?, price=?, description=?, contact=?, images=? WHERE id=?`,
      [store_name.trim(), (category || '').trim(), province.trim(), city.trim(), district.trim(), address.trim(), business_hours || null, processedPrice, description || null, contact || null, JSON.stringify(imageUrls), req.params.id]
    );

    res.json({ code: 200, message: '修改成功' });
  } catch (err) {
    console.error('编辑投稿失败:', err);
    res.status(500).json({ code: 500, message: '服务器错误' });
  }
});

/**
 * DELETE /api/submissions/:id - 软删除投稿（仅限本人，仅待审核可删）
 * 用户删除后记录仍保留，管理员可在后台查看
 */
router.delete('/:id', authenticate, async (req, res) => {
  try {
    if (!db) return res.status(503).json({ code: 503, message: '服务暂不可用' });
    const [rows] = await db.query('SELECT * FROM info_submissions WHERE id = ?', [req.params.id]);
    if (rows.length === 0) return res.status(404).json({ code: 404, message: '投稿不存在' });

    const r = rows[0];
    if (r.status !== 'pending') return res.status(400).json({ code: 400, message: '仅待审核的投稿可删除' });

    const submitter = getSubmitterCondition(req);
    const isOwner = submitter && (
      (submitter.type === 'user_id' && r.submitter_id == submitter.value) ||
      (submitter.type === 'openid' && r.submitter_openid === submitter.value)
    );
    if (!isOwner) return res.status(403).json({ code: 403, message: '无权删除' });

    // 软删除：设置 deleted_at，管理员仍可查看
    await db.query('UPDATE info_submissions SET deleted_at = NOW() WHERE id = ?', [req.params.id]);
    res.json({ code: 200, message: '删除成功' });
  } catch (err) {
    console.error('删除投稿失败:', err);
    res.status(500).json({ code: 500, message: '服务器错误' });
  }
});

module.exports = router;
