/**
 * 附近店铺搜索路由
 * 根据用户经纬度查询数据库中附近的店铺(按距离排序)
 */
const express = require('express');
const router = express.Router();

let db;
try {
  db = require('../config/db');
} catch (error) {
  console.error('数据库连接失败:', error.message);
}

/**
 * 计算两点间距离(米) - Haversine公式
 */
function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 6371e3; // 地球半径(米)
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c; // 距离(米)
}

/**
 * GET /api/nearby/search
 * 搜索用户附近的店铺
 * @param {number} latitude 用户纬度
 * @param {number} longitude 用户经度
 * @param {number} radius 搜索半径(米),默认 300000
 * @param {string} keywords 搜索关键词(可选)
 * @param {number} page 页码,默认 1
 * @param {number} pagesize 每页数量,默认 20
 */
router.get('/search', async (req, res) => {
  try {
    if (!db) {
      return res.status(503).json({ code: 503, message: '服务暂不可用', data: null });
    }

    const {
      latitude,
      longitude,
      radius = 300000,
      keywords,
      page = 1,
      pagesize = 20
    } = req.query;

    if (!latitude || !longitude) {
      return res.status(400).json({
        code: 400,
        message: '缺少经纬度参数',
        data: null
      });
    }

    const userLat = parseFloat(latitude);
    const userLon = parseFloat(longitude);
    const searchRadius = parseInt(radius) || 300000;
    const pageNum = Math.max(1, parseInt(page) || 1);
    const pageSize = Math.min(50, Math.max(1, parseInt(pagesize) || 20));
    const offset = (pageNum - 1) * pageSize;

    // 查询数据库中所有有经纬度的信息
    let [rows] = await db.query(
      'SELECT * FROM info WHERE latitude IS NOT NULL AND longitude IS NOT NULL ORDER BY sort_order ASC'
    );

    // 过滤: 计算距离并筛选在搜索范围内的店铺
    let filteredInfos = rows.map(row => {
      const distance = calculateDistance(
        userLat,
        userLon,
        parseFloat(row.latitude),
        parseFloat(row.longitude)
      );
      return { ...row, distance: Math.round(distance) };
    }).filter(item => item.distance <= searchRadius);

    // 关键词过滤(如果提供了keywords)
    if (keywords && keywords.trim()) {
      const keyword = keywords.trim().toLowerCase();
      filteredInfos = filteredInfos.filter(item => {
        return (
          (item.store_name && item.store_name.toLowerCase().includes(keyword)) ||
          (item.category && item.category.toLowerCase().includes(keyword)) ||
          (item.address && item.address.toLowerCase().includes(keyword)) ||
          (item.description && item.description.toLowerCase().includes(keyword)) ||
          (item.province && item.province.toLowerCase().includes(keyword)) ||
          (item.city && item.city.toLowerCase().includes(keyword)) ||
          (item.district && item.district.toLowerCase().includes(keyword))
        );
      });
    }

    // 按距离排序
    filteredInfos.sort((a, b) => a.distance - b.distance);

    // 分页
    const total = filteredInfos.length;
    const pagedInfos = filteredInfos.slice(offset, offset + pageSize);

    // 处理返回数据
    const processedInfos = pagedInfos.map(row => {
      let images = [];
      if (row.images) {
        try {
          images = typeof row.images === 'string' ? JSON.parse(row.images) : row.images;
          if (!Array.isArray(images)) images = [];
        } catch (e) {
          images = [];
        }
      }

      let contactObj = { phone: [], landline: [], wechat: [] };
      if (row.contact) {
        try {
          contactObj = typeof row.contact === 'string' ? JSON.parse(row.contact) : row.contact;
        } catch (e) {
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
        contact: contactObj,
        description: row.description || '',
        business_hours: row.business_hours || '',
        price: row.price,
        latitude: row.latitude ? parseFloat(row.latitude) : null,
        longitude: row.longitude ? parseFloat(row.longitude) : null,
        distance: row.distance,
        rating: row.rating,
        view_count: row.view_count,
        images: images,
        created_at: row.created_at,
        updated_at: row.updated_at
      };
    });

    res.json({
      code: 200,
      message: '获取成功',
      data: {
        total,
        page: pageNum,
        pagesize: pageSize,
        list: processedInfos
      }
    });
  } catch (error) {
    console.error('附近店铺搜索失败:', error);
    res.status(500).json({
      code: 500,
      message: '服务器错误',
      data: null
    });
  }
});

module.exports = router;
