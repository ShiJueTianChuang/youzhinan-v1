/**
 * 客服功能路由
 * APP 端：发送消息、获取会话
 * 管理端：回复消息、管理自动回复
 */
const express = require('express');
const router = express.Router();
const db = require('../config/db');
const { authenticate, requireAdmin } = require('../middleware/auth');

const getUserId = (req) => req.user?.id ?? req.user?.userId ?? req.user?.user_id;

// ========== APP 端接口（需登录） ==========

/**
 * DELETE /api/customer-service/conversation - 用户清空自己的聊天记录
 */
router.delete('/conversation', authenticate, async (req, res) => {
  try {
    if (!db) return res.status(503).json({ code: 503, message: '服务暂不可用' });
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ code: 401, message: '未登录' });
    await db.query('DELETE FROM customer_service_messages WHERE user_id = ?', [userId]);
    res.json({ code: 200, message: '聊天记录已清空' });
  } catch (err) {
    console.error('清空聊天记录失败:', err);
    res.status(500).json({ code: 500, message: '服务器错误' });
  }
});

/**
 * GET /api/customer-service/conversation - 获取当前用户的客服会话消息
 */
router.get('/conversation', authenticate, async (req, res) => {
  try {
    if (!db) return res.status(503).json({ code: 503, message: '服务暂不可用' });
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ code: 401, message: '未登录' });

    const [rows] = await db.query(
      `SELECT id, user_id, sender_type, content, is_auto_reply, created_at 
       FROM customer_service_messages 
       WHERE user_id = ? 
       ORDER BY created_at ASC`,
      [userId]
    );

    res.json({ code: 200, data: { messages: rows } });
  } catch (err) {
    console.error('获取客服会话失败:', err);
    res.status(500).json({ code: 500, message: '服务器错误' });
  }
});

/**
 * GET /api/customer-service/debug-quick-questions - 调试接口：直接查库验证，无需逻辑处理
 * 仅管理员可访问。确认数据库能查出多少条，用于与 quick-questions 接口对比。
 */
router.get('/debug-quick-questions', authenticate, requireAdmin, async (req, res) => {
  try {
    if (!db) return res.status(503).json({ code: 503, message: '服务暂不可用' });
    const [rows] = await db.query(
      `SELECT id, keyword FROM customer_service_auto_replies 
       WHERE is_active = 1 AND (show_in_quick_questions = 1 OR show_in_quick_questions IS NULL)
       ORDER BY sort_order DESC, id ASC`
    );
    res.json({ code: 200, data: { count: (rows || []).length, rows: rows || [] } });
  } catch (err) {
    console.error('调试快捷问题失败:', err);
    res.status(500).json({ code: 500, message: '服务器错误' });
  }
});

/**
 * GET /api/customer-service/quick-questions - 获取可点击的快捷问题（用户点击后自动发送并触发回复）
 */
router.get('/quick-questions', authenticate, async (req, res) => {
  try {
    if (!db) return res.status(503).json({ code: 503, message: '服务暂不可用' });
    let rows;
    try {
      [rows] = await db.query(
        `SELECT id, keyword, question_text, sort_order 
         FROM customer_service_auto_replies 
         WHERE is_active = 1 AND (show_in_quick_questions = 1 OR show_in_quick_questions IS NULL)
         ORDER BY sort_order DESC, id ASC`
      );
    } catch (e) {
      [rows] = await db.query(
        `SELECT id, keyword, sort_order FROM customer_service_auto_replies 
         WHERE is_active = 1 ORDER BY sort_order DESC, id ASC`
      );
    }
    const questions = (rows || []).map(r => ({
      id: r.id,
      keyword: r.keyword,
      text: (r.question_text && String(r.question_text).trim()) || r.keyword
    }));
    res.json({ code: 200, data: { questions, total: questions.length } });
  } catch (err) {
    console.error('获取快捷问题失败:', err);
    res.status(500).json({ code: 500, message: '服务器错误' });
  }
});

/**
 * POST /api/customer-service/send - 用户发送消息（触发自动回复检查）
 */
