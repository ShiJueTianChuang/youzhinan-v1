const express = require('express');
const router = express.Router();
const db = require('../config/db');

router.get('/', async (req, res) => {
  try {
    let visitCount = 0;
    let favoriteCount = 0;
    let viewCount = 0;

    // 1. 访问人数
    try {
      const [result] = await db.query('SELECT COUNT(*) as count FROM visits');
      visitCount = result[0].count || 0;
    } catch (e) {
      console.log('访问数查询失败:', e.message);
    }

    // 2. 收藏人数 - 依次尝试多种方式
    const favoriteQueries = [
      'SELECT COUNT(DISTINCT openid) as count FROM favorites WHERE openid IS NOT NULL AND openid != ""',
      'SELECT COUNT(DISTINCT user_id) as count FROM favorites WHERE user_id IS NOT NULL',
      'SELECT COUNT(*) as count FROM favorites'
    ];

    for (const q of favoriteQueries) {
      try {
        const [result] = await db.query(q);
        const count = result[0].count || 0;
        if (count > 0 || favoriteCount === 0) {
          favoriteCount = count;
          console.log('收藏统计使用查询:', q, '结果:', count);
          if (count > 0) break;
        }
      } catch (e) {
        console.log('收藏查询失败:', q, e.message);
      }
    }

    // 3. 查看次数
    try {
      const [result] = await db.query('SELECT SUM(view_count) as total FROM info');
      viewCount = result[0].total || 0;
    } catch (e) {
      console.log('查看数查询失败:', e.message);
    }

    res.json({
      visit_count: visitCount,
      favorite_count: favoriteCount,
      view_count: viewCount
    });
  } catch (error) {
    console.error('统计错误:', error.message);
    res.status(500).json({ error: '服务器内部错误' });
  }
});

router.post('/visit', async (req, res) => {
  try {
    const { openid, page, user_id, info_id } = req.body;
    const ip = req.ip || req.connection.remoteAddress;
    const ua = req.headers['user-agent'] || '';

    try {
      await db.query(
        'INSERT INTO visits (user_id, openid, page, ip, user_agent) VALUES (?, ?, ?, ?, ?)',
        [user_id || null, openid || null, page || 'home', ip, ua]
      );
    } catch (e) {
      try {
        await db.query(
          'INSERT INTO visits (user_id, info_id) VALUES (?, ?)',
          [user_id || null, info_id || null]
        );
      } catch (e2) {
        console.log('访问记录失败:', e2.message);
      }
    }

    res.json({ success: true, message: '访问已记录' });
  } catch (error) {
    console.error('记录访问失败:', error.message);
    res.status(500).json({ error: '服务器内部错误' });
  }
});

router.get('/trend', async (req, res) => {
  try {
    let trendData = [];

    try {
      [trendData] = await db.query(`
        SELECT DATE(visit_time) as date, COUNT(*) as count 
        FROM visits 
        WHERE visit_time >= DATE_SUB(NOW(), INTERVAL 7 DAY)
        GROUP BY DATE(visit_time)
        ORDER BY date ASC
      `);
    } catch (e) {
      try {
        [trendData] = await db.query(`
          SELECT DATE(visited_at) as date, COUNT(*) as count 
          FROM visits 
          WHERE visited_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)
          GROUP BY DATE(visited_at)
          ORDER BY date ASC
        `);
      } catch (e2) {
        console.log('趋势数据查询失败:', e2.message);
      }
    }

    const result = trendData.map((item, index) => ({
      x: index * 15,
      y: item.count,
      date: item.date
    }));

    res.json(result.length > 0 ? result : [
      { x: 0, y: 0 }, { x: 15, y: 0 }, { x: 30, y: 0 },
      { x: 45, y: 0 }, { x: 60, y: 0 }, { x: 75, y: 0 }, { x: 90, y: 0 }
    ]);
  } catch (error) {
    console.error('获取趋势数据失败:', error.message);
    res.status(500).json({ error: '服务器内部错误' });
  }
});

module.exports = router;
