const express = require('express');
const router = express.Router();
const db = require('../config/db');

// 获取关于我们设置
router.get('/', async (req, res) => {
  try {
    const [settings] = await db.query('SELECT * FROM about_settings');
    res.json(settings);
  } catch (error) {
    console.error('获取关于我们设置失败:', error);
    res.status(500).json({ error: '获取设置失败' });
  }
});

// 获取单个设置
router.get('/:type', async (req, res) => {
  try {
    const { type } = req.params;
    const [setting] = await db.query('SELECT * FROM about_settings WHERE type = ?', [type]);
    if (setting.length > 0) {
      res.json(setting[0]);
    } else {
      res.status(404).json({ error: '设置不存在' });
    }
  } catch (error) {
    console.error('获取设置失败:', error);
    res.status(500).json({ error: '获取设置失败' });
  }
});

// 更新设置
router.put('/:type', async (req, res) => {
  try {
    const { type } = req.params;
    const { title, content } = req.body;
    
    const [result] = await db.query(
      'UPDATE about_settings SET title = ?, content = ? WHERE type = ?',
      [title, content, type]
    );
    
    if (result.affectedRows > 0) {
      res.json({ success: true, message: '设置更新成功' });
    } else {
      res.status(404).json({ error: '设置不存在' });
    }
  } catch (error) {
    console.error('更新设置失败:', error);
    res.status(500).json({ error: '更新设置失败' });
  }
});

module.exports = router;
