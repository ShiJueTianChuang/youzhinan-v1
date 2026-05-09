/**
 * 省市区地址数据 API
 * 数据来源：chinese_regions.js
 */
const express = require('express');
const router = express.Router();
const { CHINESE_REGIONS, PROVINCES } = require('../chinese_regions');

/**
 * GET /api/regions
 * 返回完整的省市区三级联动数据
 * 格式：{ "省份名": { "cities": ["市1","市2"], "districts": { "市1": ["区1","区2"] } } }
 */
router.get('/', (req, res) => {
  try {
    const result = {};
    for (const [province, data] of Object.entries(CHINESE_REGIONS)) {
      const cities = data['城市'] || [];
      const districts = data['地区'] || {};
      result[province] = {
        cities,
        districts
      };
    }
    res.json({
      code: 200,
      message: '获取成功',
      data: {
        provinces: PROVINCES || Object.keys(result),
        regions: result
      }
    });
  } catch (err) {
    console.error('获取地址数据失败:', err);
    res.status(500).json({ code: 500, message: '服务器错误' });
  }
});

module.exports = router;
