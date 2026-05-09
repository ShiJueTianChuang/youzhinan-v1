/**
 * 高德地图 API 路由
 * 提供附近搜索、地点查询等功能
 */
const express = require('express');
const router = express.Router();
const axios = require('axios');
require('dotenv').config();

// 高德地图 API Key
const GAODE_API_KEY = process.env.GAODE_API_KEY;
const GAODE_BASE_URL = 'https://restapi.amap.com/v3';
const DEFAULT_RADIUS = 3000; // 默认半径 3000 米

/**
 * GET /api/gaode/around
 * 搜索指定地点周边的 POI 信息
 * @param {number} latitude 纬度
 * @param {number} longitude 经度
 * @param {string} keywords 搜索关键词（可选，默认：美食）
 * @param {number} radius 搜索半径（可选，默认：3000 米）
 * @param {string} sort 排序方式（可选：distance=距离优先，weight=综合排序）
 */
router.get('/around', async (req, res) => {
  try {
    const { latitude, longitude, keywords = '美食', radius = DEFAULT_RADIUS, sort = 'distance' } = req.query;
    
    if (!latitude || !longitude) {
      return res.status(400).json({ 
        code: 400, 
        message: '缺少经纬度参数',
        data: null 
      });
    }
    
    const location = `${longitude},${latitude}`;
    const searchRadius = parseInt(radius) || DEFAULT_RADIUS;
    
    let allPois = [];
    
    if (searchRadius > 5000) {
      // 如果半径超过 5000 米，使用分层查询
      // 分成多个层级查询：1km, 3km, 5km, 10km, 20km, 50km, 100km, 300km
      const layers = [1000, 3000, 5000, 10000, 20000, 50000, 100000, 300000];
      
      for (const layerRadius of layers) {
        if (layerRadius > searchRadius) break;
        
        try {
          const response = await axios.get(`${GAODE_BASE_URL}/place/around`, {
            params: {
              key: GAODE_API_KEY,
              keywords: keywords,
              location: location,
              radius: layerRadius,
              sort: sort,
              offset: 20,
              page: 1
            }
          });
          
          const data = response.data;
          
          if (data.status === '1' && data.pois) {
            // 去重
            const existingIds = new Set(allPois.map(p => p.id));
            const newPois = data.pois.filter(poi => !existingIds.has(poi.id));
            allPois = allPois.concat(newPois);
            
            // 如果已经获取到足够多的数据，可以提前退出
            if (allPois.length >= 50) break;
          }
        } catch (layerError) {
          console.warn(`分层查询 ${layerRadius} 米失败:`, layerError.message);
        }
      }
    } else {
      // 半径 <= 5000 米，直接查询
      const response = await axios.get(`${GAODE_BASE_URL}/place/around`, {
        params: {
          key: GAODE_API_KEY,
          keywords: keywords,
          location: location,
          radius: searchRadius,
          sort: sort,
          offset: 20,
          page: 1
        }
      });
      
      const data = response.data;
      
      if (data.status === '1' && data.pois) {
        allPois = data.pois;
      }
    }
    
    // 处理 POI 数据
    const processedPois = allPois.map(poi => {
      const [lng, lat] = (poi.location || '0,0').split(',').map(Number);
      return {
        id: poi.id,
        name: poi.name,
        type: poi.type,
        address: poi.address,
        latitude: lat,
        longitude: lng,
        distance: parseInt(poi.distance) || 0,
        tel: poi.tel || '',
        city: poi.cityname || '',
        district: poi.adname || ''
      };
    });
    
    res.json({
      code: 200,
      message: '获取成功',
      data: {
        total: processedPois.length,
        pois: processedPois
      }
    });
  } catch (error) {
    console.error('高德地图周边搜索失败:', error);
    res.status(500).json({
      code: 500,
      message: '服务器错误',
      data: null
    });
  }
});

