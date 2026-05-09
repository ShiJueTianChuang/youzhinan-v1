/**
 * 管理员投稿审核路由
 * 可视化审核区域：列表、通过、拒绝
 */
const express = require('express');
const router = express.Router();
const db = require('../config/db');
const { authenticate, requireAdmin } = require('../middleware/auth');
const { geocodeAddress } = require('./gaode');

const BASE_URL = process.env.BASE_URL || process.env.PUBLIC_ORIGIN || 'https://your-domain.com';

function processSubmissionRow(r) {
  let images = [];
  if (r.images) {
    try {
      images = typeof r.images === 'string' ? JSON.parse(r.images) : r.images;
      if (!Array.isArray(images)) images = [];
    } catch (e) {}
  }
  const fullImages = images.map(img => (img && img.startsWith('http')) ? img : `${BASE_URL}${img}`);
  let submitterNickname = null;
  if (r.submitter_nick_name) {
    submitterNickname = r.submitter_nick_name;
  } else if (r.submitter_username) {
    submitterNickname = r.submitter_username;
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
    images: fullImages,
    status: r.status,
    reject_reason: r.reject_reason,
    info_id: r.info_id,
    submitter_type: r.submitter_type,
    submitter_id: r.submitter_id || null,
    submitter_openid: r.submitter_openid || null,
    submitter_nickname: submitterNickname,
    deleted_at: r.deleted_at || null,
    created_at: r.created_at,
    updated_at: r.updated_at
  };
}

router.use(authenticate);
router.use(requireAdmin);

/**
 * GET /api/admin/submissions - 获取投稿列表（支持筛选 status）
 */
router.get('/', async (req, res) => {
  try {
    if (!db) return res.status(503).json({ code: 503, message: '服务暂不可用' });
    const { status, page = 1, pageSize = 20 } = req.query;
    const offset = Math.max(0, (parseInt(page) || 1) - 1) * Math.min(50, parseInt(pageSize) || 20);
    const limit = Math.min(50, parseInt(pageSize) || 20);

    let where = '';
    const params = [];
    if (status && ['pending', 'approved', 'rejected'].includes(status)) {
      where = ' WHERE status = ?';
      params.push(status);
    }

    const [rows] = await db.query(
      `SELECT s.*, u.nick_name AS submitter_nick_name, u.username AS submitter_username FROM info_submissions s LEFT JOIN users u ON s.submitter_id = u.id ${where} ORDER BY s.created_at DESC LIMIT ? OFFSET ?`,
      [...params, limit, offset]
    );
    const [countRows] = await db.query(`SELECT COUNT(*) as total FROM info_submissions ${where}`, params);
    const total = countRows[0]?.total || 0;

    const list = rows.map(processSubmissionRow);
    res.json({ code: 200, data: { list, total, page: parseInt(page) || 1, pageSize: limit } });
  } catch (err) {
    console.error('获取投稿列表失败:', err);
    res.status(500).json({ code: 500, message: '服务器错误' });
  }
});

/**
 * GET /api/admin/submissions/stats - 投稿统计
 */
router.get('/stats', async (req, res) => {
  try {
    if (!db) return res.status(503).json({ code: 503, message: '服务暂不可用' });
    const [rows] = await db.query(
      'SELECT status, COUNT(*) as count FROM info_submissions GROUP BY status'
    );
    const stats = { pending: 0, approved: 0, rejected: 0 };
    rows.forEach(r => { stats[r.status] = r.count; });
    res.json({ code: 200, data: stats });
  } catch (err) {
    console.error('获取投稿统计失败:', err);
    res.status(500).json({ code: 500, message: '服务器错误' });
  }
});

/**
 * GET /api/admin/submissions/:id - 获取单条投稿详情
 */
router.get('/:id', async (req, res) => {
  try {
    if (!db) return res.status(503).json({ code: 503, message: '服务暂不可用' });
    const [rows] = await db.query('SELECT s.*, u.nick_name AS submitter_nick_name, u.username AS submitter_username FROM info_submissions s LEFT JOIN users u ON s.submitter_id = u.id WHERE s.id = ?', [req.params.id]);
    if (rows.length === 0) return res.status(404).json({ code: 404, message: '投稿不存在' });
    res.json({ code: 200, data: processSubmissionRow(rows[0]) });
  } catch (err) {
    console.error('获取投稿详情失败:', err);
    res.status(500).json({ code: 500, message: '服务器错误' });
  }
});

