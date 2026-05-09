const express = require('express');
const router = express.Router();

let db;
try {
  db = require('../config/db');
} catch (error) {
  console.error('数据库连接失败:', error.message);
}

// 获取所有分类
router.get('/', async (req, res) => {
  try {
    if (!db) {
      return res.status(503).json([]);
    }
    const [rows] = await db.query('SELECT * FROM categories ORDER BY id DESC');
    res.json(rows);
  } catch (error) {
    console.error('获取分类列表错误:', error.message);
    res.status(500).json([]);
  }
});

// 获取单条分类信息
router.get('/:id', async (req, res) => {
  try {
    const [rows] = await db.query('SELECT * FROM categories WHERE id = ?', [req.params.id]);
    if (rows.length === 0) {
      return res.status(404).json({ error: '分类不存在' });
    }
    res.json(rows[0]);
  } catch (error) {
    console.error('获取分类信息错误:', error.message);
    res.status(500).json({ error: '服务器内部错误' });
  }
});

// 添加分类
router.post('/', async (req, res) => {
  try {
    const { name } = req.body;
    
    // 检查必要字段
    if (!name || typeof name !== 'string' || name.trim() === '') {
      return res.status(400).json({ error: '分类名称不能为空' });
    }
    
    // 检查分类名称长度
    if (name.length > 50) {
      return res.status(400).json({ error: '分类名称长度不能超过50个字符' });
    }
    
    // 检查分类是否已存在
    const [existingCategories] = await db.query('SELECT id FROM categories WHERE name = ?', [name]);
    if (existingCategories.length > 0) {
      return res.status(400).json({ error: '该分类已存在' });
    }
    
    // 添加新分类
    const [result] = await db.query(
      'INSERT INTO categories (name) VALUES (?)',
      [name]
    );
    
    res.status(201).json({ id: result.insertId, name, message: '分类添加成功' });
  } catch (error) {
    console.error('添加分类错误:', error.message);
    res.status(500).json({ error: '服务器内部错误' });
  }
});

// 更新分类
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { name } = req.body;
    
    // 检查必要字段
    if (!name || typeof name !== 'string' || name.trim() === '') {
      return res.status(400).json({ error: '分类名称不能为空' });
    }
    
    // 检查分类名称长度
    if (name.length > 50) {
      return res.status(400).json({ error: '分类名称长度不能超过50个字符' });
    }
    
    // 检查分类是否存在
    const [existingCategories] = await db.query('SELECT id, name FROM categories WHERE id = ?', [id]);
    if (existingCategories.length === 0) {
      return res.status(404).json({ error: '分类不存在' });
    }
    
    // 检查新名称是否已被其他分类使用
    const [otherCategories] = await db.query('SELECT id FROM categories WHERE name = ? AND id != ?', [name, id]);
    if (otherCategories.length > 0) {
      return res.status(400).json({ error: '该分类名称已被使用' });
    }
    
    const oldName = existingCategories[0].name;
    
    // 更新分类名称
    const [result] = await db.query('UPDATE categories SET name = ? WHERE id = ?', [name, id]);
    
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: '分类不存在' });
    }
    
    // 如果分类名称改变，同步更新info表中的分类
    if (oldName !== name) {
      await db.query('UPDATE info SET category = ? WHERE category = ?', [name, oldName]);
    }
    
    res.json({ id, name, message: '分类更新成功' });
  } catch (error) {
    console.error('更新分类错误:', error.message);
    res.status(500).json({ error: '服务器内部错误' });
  }
});

// 删除分类
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    // 检查分类是否存在
    const [existingCategories] = await db.query('SELECT id, name FROM categories WHERE id = ?', [id]);
    if (existingCategories.length === 0) {
      return res.status(404).json({ error: '分类不存在' });
    }
    
    // 检查该分类是否被使用
    let usedInInfo = [];
    try {
      const [infoResult] = await db.query('SELECT id FROM info WHERE category = ?', [existingCategories[0].name]);
      usedInInfo = infoResult;
      if (usedInInfo.length > 0) {
        return res.status(400).json({ error: `该分类已被${usedInInfo.length}条信息使用，无法删除` });
      }
    } catch (error) {
      console.warn('检查分类使用情况失败:', error.message);
      // 忽略错误，继续执行删除操作
    }
    
    // 删除分类
    const [result] = await db.query('DELETE FROM categories WHERE id = ?', [id]);
    
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: '分类不存在' });
    }
    
    res.json({ message: '分类删除成功' });
  } catch (error) {
    console.error('删除分类错误:', error.message);
    res.status(500).json({ error: '服务器内部错误' });
  }
});

// 获取分类统计
router.get('/stats/count', async (req, res) => {
  try {
    if (!db) {
      return res.status(503).json([]);
    }
    
    // 先获取所有信息的分类统计，看看实际的数据
    let infoStats = [];
    try {
      const [stats] = await db.query('SELECT category, COUNT(*) as count FROM info GROUP BY category');
      infoStats = stats;
      console.log('信息分类统计原始数据:', infoStats);
    } catch (error) {
      console.warn('信息分类统计失败:', error.message);
      // 忽略错误，继续执行
    }
    
    // 获取所有分类
    let categories = [];
    try {
      const [catResult] = await db.query('SELECT id, name FROM categories ORDER BY name');
      categories = catResult;
    } catch (error) {
      console.warn('获取分类失败:', error.message);
      return res.json([]);
    }
    
    // 手动计算每个分类的统计数据
    const stats = [];
    for (const category of categories) {
      let count = 0;
      
      try {
        if (category.name === 'Bar') {
          const [barResult] = await db.query('SELECT COUNT(*) as count FROM info WHERE category = ?', ['bar']);
          count = barResult[0].count;
        } else if (category.name === '酒吧') {
          const [pubResult] = await db.query('SELECT COUNT(*) as count FROM info WHERE category = ?', ['酒吧']);
          count = pubResult[0].count;
        } else if (category.name === '民宿') {
          const [homestayResult] = await db.query('SELECT COUNT(*) as count FROM info WHERE category = ?', ['民宿']);
          count = homestayResult[0].count;
        } else if (category.name === '公园') {
          const [parkResult] = await db.query('SELECT COUNT(*) as count FROM info WHERE category = ?', ['公园']);
          count = parkResult[0].count;
        } else if (category.name === '休闲') {
          const [leisureResult] = await db.query('SELECT COUNT(*) as count FROM info WHERE category = ?', ['休闲']);
          count = leisureResult[0].count;
        } else if (category.name === '虚拟测试') {
          const [virtualResult] = await db.query('SELECT COUNT(*) as count FROM info WHERE category = ?', ['虚拟测试']);
          count = virtualResult[0].count;
        } else {
          const [otherResult] = await db.query('SELECT COUNT(*) as count FROM info WHERE category = ?', [category.name]);
          count = otherResult[0].count;
        }
      } catch (error) {
        console.warn(`统计分类 ${category.name} 失败:`, error.message);
        count = 0;
      }
      
      stats.push({ id: category.id, name: category.name, count: count.toString() });
    }
    
    console.log('分类统计结果:', stats);
    res.json(stats);
  } catch (error) {
    console.error('获取分类统计错误:', error.message);
    res.json([]);
  }
});

module.exports = router;