/**
 * GET /api/gaode/geocode
 * 将文字地址转换为经纬度坐标(地理编码)
 * @param {string} address 完整地址(省+市+区+详细地址)
 * @param {string} city 城市(可选,用于提高精度)
 */
router.get('/geocode', async (req, res) => {
  try {
    const { address, city } = req.query;
    
    if (!address || !address.trim()) {
      return res.status(400).json({ 
        code: 400, 
        message: '缺少地址参数',
        data: null 
      });
    }
    
    const response = await axios.get(`${GAODE_BASE_URL}/geocode/geo`, {
      params: {
        key: GAODE_API_KEY,
        address: address.trim(),
        city: city || '',
        output: 'json'
      }
    });
    
    const data = response.data;
    
    if (data.status === '1' && data.geocodes && data.geocodes.length > 0) {
      const geocode = data.geocodes[0];
      const [lng, lat] = geocode.location.split(',').map(Number);
      
      res.json({
        code: 200,
        message: '地理编码成功',
        data: {
          latitude: lat,
          longitude: lng,
          formatted_address: geocode.formatted_address,
          confidence: geocode.level
        }
      });
    } else {
      res.json({
        code: 200,
        message: '未找到匹配的地理位置',
        data: null
      });
    }
  } catch (error) {
    console.error('高德地理编码失败:', error);
    res.status(500).json({
      code: 500,
      message: '服务器错误',
      data: null
    });
  }
});

/**
 * GET /api/gaode/search
 * 搜索 POI 信息（不限位置）
 * @param {string} keywords 搜索关键词
 * @param {string} city 城市（可选）
 */
router.get('/search', async (req, res) => {
  try {
    const { keywords, city = '全国' } = req.query;
    
    if (!keywords) {
      return res.status(400).json({ 
        code: 400, 
        message: '缺少搜索关键词',
        data: null 
      });
    }
    
    const response = await axios.get(`${GAODE_BASE_URL}/place/text`, {
      params: {
        key: GAODE_API_KEY,
        keywords: keywords,
        city: city,
        offset: 20,
        page: 1
      }
    });
    
    const data = response.data;
    
    if (data.status === '1') {
      const pois = (data.pois || []).map(poi => {
        const [lng, lat] = (poi.location || '0,0').split(',').map(Number);
        return {
          id: poi.id,
          name: poi.name,
          type: poi.type,
          address: poi.address,
          latitude: lat,
          longitude: lng,
          tel: poi.tel || '',
          city: poi.cityname || '',
          district: poi.adname || ''
        };
      });
      
      res.json({
        code: 200,
        message: '获取成功',
        data: {
          total: parseInt(data.count) || 0,
          pois: pois
        }
      });
    } else {
      res.status(400).json({
        code: 400,
        message: data.info || '高德地图 API 调用失败',
        data: null
      });
    }
  } catch (error) {
    console.error('高德地图搜索失败:', error);
    res.status(500).json({
      code: 500,
      message: '服务器错误',
      data: null
    });
  }
});

/**
 * 地理编码工具函数(供其他模块调用)
 * @param {string} province 省份
 * @param {string} city 城市
 * @param {string} district 区县
 * @param {string} address 详细地址
 * @returns {Promise<{latitude: number, longitude: number}|null>}
 */
async function geocodeAddress(province, city, district, address) {
  try {
    const fullAddress = `${province}${city}${district}${address}`;
    
    const response = await axios.get(`${GAODE_BASE_URL}/geocode/geo`, {
      params: {
        key: GAODE_API_KEY,
        address: fullAddress,
        city: city,
        output: 'json'
      }
    });
    
    const data = response.data;
    
    if (data.status === '1' && data.geocodes && data.geocodes.length > 0) {
      const geocode = data.geocodes[0];
      const [lng, lat] = geocode.location.split(',').map(Number);
      
      return {
        latitude: lat,
        longitude: lng
      };
    }
    
    return null;
  } catch (error) {
    console.error('地理编码失败:', error.message);
    return null;
  }
}

module.exports = router;
module.exports.geocodeAddress = geocodeAddress;