/**
 * POST /api/admin/submissions/:id/approve - 审核通过，写入 info 表并上架
 */
router.post('/:id/approve', async (req, res) => {
  try {
    if (!db) return res.status(503).json({ code: 503, message: '服务暂不可用' });
    const userId = req.user?.id || req.user?.userId || req.user?.user_id;
    const [rows] = await db.query('SELECT * FROM info_submissions WHERE id = ?', [req.params.id]);
    if (rows.length === 0) return res.status(404).json({ code: 404, message: '投稿不存在' });

    const s = rows[0];
    if (s.status !== 'pending') return res.status(400).json({ code: 400, message: '该投稿已处理' });

    let category = (s.category && String(s.category).trim()) || null;
    if (!category) {
      const [cats] = await db.query('SELECT name FROM categories LIMIT 1');
      category = (cats && cats[0]?.name) || '其他';
    }

    const imagesVal = typeof s.images === 'string' ? s.images : JSON.stringify(Array.isArray(s.images) ? s.images : (s.images ? [s.images] : []));

    let latitude = null;
    let longitude = null;
    
    try {
      const geoResult = await geocodeAddress(s.province, s.city, s.district, s.address);
      if (geoResult) {
        latitude = geoResult.latitude;
        longitude = geoResult.longitude;
        console.log(`投稿审核通过 - 地理编码成功: ${s.province}${s.city}${s.district}${s.address} -> (${latitude}, ${longitude})`);
      } else {
        console.warn(`投稿审核通过 - 地理编码未找到匹配位置: ${s.province}${s.city}${s.district}${s.address}`);
      }
    } catch (geoError) {
      console.error('投稿审核通过 - 地理编码异常:', geoError);
    }

    const [ins] = await db.query(
      `INSERT INTO info (store_name, category, province, city, district, address, contact, description, business_hours, price, images, latitude, longitude) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [s.store_name, category, s.province, s.city, s.district, s.address, s.contact || null, s.description || null, s.business_hours || null, s.price || null, imagesVal, latitude, longitude]
    );
    const infoId = ins.insertId;

    await db.query(
      'UPDATE info_submissions SET status = ?, info_id = ?, reviewed_at = NOW(), reviewed_by = ? WHERE id = ?',
      ['approved', infoId, userId, req.params.id]
    );

    res.json({ code: 200, message: '审核通过，已上架', data: { info_id: infoId, latitude, longitude } });
  } catch (err) {
    console.error('审核通过失败:', err);
    const msg = process.env.NODE_ENV === 'development' ? (err.sqlMessage || err.message) : '服务器错误';
    res.status(500).json({ code: 500, message: msg });
  }
});

/**
 * POST /api/admin/submissions/:id/reject - 审核拒绝
 */
router.post('/:id/reject', async (req, res) => {
  try {
    if (!db) return res.status(503).json({ code: 503, message: '服务暂不可用' });
    const userId = req.user?.id || req.user?.userId || req.user?.user_id;
    const { reason } = req.body || {};
    const [rows] = await db.query('SELECT * FROM info_submissions WHERE id = ?', [req.params.id]);
    if (rows.length === 0) return res.status(404).json({ code: 404, message: '投稿不存在' });

    const s = rows[0];
    if (s.status !== 'pending') return res.status(400).json({ code: 400, message: '该投稿已处理' });

    const rejectReason = (reason && String(reason).trim()) || '不符合上架要求';
    await db.query(
      'UPDATE info_submissions SET status = ?, reject_reason = ?, reviewed_at = NOW(), reviewed_by = ? WHERE id = ?',
      ['rejected', rejectReason.slice(0, 500), userId, req.params.id]
    );

    res.json({ code: 200, message: '已拒绝' });
  } catch (err) {
    console.error('审核拒绝失败:', err);
    res.status(500).json({ code: 500, message: '服务器错误' });
  }
});

module.exports = router;