router.post('/send', authenticate, async (req, res) => {
  try {
    if (!db) return res.status(503).json({ code: 503, message: '服务暂不可用' });
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ code: 401, message: '未登录' });

    const { content, trigger_auto_reply } = req.body || {};
    const msg = String(content || '').trim();
    if (!msg) return res.status(400).json({ code: 400, message: '消息内容不能为空' });
    if (msg.length > 2000) return res.status(400).json({ code: 400, message: '消息过长' });

    const [ins] = await db.query(
      `INSERT INTO customer_service_messages (user_id, sender_type, sender_id, content, is_auto_reply) 
       VALUES (?, 'user', ?, ?, 0)`,
      [userId, userId, msg]
    );
    const userMsgId = ins.insertId;

    // 仅当【点击快捷问题】时才触发自动回复；用户手动输入为【直接对话】，由管理员人工回复
    let autoReply = null;
    if (trigger_auto_reply === true || trigger_auto_reply === 'true') {
      const [rules] = await db.query(
        `SELECT id, keyword, reply_content FROM customer_service_auto_replies 
         WHERE is_active = 1 ORDER BY sort_order DESC, id ASC`
      );
      for (const r of rules) {
        if (msg.includes(r.keyword)) {
          await db.query(
            `INSERT INTO customer_service_messages (user_id, sender_type, content, is_auto_reply) 
             VALUES (?, 'admin', ?, 1)`,
            [userId, r.reply_content]
          );
          autoReply = r.reply_content;
          break;
        }
      }
    }

    res.json({
      code: 200,
      message: '发送成功',
      data: { message_id: userMsgId, auto_reply: autoReply }
    });
  } catch (err) {
    console.error('发送客服消息失败:', err);
    res.status(500).json({ code: 500, message: '服务器错误' });
  }
});

// ========== 管理端接口（需管理员） ==========

/**
 * GET /api/customer-service/admin/chats - 获取所有有消息的会话列表
 */
router.get('/admin/chats', authenticate, requireAdmin, async (req, res) => {
  try {
    if (!db) return res.status(503).json({ code: 503, message: '服务暂不可用' });

    const [rows] = await db.query(
      `SELECT u.id as user_id, u.username, u.nick_name, u.avatar_url, u.phone, u.email,
              latest.content as last_message, latest.created_at as last_at
       FROM users u
       INNER JOIN (
         SELECT m1.user_id, m1.content, m1.created_at
         FROM customer_service_messages m1
         INNER JOIN (SELECT user_id, MAX(created_at) as max_at FROM customer_service_messages GROUP BY user_id) m2
           ON m1.user_id = m2.user_id AND m1.created_at = m2.max_at
       ) latest ON u.id = latest.user_id
       ORDER BY latest.created_at DESC`
    );

    res.json({ code: 200, data: { chats: rows } });
  } catch (err) {
    console.error('获取客服会话列表失败:', err);
    res.status(500).json({ code: 500, message: '服务器错误' });
  }
});

/**
 * GET /api/customer-service/admin/chats/:userId/messages - 获取某用户的会话消息
 */
router.get('/admin/chats/:userId/messages', authenticate, requireAdmin, async (req, res) => {
  try {
    if (!db) return res.status(503).json({ code: 503, message: '服务暂不可用' });
    const userId = req.params.userId;

    const [rows] = await db.query(
      `SELECT id, user_id, sender_type, sender_id, content, is_auto_reply, created_at 
       FROM customer_service_messages 
       WHERE user_id = ? 
       ORDER BY created_at ASC`,
      [userId]
    );

    res.json({ code: 200, data: { messages: rows } });
  } catch (err) {
    console.error('获取客服消息失败:', err);
    res.status(500).json({ code: 500, message: '服务器错误' });
  }
});

/**
 * DELETE /api/customer-service/admin/chats/:userId - 管理员清空该用户的聊天记录
 */
router.delete('/admin/chats/:userId', authenticate, requireAdmin, async (req, res) => {
  try {
    if (!db) return res.status(503).json({ code: 503, message: '服务暂不可用' });
    const userId = req.params.userId;
    await db.query('DELETE FROM customer_service_messages WHERE user_id = ?', [userId]);
    res.json({ code: 200, message: '该用户聊天记录已清空' });
  } catch (err) {
    console.error('清空用户聊天记录失败:', err);
    res.status(500).json({ code: 500, message: '服务器错误' });
  }
});

/**
 * POST /api/customer-service/admin/chats/:userId/reply - 客服回复用户
 */
router.post('/admin/chats/:userId/reply', authenticate, requireAdmin, async (req, res) => {
  try {
    if (!db) return res.status(503).json({ code: 503, message: '服务暂不可用' });
    const adminId = getUserId(req);
    const userId = req.params.userId;
    const { content } = req.body || {};
    const msg = String(content || '').trim();
    if (!msg) return res.status(400).json({ code: 400, message: '回复内容不能为空' });
    if (msg.length > 2000) return res.status(400).json({ code: 400, message: '消息过长' });

    const [ins] = await db.query(
      `INSERT INTO customer_service_messages (user_id, sender_type, sender_id, content, is_auto_reply) 
       VALUES (?, 'admin', ?, ?, 0)`,
      [userId, adminId, msg]
    );

    res.json({ code: 200, message: '回复成功', data: { message_id: ins.insertId } });
  } catch (err) {
    console.error('客服回复失败:', err);
    res.status(500).json({ code: 500, message: '服务器错误' });
  }
});

/**
 * GET /api/customer-service/admin/auto-replies - 获取自动回复列表
 */
