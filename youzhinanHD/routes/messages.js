const express = require('express');
const router = express.Router();
const db = require('../config/db');

// 发送消息（管理员使用）
router.post('/send', async (req, res) => {
  try {
    const { type, title, content, recipient_account } = req.body;
    const senderId = 1;

    if (!type || !title || !content) {
      return res.status(400).json({ error: '缺少必要参数' });
    }

    if (type === 'personal' && !recipient_account) {
      return res.status(400).json({ error: '个人消息需要指定接收者账号' });
    }

    let receiverId = null;
    let receiverUsername = null;

    // 如果是个人消息，查找用户ID
    if (type === 'personal') {
      const [users] = await db.query('SELECT id, username FROM users WHERE username = ?', [recipient_account]);
      if (users.length === 0) {
        return res.status(404).json({ error: '用户不存在' });
      }
      receiverId = users[0].id;
      receiverUsername = users[0].username;
    }

    const [result] = await db.query(
      'INSERT INTO messages (type, title, content, sender_id, receiver_id, receiver_username) VALUES (?, ?, ?, ?, ?, ?)',
      [type, title, content, senderId, receiverId, receiverUsername]
    );

    res.json({ 
      success: true, 
      message: '消息发送成功', 
      messageId: result.insertId 
    });
  } catch (error) {
    console.error('发送消息失败:', error.message);
    res.status(500).json({ error: '服务器内部错误' });
  }
});

// 获取所有消息列表（管理员使用）
router.get('/', async (req, res) => {
  try {
    const { type } = req.query;

    let query = 'SELECT id, type, title, content, sender_id, receiver_id, receiver_username, is_read, created_at, read_at FROM messages';
    let params = [];

    if (type) {
      query += ' WHERE type = ?';
      params.push(type);
    }

    query += ' ORDER BY created_at DESC';

    const [messages] = await db.query(query, params);

    res.json(messages);
  } catch (error) {
    console.error('获取消息列表失败:', error.message);
    res.status(500).json({ error: '服务器内部错误' });
  }
});

// 删除消息（管理员使用）
router.delete('/:id', async (req, res) => {
  try {
    const messageId = req.params.id;

    const [result] = await db.query('DELETE FROM messages WHERE id = ?', [messageId]);

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: '消息不存在' });
    }

    res.json({ success: true, message: '消息删除成功' });
  } catch (error) {
    console.error('删除消息失败:', error.message);
    res.status(500).json({ error: '服务器内部错误' });
  }
});

// ========== 小程序接口 ==========

// 获取用户消息列表（小程序使用）
router.get('/user', async (req, res) => {
  try {
    const { user_id, openid, page = 1, pageSize = 20 } = req.query;
    
    if (!user_id && !openid) {
      return res.status(400).json({ error: '缺少用户标识' });
    }

    // 获取用户ID
    let userId = user_id;
    if (!userId && openid) {
      const [users] = await db.query('SELECT id FROM users WHERE openid = ? OR wx_openid = ?', [openid, openid]);
      if (users.length > 0) {
        userId = users[0].id;
      }
    }

    const offset = (page - 1) * pageSize;

    // 查询广播消息和该用户的个人消息
    let query = `
      SELECT m.*, 
        CASE 
          WHEN m.type = 'broadcast' THEN FALSE
          ELSE m.is_read 
        END as is_read,
        CASE 
          WHEN m.type = 'broadcast' THEN NULL
          ELSE m.read_at 
        END as read_at
      FROM messages m
      WHERE m.type = 'broadcast' 
        OR (m.type = 'personal' AND m.receiver_id = ?)
      ORDER BY m.created_at DESC
      LIMIT ? OFFSET ?
    `;

    const [messages] = await db.query(query, [userId || 0, parseInt(pageSize), offset]);

    // 如果有用户ID，检查广播消息的已读状态
    if (userId) {
      for (let msg of messages) {
        if (msg.type === 'broadcast') {
          const [reads] = await db.query(
            'SELECT read_at FROM message_reads WHERE message_id = ? AND user_id = ?',
            [msg.id, userId]
          );
          if (reads.length > 0) {
            msg.is_read = true;
            msg.read_at = reads[0].read_at;
          }
        }
      }
    }

    // 获取未读消息数
    let unreadCount = 0;
    if (userId) {
      // 未读的个人消息
      const [personalUnread] = await db.query(
        'SELECT COUNT(*) as count FROM messages WHERE type = "personal" AND receiver_id = ? AND is_read = FALSE',
        [userId]
      );
      
      // 未读的广播消息
      const [broadcastUnread] = await db.query(`
        SELECT COUNT(*) as count 
        FROM messages m 
        WHERE m.type = 'broadcast' 
          AND m.id NOT IN (
            SELECT message_id FROM message_reads WHERE user_id = ?
          )
      `, [userId]);

      // 数据库驱动可能返回字符串类型的 count，确保数值相加而非字符串拼接
      const pCount = parseInt(personalUnread[0].count || 0, 10);
      const bCount = parseInt(broadcastUnread[0].count || 0, 10);
      unreadCount = pCount + bCount;
    }

    res.json({
      success: true,
      data: messages,
      unread_count: unreadCount
    });
  } catch (error) {
    console.error('获取用户消息失败:', error.message);
    res.status(500).json({ error: '服务器内部错误' });
  }
});

// 标记消息为已读（小程序使用）
router.post('/:id/read', async (req, res) => {
  try {
    const messageId = req.params.id;
    const { user_id, openid } = req.body;

    if (!user_id && !openid) {
      return res.status(400).json({ error: '缺少用户标识' });
    }

    // 获取用户ID
    let userId = user_id;
    if (!userId && openid) {
      const [users] = await db.query('SELECT id FROM users WHERE openid = ? OR wx_openid = ?', [openid, openid]);
      if (users.length > 0) {
        userId = users[0].id;
      }
    }

    if (!userId) {
      return res.status(404).json({ error: '用户不存在' });
    }

    // 获取消息
    const [messages] = await db.query('SELECT * FROM messages WHERE id = ?', [messageId]);
    if (messages.length === 0) {
      return res.status(404).json({ error: '消息不存在' });
    }

    const message = messages[0];

    if (message.type === 'personal') {
      // 个人消息：更新 is_read 字段
      await db.query(
        'UPDATE messages SET is_read = TRUE, read_at = NOW() WHERE id = ?',
        [messageId]
      );
    } else {
      // 广播消息：在 message_reads 表中记录
      try {
        await db.query(
          'INSERT INTO message_reads (message_id, user_id) VALUES (?, ?)',
          [messageId, userId]
        );
      } catch (e) {
        // 如果已经存在，忽略
        if (e.code !== 'ER_DUP_ENTRY') {
          throw e;
        }
      }
    }

    res.json({ success: true, message: '消息已标记为已读' });
  } catch (error) {
    console.error('标记已读失败:', error.message);
    res.status(500).json({ error: '服务器内部错误' });
  }
});

module.exports = router;