router.get('/admin/auto-replies', authenticate, requireAdmin, async (req, res) => {
  try {
    if (!db) return res.status(503).json({ code: 503, message: '服务暂不可用' });

    let rows;
    try {
      [rows] = await db.query(
        `SELECT id, keyword, question_text, reply_content, is_active, show_in_quick_questions, sort_order, created_at, updated_at 
         FROM customer_service_auto_replies ORDER BY sort_order DESC, id ASC`
      );
    } catch (e) {
      [rows] = await db.query(
        `SELECT id, keyword, reply_content, is_active, sort_order, created_at, updated_at 
         FROM customer_service_auto_replies ORDER BY sort_order DESC, id ASC`
      );
    }
    const list = (rows || []).map(r => ({
      ...r,
      question_text: r.question_text || null,
      show_in_quick_questions: r.show_in_quick_questions !== undefined ? r.show_in_quick_questions : 1
    }));
    res.json({ code: 200, data: { list } });
  } catch (err) {
    console.error('获取自动回复列表失败:', err);
    res.status(500).json({ code: 500, message: '服务器错误' });
  }
});

/**
 * POST /api/customer-service/admin/auto-replies - 新增自动回复
 */
router.post('/admin/auto-replies', authenticate, requireAdmin, async (req, res) => {
  try {
    if (!db) return res.status(503).json({ code: 503, message: '服务暂不可用' });
    const { keyword, question_text, reply_content, is_active = 1, show_in_quick_questions = 1, sort_order = 0 } = req.body || {};
    const kw = String(keyword || '').trim();
    const reply = String(reply_content || '').trim();
    const qt = question_text != null ? String(question_text).trim() : null;
    if (!kw) return res.status(400).json({ code: 400, message: '关键词不能为空' });
    if (!reply) return res.status(400).json({ code: 400, message: '回复内容不能为空' });

    const [ins] = await db.query(
      `INSERT INTO customer_service_auto_replies (keyword, question_text, reply_content, is_active, show_in_quick_questions, sort_order) 
       VALUES (?, ?, ?, ?, ?, ?)`,
      [kw, qt || null, reply, is_active ? 1 : 0, show_in_quick_questions ? 1 : 0, parseInt(sort_order) || 0]
    );

    res.json({ code: 200, message: '添加成功', data: { id: ins.insertId } });
  } catch (err) {
    console.error('添加自动回复失败:', err);
    res.status(500).json({ code: 500, message: '服务器错误' });
  }
});

/**
 * PUT /api/customer-service/admin/auto-replies/:id - 修改自动回复
 */
router.put('/admin/auto-replies/:id', authenticate, requireAdmin, async (req, res) => {
  try {
    if (!db) return res.status(503).json({ code: 503, message: '服务暂不可用' });
    const id = req.params.id;
    const { keyword, question_text, reply_content, is_active, show_in_quick_questions, sort_order } = req.body || {};

    const updates = [];
    const params = [];
    if (keyword !== undefined) {
      const kw = String(keyword).trim();
      if (!kw) return res.status(400).json({ code: 400, message: '关键词不能为空' });
      updates.push('keyword = ?');
      params.push(kw);
    }
    if (question_text !== undefined) {
      updates.push('question_text = ?');
      params.push(question_text != null ? String(question_text).trim() || null : null);
    }
    if (reply_content !== undefined) {
      const reply = String(reply_content).trim();
      if (!reply) return res.status(400).json({ code: 400, message: '回复内容不能为空' });
      updates.push('reply_content = ?');
      params.push(reply);
    }
    if (is_active !== undefined) {
      updates.push('is_active = ?');
      params.push(is_active ? 1 : 0);
    }
    if (show_in_quick_questions !== undefined) {
      updates.push('show_in_quick_questions = ?');
      params.push(show_in_quick_questions ? 1 : 0);
    }
    if (sort_order !== undefined) {
      updates.push('sort_order = ?');
      params.push(parseInt(sort_order) || 0);
    }
    if (updates.length === 0) return res.status(400).json({ code: 400, message: '无有效修改' });

    params.push(id);
    await db.query(
      `UPDATE customer_service_auto_replies SET ${updates.join(', ')} WHERE id = ?`,
      params
    );

    res.json({ code: 200, message: '修改成功' });
  } catch (err) {
    console.error('修改自动回复失败:', err);
    res.status(500).json({ code: 500, message: '服务器错误' });
  }
});

/**
 * DELETE /api/customer-service/admin/auto-replies/:id - 删除自动回复
 */
router.delete('/admin/auto-replies/:id', authenticate, requireAdmin, async (req, res) => {
  try {
    if (!db) return res.status(503).json({ code: 503, message: '服务暂不可用' });
    const id = req.params.id;
    await db.query('DELETE FROM customer_service_auto_replies WHERE id = ?', [id]);
    res.json({ code: 200, message: '删除成功' });
  } catch (err) {
    console.error('删除自动回复失败:', err);
    res.status(500).json({ code: 500, message: '服务器错误' });
  }
});

module.exports = router;
