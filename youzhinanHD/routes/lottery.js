const express = require('express');
const router = express.Router();
const db = require('../config/db');
const { getUserInviteCode, findUserByInviteCode, ensureInviteCodeColumn } = require('../utils/inviteCode');
const { authenticate, requireAdmin } = require('../middleware/auth');

ensureInviteCodeColumn();

async function ensureTables() {
  try {
    await db.execute(`
      CREATE TABLE IF NOT EXISTS lottery_activities (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(200) NOT NULL,
        start_time DATETIME NOT NULL,
        end_time DATETIME NOT NULL,
        daily_limit INT NOT NULL DEFAULT 1,
        total_limit INT NOT NULL DEFAULT 10,
        win_rate DECIMAL(5,2) NOT NULL DEFAULT 30.00,
        status VARCHAR(20) NOT NULL DEFAULT 'inactive',
        prize_description TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        KEY idx_status (status),
        KEY idx_time (start_time, end_time)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);

    await db.execute(`
      CREATE TABLE IF NOT EXISTS lottery_prizes (
        id INT AUTO_INCREMENT PRIMARY KEY,
        activity_id INT NOT NULL,
        name VARCHAR(200) NOT NULL,
        image VARCHAR(500) DEFAULT '',
        quantity INT NOT NULL DEFAULT 0,
        position VARCHAR(50) DEFAULT '',
        is_thank_you TINYINT NOT NULL DEFAULT 0,
        needs_shipping TINYINT NOT NULL DEFAULT 1,
        original_quantity INT NOT NULL DEFAULT 0,
        probability DECIMAL(5,2) NOT NULL DEFAULT 0.00,
        KEY idx_activity (activity_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);

    await db.execute(`
      CREATE TABLE IF NOT EXISTS lottery_records (
        id INT AUTO_INCREMENT PRIMARY KEY,
        activity_id INT NOT NULL,
        user_id INT NOT NULL,
        prize_id INT,
        is_winner TINYINT NOT NULL DEFAULT 0,
        draw_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        KEY idx_user_activity (user_id, activity_id),
        KEY idx_activity (activity_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);

    await db.execute(`
      CREATE TABLE IF NOT EXISTS user_daily_lottery (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        activity_id INT NOT NULL,
        date DATE NOT NULL,
        draw_count INT NOT NULL DEFAULT 0,
        bonus_count INT NOT NULL DEFAULT 0,
        invite_bonus INT NOT NULL DEFAULT 0,
        UNIQUE KEY uk_user_activity_date (user_id, activity_id, date)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);

    await db.execute(`
      CREATE TABLE IF NOT EXISTS ad_watch_records (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        activity_id INT NOT NULL,
        ad_id VARCHAR(100) NOT NULL,
        ad_duration INT NOT NULL DEFAULT 0,
        watch_duration INT NOT NULL DEFAULT 0,
        status VARCHAR(20) NOT NULL DEFAULT 'completed',
        ip_address VARCHAR(50) DEFAULT NULL,
        user_agent VARCHAR(500) DEFAULT NULL,
        watch_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        KEY idx_user_activity (user_id, activity_id),
        KEY idx_user_ad_time (user_id, ad_id, watch_time)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);

    await db.execute(`
      CREATE TABLE IF NOT EXISTS lottery_shipping_addresses (
        id INT AUTO_INCREMENT PRIMARY KEY,
        record_id INT NOT NULL,
        user_id INT NOT NULL,
        prize_id INT,
        name VARCHAR(100) NOT NULL,
        phone VARCHAR(20) NOT NULL,
        province VARCHAR(50) NOT NULL,
        city VARCHAR(50) NOT NULL,
        district VARCHAR(50) NOT NULL,
        detail_address VARCHAR(1000) NOT NULL,
        shipping_status VARCHAR(20) DEFAULT 'pending',
        tracking_number VARCHAR(100) DEFAULT NULL,
        courier_company VARCHAR(50) DEFAULT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE KEY uk_record_id (record_id),
        KEY idx_user_id (user_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);

    await db.execute(`
      CREATE TABLE IF NOT EXISTS user_invitations (
        id INT AUTO_INCREMENT PRIMARY KEY,
        inviter_id INT NOT NULL,
        invitee_id INT NOT NULL,
        activity_id INT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE KEY uk_invitee (invitee_id),
        KEY idx_inviter (inviter_id),
        KEY idx_inviter_date (inviter_id, created_at)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);

    const [prizeDescCol] = await db.query(
      "SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'lottery_activities' AND COLUMN_NAME = 'prize_description'"
    );
    if (prizeDescCol.length === 0) {
      await db.execute(
        "ALTER TABLE lottery_activities ADD COLUMN prize_description TEXT AFTER win_rate"
      );
    }

    const [uniqueIdx] = await db.query(
      "SELECT INDEX_NAME FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_NAME = 'user_daily_lottery' AND INDEX_NAME = 'uk_user_activity_date'"
    );
    if (uniqueIdx.length === 0) {
      await db.execute(
        'ALTER TABLE user_daily_lottery ADD UNIQUE INDEX uk_user_activity_date (user_id, activity_id, date)'
      );
    }

    const [bonusCol] = await db.query(
      "SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'user_daily_lottery' AND COLUMN_NAME = 'bonus_count'"
    );
    if (bonusCol.length === 0) {
      await db.execute(
        "ALTER TABLE user_daily_lottery ADD COLUMN bonus_count INT NOT NULL DEFAULT 0 AFTER draw_count"
      );
    }

    const [thankYouCol] = await db.query(
      "SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'lottery_prizes' AND COLUMN_NAME = 'is_thank_you'"
    );
    if (thankYouCol.length === 0) {
      await db.execute(
        "ALTER TABLE lottery_prizes ADD COLUMN is_thank_you TINYINT NOT NULL DEFAULT 0 AFTER position"
      );
    }

    const [needsShippingCol] = await db.query(
      "SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'lottery_prizes' AND COLUMN_NAME = 'needs_shipping'"
    );
    if (needsShippingCol.length === 0) {
      await db.execute(
        "ALTER TABLE lottery_prizes ADD COLUMN needs_shipping TINYINT NOT NULL DEFAULT 1 AFTER is_thank_you"
      );
    }

    const [originalQtyCol] = await db.query(
      "SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'lottery_prizes' AND COLUMN_NAME = 'original_quantity'"
    );
    if (originalQtyCol.length === 0) {
      await db.execute(
        "ALTER TABLE lottery_prizes ADD COLUMN original_quantity INT NOT NULL DEFAULT 0 AFTER needs_shipping"
      );
    }
    await db.execute(
      "UPDATE lottery_prizes SET original_quantity = quantity WHERE original_quantity = 0 AND quantity > 0"
    );

    const [courierCol] = await db.query(
      "SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'lottery_shipping_addresses' AND COLUMN_NAME = 'courier_company'"
    );
    if (courierCol.length === 0) {
      await db.execute(
        "ALTER TABLE lottery_shipping_addresses ADD COLUMN courier_company VARCHAR(50) DEFAULT NULL AFTER tracking_number"
      );
    }

    const [winRateCol] = await db.query(
      "SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'lottery_activities' AND COLUMN_NAME = 'win_rate'"
    );
    if (winRateCol.length === 0) {
      await db.execute(
        "ALTER TABLE lottery_activities ADD COLUMN win_rate DECIMAL(5,2) NOT NULL DEFAULT 30.00 AFTER total_limit"
      );
    }

    const [probCol] = await db.query(
      "SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'lottery_prizes' AND COLUMN_NAME = 'probability'"
    );
    if (probCol.length === 0) {
      await db.execute(
        "ALTER TABLE lottery_prizes ADD COLUMN probability DECIMAL(5,2) NOT NULL DEFAULT 0.00 AFTER original_quantity"
      );
    }

    const [inviteBonusCol] = await db.query(
      "SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'user_daily_lottery' AND COLUMN_NAME = 'invite_bonus'"
    );
    if (inviteBonusCol.length === 0) {
      await db.execute(
        "ALTER TABLE user_daily_lottery ADD COLUMN invite_bonus INT NOT NULL DEFAULT 0 AFTER bonus_count"
      );
    }
  } catch (error) {
    console.error('创建表失败:', error);
  }
}

function isThankYou(val) {
  return Number(val) === 1;
}

function getUserId(req) {
  return req.user?.id || req.user?.userId || req.user?.user_id;
}

function calculateEffectiveProbabilities(prizes, winRate) {
  const rate = (winRate !== null && winRate !== undefined && !isNaN(Number(winRate))) ? Number(winRate) : 30;

  const inStockNormalPrizes = prizes.filter(p => !isThankYou(p.is_thank_you) && Number(p.quantity) > 0);
  const totalOriginalQuantity = inStockNormalPrizes.reduce((sum, p) => sum + (Number(p.original_quantity) > 0 ? Number(p.original_quantity) : Number(p.quantity)), 0);

  const result = prizes.map(p => {
    let effectiveProbability = 0;
    if (isThankYou(p.is_thank_you)) {
      effectiveProbability = -1;
    } else if (Number(p.quantity) > 0) {
      const origQty = Number(p.original_quantity) > 0 ? Number(p.original_quantity) : Number(p.quantity);
      effectiveProbability = totalOriginalQuantity > 0 ? (origQty / totalOriginalQuantity) * rate : 0;
    }
    return {
      ...p,
      effective_probability: effectiveProbability,
      out_of_stock: !isThankYou(p.is_thank_you) && Number(p.quantity) <= 0 ? 1 : 0
    };
  });

  const normalTotalProb = result
    .filter(p => p.effective_probability > 0)
    .reduce((sum, p) => sum + p.effective_probability, 0);

  const thankYouCount = result.filter(p => p.effective_probability === -1).length;
  const thankYouTotalProb = Math.max(0, 100 - normalTotalProb);
  const thankYouEachProb = thankYouCount > 0 ? thankYouTotalProb / thankYouCount : 0;

  for (const p of result) {
    if (p.effective_probability === -1) {
      p.effective_probability = thankYouEachProb;
    }
  }

  return result;
}

let tablesReady = false;
let tablesReadyPromise = ensureTables().then(() => { tablesReady = true; });

async function waitForTables() {
  if (!tablesReady) await tablesReadyPromise;
}

waitForTables();

router.get('/activities', authenticate, requireAdmin, async (req, res) => {
  try {
    const [activities] = await db.query('SELECT * FROM lottery_activities ORDER BY created_at DESC');
    res.json(activities);
  } catch (error) {
    console.error('获取抽奖活动失败:', error);
    res.status(500).json({ error: '获取活动失败: ' + (error.message || '未知错误') });
  }
});

router.get('/activities/:id', authenticate, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const [activity] = await db.query('SELECT * FROM lottery_activities WHERE id = ?', [id]);
    if (activity.length > 0) {
      const [prizes] = await db.query('SELECT * FROM lottery_prizes WHERE activity_id = ?', [id]);
      res.json({ ...activity[0], prizes });
    } else {
      res.status(404).json({ error: '活动不存在' });
    }
  } catch (error) {
    console.error('获取活动详情失败:', error);
    res.status(500).json({ error: '获取活动详情失败: ' + (error.message || '未知错误') });
  }
});

router.post('/activities', authenticate, requireAdmin, async (req, res) => {
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();

    const body = req.body || {};
    const { name, start_time, end_time, daily_limit, total_limit, win_rate, status, prize_description, prizes } = body;

    const activityName = name || '未命名活动';
    const activityStartTime = start_time || new Date().toISOString();
    const activityEndTime = end_time || new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
    const activityDailyLimit = daily_limit !== undefined ? daily_limit : 1;
    const activityTotalLimit = total_limit !== undefined ? total_limit : 10;
    const activityWinRate = win_rate !== undefined ? Math.min(100, Math.max(0.01, isNaN(Number(win_rate)) ? 30 : Number(win_rate))) : 30;
    const activityStatus = status || 'inactive';
    const activityPrizeDescription = prize_description || '';

    if (activityStatus === 'active') {
      const [conflict] = await conn.query(
        'SELECT id FROM lottery_activities WHERE status = ? AND start_time <= ? AND end_time >= ? LIMIT 1',
        ['active', activityEndTime, activityStartTime]
      );
      if (conflict.length > 0) {
        await conn.rollback();
        return res.status(400).json({ error: '该时间段内已有活跃的抽奖活动，请调整时间或先结束现有活动' });
      }
    }

    if (prizes && prizes.length > 8) {
      await conn.rollback();
      return res.status(400).json({ error: '奖品数量不能超过8个' });
    }

    const [result] = await conn.execute(
      'INSERT INTO lottery_activities (name, start_time, end_time, daily_limit, total_limit, win_rate, status, prize_description) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [activityName, activityStartTime, activityEndTime, activityDailyLimit, activityTotalLimit, activityWinRate, activityStatus, activityPrizeDescription]
    );

    const activityId = result.insertId;

    if (prizes && prizes.length > 0) {
      const normalPrizesInput = prizes.filter(p => !p.is_thank_you);
      const thankYouPrizeInput = prizes.filter(p => p.is_thank_you);

      if (normalPrizesInput.length > 0 && thankYouPrizeInput.length === 0) {
        await conn.rollback();
        return res.status(400).json({ error: '有正式奖品时必须配置至少一个"谢谢参与"奖品' });
      }

      const totalNormalQuantity = normalPrizesInput.reduce((sum, p) => sum + (p.quantity !== undefined ? p.quantity : 1), 0);

      const normalTotalProb = normalPrizesInput.reduce((sum, p) => {
        const q = p.quantity !== undefined ? p.quantity : 1;
        return sum + (totalNormalQuantity > 0 ? (q / totalNormalQuantity) * activityWinRate : 0);
      }, 0);
      const thankYouTotalProb = Math.max(0, 100 - normalTotalProb);
      const thankYouEachProb = thankYouPrizeInput.length > 0 ? thankYouTotalProb / thankYouPrizeInput.length : 0;

      for (const prize of prizes) {
        const prizeName = prize.name || '未命名奖品';
        const prizeImage = prize.image || '';
        const prizeQuantity = prize.quantity !== undefined ? prize.quantity : 1;
        const prizeIsThankYou = prize.is_thank_you ? 1 : 0;
        const prizeNeedsShipping = prize.is_thank_you ? 0 : (prize.needs_shipping !== undefined ? (prize.needs_shipping ? 1 : 0) : 1);
        const prizePosition = prize.position || '';

        let prizeProbability = 0;
        if (prizeIsThankYou) {
          prizeProbability = thankYouEachProb;
        } else if (totalNormalQuantity > 0) {
          prizeProbability = (prizeQuantity / totalNormalQuantity) * activityWinRate;
        }

        await conn.execute(
          'INSERT INTO lottery_prizes (activity_id, name, image, quantity, original_quantity, probability, position, is_thank_you, needs_shipping) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
          [activityId, prizeName, prizeImage, prizeQuantity, prizeQuantity, prizeProbability, prizePosition, prizeIsThankYou, prizeNeedsShipping]
        );
      }
    }

    await conn.commit();
    res.json({ success: true, message: '活动创建成功', activity_id: activityId });
  } catch (error) {
    await conn.rollback();
    console.error('创建活动失败:', error);
    res.status(500).json({ error: '创建活动失败: ' + (error.message || error.sqlMessage || '未知错误') });
  } finally {
    conn.release();
  }
});

router.put('/activities/:id', authenticate, requireAdmin, async (req, res) => {
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();

    const { id } = req.params;
    const body = req.body || {};
    const { name, start_time, end_time, daily_limit, total_limit, win_rate, status, prize_description, prizes } = body;

    const [existing] = await conn.query('SELECT * FROM lottery_activities WHERE id = ?', [id]);
    if (existing.length === 0) {
      await conn.rollback();
      return res.status(404).json({ error: '活动不存在' });
    }

    const current = existing[0];
    const isCurrentlyActive = current.status === 'active' && new Date(current.start_time) <= new Date() && new Date(current.end_time) >= new Date();

    let activityName = name !== undefined ? name : current.name;
    let activityStartTime = start_time !== undefined ? start_time : current.start_time;
    let activityEndTime = end_time !== undefined ? end_time : current.end_time;
    let activityDailyLimit = daily_limit !== undefined ? daily_limit : current.daily_limit;
    let activityTotalLimit = total_limit !== undefined ? total_limit : current.total_limit;
    let activityWinRate = win_rate !== undefined ? Math.min(100, Math.max(0.01, isNaN(Number(win_rate)) ? 30 : Number(win_rate))) : (current.win_rate !== null && current.win_rate !== undefined ? Number(current.win_rate) : 30);
    let activityStatus = status !== undefined ? status : current.status;
    let activityPrizeDescription = prize_description !== undefined ? prize_description : current.prize_description;

    if (isCurrentlyActive) {
      activityStartTime = current.start_time;
      activityEndTime = current.end_time;
      activityWinRate = current.win_rate !== null && current.win_rate !== undefined ? Number(current.win_rate) : 30;
      activityDailyLimit = Math.max(current.daily_limit, daily_limit !== undefined ? daily_limit : current.daily_limit);
      activityTotalLimit = Math.max(current.total_limit, total_limit !== undefined ? total_limit : current.total_limit);
    }

    if (activityStatus === 'active' && !isCurrentlyActive) {
      if (current.status === 'ended') {
        const [availablePrizes] = await conn.query(
          'SELECT COUNT(*) as count FROM lottery_prizes WHERE activity_id = ? AND is_thank_you = 0 AND quantity > 0',
          [id]
        );
        if (availablePrizes[0].count === 0) {
          await conn.rollback();
          return res.status(400).json({ error: '该活动所有奖品已发完，无法重新激活。请添加新奖品后再启用' });
        }
      }

      const [conflict] = await conn.query(
        'SELECT id FROM lottery_activities WHERE status = ? AND id != ? AND start_time <= ? AND end_time >= ? LIMIT 1',
        ['active', id, activityEndTime, activityStartTime]
      );
      if (conflict.length > 0) {
        await conn.rollback();
        return res.status(400).json({ error: '该时间段内已有活跃的抽奖活动，请调整时间或先结束现有活动' });
      }
    }

    await conn.execute(
      'UPDATE lottery_activities SET name = ?, start_time = ?, end_time = ?, daily_limit = ?, total_limit = ?, win_rate = ?, status = ?, prize_description = ? WHERE id = ?',
      [activityName, activityStartTime, activityEndTime, activityDailyLimit, activityTotalLimit, activityWinRate, activityStatus, activityPrizeDescription, id]
    );

    if (prizes && prizes.length > 8) {
      await conn.rollback();
      return res.status(400).json({ error: '奖品数量不能超过8个' });
    }

    if (prizes && prizes.length > 0) {
      const normalPrizesInput = prizes.filter(p => !p.is_thank_you);
      const thankYouPrizeInput = prizes.filter(p => p.is_thank_you);

      if (normalPrizesInput.length > 0 && thankYouPrizeInput.length === 0) {
        await conn.rollback();
        return res.status(400).json({ error: '有正式奖品时必须配置至少一个"谢谢参与"奖品' });
      }

      // 所有正式奖品的总数量（用于概率计算）
      const totalNormalQuantity = normalPrizesInput.reduce((sum, p) => sum + (p.quantity !== undefined ? p.quantity : 1), 0);

      // 统一计算每个奖品应存储的概率
      const normalTotalProbCalc = normalPrizesInput.reduce((sum, p) => {
        const q = p.quantity !== undefined ? p.quantity : 1;
        return sum + (totalNormalQuantity > 0 ? (q / totalNormalQuantity) * activityWinRate : 0);
      }, 0);
      const thankYouTotalProbCalc = Math.max(0, 100 - normalTotalProbCalc);
      const thankYouEachProbCalc = thankYouPrizeInput.length > 0 ? thankYouTotalProbCalc / thankYouPrizeInput.length : 0;

      // 收集提交的奖品ID
      const submitIds = prizes.filter(p => p.id).map(p => Number(p.id));
      console.log('[PUT /activities] 前端提交奖品:', JSON.stringify(prizes.map(p => ({ id: p.id, name: p.name, qty: p.quantity }))));
      console.log('[PUT /activities] submitIds:', submitIds);
      
      const [existingAll] = await conn.query('SELECT id, quantity, original_quantity FROM lottery_prizes WHERE activity_id = ?', [id]);
      const existingDbIds = existingAll.map(p => Number(p.id));
      console.log('[PUT /activities] 数据库已有奖品ID:', existingDbIds);
      
      const idsToDelete = existingDbIds.filter(eid => !submitIds.includes(eid));
      console.log('[PUT /activities] 将要删除的奖品ID:', idsToDelete);

      if (idsToDelete.length > 0) {
        const [prizesWithRecords] = await conn.query(
          'SELECT DISTINCT prize_id FROM lottery_records WHERE activity_id = ? AND prize_id IN (?)',
          [id, idsToDelete]
        );
        if (prizesWithRecords.length > 0) {
          await conn.rollback();
          return res.status(400).json({ error: '部分奖品已有抽奖记录，无法删除。请刷新页面重新编辑' });
        }
        for (const eid of idsToDelete) {
          await conn.execute('DELETE FROM lottery_prizes WHERE id = ?', [eid]);
        }
      }

      // 删除后重新查询，构建映射
      const [existingAfterDelete] = await conn.query('SELECT id, quantity, original_quantity FROM lottery_prizes WHERE activity_id = ?', [id]);
      const existingMap = {};
      const existingIdsAfterDelete = [];
      for (const ep of existingAfterDelete) { 
        existingMap[Number(ep.id)] = ep; 
        existingIdsAfterDelete.push(Number(ep.id));
      }

      // 遍历每个奖品，统一处理
      for (const prize of prizes) {
        const prizeName = prize.name || '未命名奖品';
        const prizeImage = prize.image || '';
        const prizeNewTotal = prize.quantity !== undefined ? prize.quantity : 1; // 管理员设置的"总数量"
        const prizeIsThankYou = prize.is_thank_you ? 1 : 0;
        const prizeNeedsShipping = prize.is_thank_you ? 0 : (prize.needs_shipping !== undefined ? (prize.needs_shipping ? 1 : 0) : 1);
        const prizePosition = prize.position || '';

        // 所有奖品的概率都按当前提交数据统一重算，不存在"保留旧概率"
        let prizeProbability = 0;
        if (prizeIsThankYou) {
          prizeProbability = thankYouEachProbCalc;
        } else if (totalNormalQuantity > 0) {
          prizeProbability = (prizeNewTotal / totalNormalQuantity) * activityWinRate;
        }

        if (prize.id && existingIdsAfterDelete.includes(Number(prize.id))) {
          const existingData = existingMap[Number(prize.id)];
          const dbOriginal = existingData ? (existingData.original_quantity || existingData.quantity || 0) : 0;
          const dbQuantity = existingData ? existingData.quantity : 0;
          const claimedCount = Math.max(0, dbOriginal - dbQuantity);

          if (prizeNewTotal < claimedCount) {
            await conn.rollback();
            return res.status(400).json({ error: `奖品"${prizeName}"已发放${claimedCount}个，总数量不能少于已发放数` });
          }

          // 直接计算新的剩余数量 = 新总数量 - 已发放数
          const newRemaining = prizeNewTotal - claimedCount;

          await conn.execute(
            'UPDATE lottery_prizes SET name = ?, image = ?, quantity = ?, original_quantity = ?, probability = ?, position = ?, is_thank_you = ?, needs_shipping = ? WHERE id = ? AND activity_id = ?',
            [prizeName, prizeImage, newRemaining, prizeNewTotal, prizeProbability, prizePosition, prizeIsThankYou, prizeNeedsShipping, prize.id, id]
          );
        } else {
          // 新奖品：quantity = original_quantity = 管理员填的数量
          await conn.execute(
            'INSERT INTO lottery_prizes (activity_id, name, image, quantity, original_quantity, probability, position, is_thank_you, needs_shipping) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
            [id, prizeName, prizeImage, prizeNewTotal, prizeNewTotal, prizeProbability, prizePosition, prizeIsThankYou, prizeNeedsShipping]
          );
        }
      }
    }

    await conn.commit();
    const [updatedPrizes] = await conn.query('SELECT id, name, quantity, original_quantity FROM lottery_prizes WHERE activity_id = ?', [id]);
    res.json({ success: true, message: '活动更新成功', prizes: updatedPrizes });
  } catch (error) {
    await conn.rollback();
    console.error('更新活动失败:', error);
    res.status(500).json({ error: '更新活动失败: ' + (error.message || error.sqlMessage || '未知错误') });
  } finally {
    conn.release();
  }
});

router.delete('/activities/:id', authenticate, requireAdmin, async (req, res) => {
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();

    const { id } = req.params;

    const [activity] = await conn.query('SELECT status, start_time, end_time FROM lottery_activities WHERE id = ? FOR UPDATE', [id]);
    if (activity.length === 0) {
      await conn.rollback();
      return res.status(404).json({ error: '活动不存在' });
    }

    const isCurrentlyActive = activity[0].status === 'active' && new Date(activity[0].start_time) <= new Date() && new Date(activity[0].end_time) >= new Date();
    if (isCurrentlyActive) {
      await conn.rollback();
      return res.status(400).json({ error: '活动进行中无法删除，请先将活动设为禁用状态' });
    }

    const [unfinishedShipping] = await conn.query(
      'SELECT COUNT(*) as count FROM lottery_shipping_addresses sa JOIN lottery_records lr ON sa.record_id = lr.id WHERE lr.activity_id = ? AND sa.shipping_status IN (?, ?)',
      [id, 'pending', 'shipped']
    );
    if (unfinishedShipping[0].count > 0) {
      await conn.rollback();
      return res.status(400).json({ error: `该活动有 ${unfinishedShipping[0].count} 个未完成的发货记录，请先完成发货后再删除` });
    }

    await conn.execute('DELETE FROM lottery_shipping_addresses WHERE record_id IN (SELECT id FROM lottery_records WHERE activity_id = ?)', [id]);
    await conn.execute('DELETE FROM lottery_records WHERE activity_id = ?', [id]);
    await conn.execute('DELETE FROM ad_watch_records WHERE activity_id = ?', [id]);
    await conn.execute('DELETE FROM user_daily_lottery WHERE activity_id = ?', [id]);
    await conn.execute('DELETE FROM user_invitations WHERE activity_id = ?', [id]);
    await conn.execute('DELETE FROM lottery_prizes WHERE activity_id = ?', [id]);
    await conn.execute('DELETE FROM lottery_activities WHERE id = ?', [id]);

    await conn.commit();
    res.json({ success: true, message: '活动删除成功' });
  } catch (error) {
    await conn.rollback();
    console.error('删除活动失败:', error);
    res.status(500).json({ error: '活动删除失败: ' + (error.message || '未知错误') });
  } finally {
    conn.release();
  }
});

router.get('/status', async (req, res) => {
  try {
    await db.execute(
      "UPDATE lottery_activities SET status = 'ended' WHERE status = 'active' AND end_time < NOW()"
    );

    const [activeActivities] = await db.query(
      'SELECT * FROM lottery_activities WHERE status = ? AND start_time <= NOW() AND end_time >= NOW() ORDER BY created_at DESC LIMIT 1',
      ['active']
    );

    if (activeActivities.length > 0) {
      const activity = activeActivities[0];
      const [prizes] = await db.query('SELECT * FROM lottery_prizes WHERE activity_id = ? ORDER BY is_thank_you, position, id', [activity.id]);

      res.json({
        success: true,
        status: 'active',
        activity: activity,
        prizes: calculateEffectiveProbabilities(prizes, activity.win_rate)
      });
    } else {
      const [pendingActivities] = await db.query(
        'SELECT * FROM lottery_activities WHERE status = ? AND start_time > NOW() ORDER BY start_time ASC LIMIT 1',
        ['active']
      );

      if (pendingActivities.length > 0) {
        const activity = pendingActivities[0];
        const [prizes] = await db.query('SELECT * FROM lottery_prizes WHERE activity_id = ? ORDER BY is_thank_you, position, id', [activity.id]);

        res.json({
          success: true,
          status: 'pending',
          activity: activity,
          prizes: calculateEffectiveProbabilities(prizes, activity.win_rate),
          message: `活动将于 ${new Date(activity.start_time).toLocaleString('zh-CN')} 开始`
        });
      } else {
        const [endedActivities] = await db.query(
          'SELECT id FROM lottery_activities WHERE status = ? ORDER BY created_at DESC LIMIT 1',
          ['ended']
        );
        if (endedActivities.length > 0) {
          res.json({
            success: true,
            status: 'expired',
            message: '抽奖活动已结束'
          });
        } else {
          res.json({
            success: true,
            status: 'inactive',
            message: '当前没有活跃的抽奖活动'
          });
        }
      }
    }
  } catch (error) {
    console.error('获取抽奖活动状态失败:', error);
    res.status(500).json({
      success: false,
      error: '获取抽奖活动状态失败'
    });
  }
});

router.get('/prizes', async (req, res) => {
  try {
    const { activity_id } = req.query;

    let targetActivityId = activity_id;
    if (!targetActivityId) {
      const [activities] = await db.query(
        'SELECT * FROM lottery_activities WHERE status = ? AND start_time <= NOW() AND end_time >= NOW() ORDER BY created_at DESC LIMIT 1',
        ['active']
      );
      if (activities.length > 0) {
        targetActivityId = activities[0].id;
      }
    }

    if (targetActivityId) {
      const [prizes] = await db.query('SELECT * FROM lottery_prizes WHERE activity_id = ? ORDER BY is_thank_you, position, id', [targetActivityId]);
      const [activity] = await db.query('SELECT win_rate FROM lottery_activities WHERE id = ?', [targetActivityId]);
      const winRate = activity.length > 0 ? activity[0].win_rate : 30;
      res.json({ success: true, data: calculateEffectiveProbabilities(prizes, winRate) });
    } else {
      res.json({ success: true, data: [] });
    }
  } catch (error) {
    console.error('获取奖品列表失败:', error);
    res.status(500).json({ success: false, error: '获取奖品列表失败' });
  }
});

router.post('/draw', authenticate, async (req, res) => {
  const conn = await db.getConnection();
  try {
    const { activity_id } = req.body;
    const user_id = getUserId(req);

    if (!activity_id || !user_id) {
      return res.status(400).json({ error: '缺少必要参数 activity_id' });
    }

    await conn.beginTransaction();

    const [user] = await conn.query('SELECT id FROM users WHERE id = ? FOR UPDATE', [user_id]);
    if (user.length === 0) {
      await conn.rollback();
      return res.status(404).json({ error: '用户不存在' });
    }

    const [activity] = await conn.query(
      'SELECT * FROM lottery_activities WHERE id = ? AND status = ? AND start_time <= NOW() AND end_time >= NOW() FOR UPDATE',
      [activity_id, 'active']
    );
    if (activity.length === 0) {
      await conn.rollback();
      return res.status(400).json({ error: '活动不存在或已结束' });
    }

    const [dailyRecord] = await conn.query(
      'SELECT * FROM user_daily_lottery WHERE user_id = ? AND activity_id = ? AND date = CURDATE() FOR UPDATE',
      [user_id, activity_id]
    );

    const dailyUsed = dailyRecord.length > 0 ? Math.max(0, dailyRecord[0].draw_count) : 0;
    const dailyBonus = dailyRecord.length > 0 ? Math.max(0, dailyRecord[0].bonus_count || 0) : 0;
    const persistedInviteBonus = dailyRecord.length > 0 ? Math.max(0, dailyRecord[0].invite_bonus || 0) : 0;

    const [inviteRecords] = await conn.query(
      'SELECT COUNT(*) as count FROM user_invitations WHERE inviter_id = ? AND (activity_id = ? OR activity_id IS NULL) AND DATE(created_at) = CURDATE()',
      [user_id, activity_id]
    );
    const actualInviteCount = Math.min(inviteRecords[0].count, 2);
    const inviteBonus = Math.max(persistedInviteBonus, actualInviteCount);

    if (inviteBonus > persistedInviteBonus) {
      if (dailyRecord.length > 0) {
        await conn.execute(
          'UPDATE user_daily_lottery SET invite_bonus = ? WHERE id = ?',
          [inviteBonus, dailyRecord[0].id]
        );
      }
    }

    const effectiveDailyLimit = activity[0].daily_limit + inviteBonus + dailyBonus;

    if (dailyUsed >= effectiveDailyLimit) {
      await conn.rollback();
      return res.status(400).json({ error: '今日抽奖次数已用完' });
    }

    const [totalRecords] = await conn.query(
      'SELECT COUNT(*) as count FROM lottery_records WHERE user_id = ? AND activity_id = ?',
      [user_id, activity_id]
    );

    if (totalRecords[0].count >= activity[0].total_limit) {
      await conn.rollback();
      return res.status(400).json({ error: '活动期间抽奖次数已用完' });
    }

    const [allPrizes] = await conn.query(
      'SELECT * FROM lottery_prizes WHERE activity_id = ? FOR UPDATE',
      [activity_id]
    );

    if (allPrizes.length === 0) {
      await conn.rollback();
      return res.status(400).json({ error: '活动暂无奖品配置' });
    }

    const thankYouPrizes = allPrizes.filter(p => isThankYou(p.is_thank_you));
    const normalPrizes = allPrizes.filter(p => !isThankYou(p.is_thank_you) && p.quantity > 0);

    if (normalPrizes.length === 0 && thankYouPrizes.length === 0) {
      await conn.rollback();
      return res.status(400).json({ error: '活动暂无可用奖品' });
    }

    let winningPrize = null;

    if (normalPrizes.length > 0) {
      let prizesWithProbability = calculateEffectiveProbabilities(allPrizes, activity[0].win_rate)
        .filter(p => !isThankYou(p.is_thank_you) && p.quantity > 0);

      while (prizesWithProbability.length > 0) {
        const totalOrigQty = prizesWithProbability.reduce((s, p) => {
          const orig = Number(p.original_quantity) > 0 ? Number(p.original_quantity) : Number(p.quantity);
          return s + orig;
        }, 0);
        if (totalOrigQty <= 0) break;

        prizesWithProbability = prizesWithProbability.map(p => {
          const orig = Number(p.original_quantity) > 0 ? Number(p.original_quantity) : Number(p.quantity);
          return {
            ...p,
            effective_probability: (orig / totalOrigQty) * Number(activity[0].win_rate)
          };
        });

        const totalProb = prizesWithProbability.reduce((s, p) => s + p.effective_probability, 0);
        if (totalProb <= 0) break;

        const random = Math.random() * totalProb;
        let cumulativeWeight = 0;
        let selectedPrize = null;

        for (const prize of prizesWithProbability) {
          cumulativeWeight += prize.effective_probability;
          if (random < cumulativeWeight) {
            selectedPrize = prize;
            break;
          }
        }

        if (!selectedPrize) break;

        const [updateResult] = await conn.execute(
          'UPDATE lottery_prizes SET quantity = quantity - 1 WHERE id = ? AND quantity > 0',
          [selectedPrize.id]
        );
        if (updateResult.affectedRows > 0) {
          winningPrize = { ...selectedPrize, quantity: selectedPrize.quantity - 1 };
          break;
        }

        const idx = prizesWithProbability.findIndex(p => p.id === selectedPrize.id);
        if (idx >= 0) {
          prizesWithProbability.splice(idx, 1);
        } else {
          break;
        }
      }
    }

    const isWinner = winningPrize !== null;
    let resultPrize = isWinner ? winningPrize : null;

    if (!isWinner && thankYouPrizes.length > 0) {
      resultPrize = thankYouPrizes[Math.floor(Math.random() * thankYouPrizes.length)];
    }

    if (!resultPrize) {
      await conn.rollback();
      return res.status(400).json({ error: '活动配置异常，缺少谢谢参与奖品，请联系管理员' });
    }

    const [recordResult] = await conn.execute(
      'INSERT INTO lottery_records (activity_id, user_id, prize_id, is_winner) VALUES (?, ?, ?, ?)',
      [activity_id, user_id, resultPrize ? resultPrize.id : null, isWinner ? 1 : 0]
    );
    const recordId = recordResult.insertId;

    if (dailyRecord.length > 0) {
      await conn.execute(
        'UPDATE user_daily_lottery SET draw_count = GREATEST(draw_count + 1, 1) WHERE id = ?',
        [dailyRecord[0].id]
      );
    } else {
      await conn.execute(
        'INSERT INTO user_daily_lottery (user_id, activity_id, date, draw_count, bonus_count, invite_bonus) VALUES (?, ?, CURDATE(), 1, 0, ?) ON DUPLICATE KEY UPDATE draw_count = GREATEST(draw_count + 1, 1), invite_bonus = GREATEST(invite_bonus, ?)',
        [user_id, activity_id, inviteBonus, inviteBonus]
      );
    }

    await conn.commit();

    let safePrize = null;
    if (resultPrize) {
      if (isWinner) {
        const updatedQuantity = resultPrize.quantity;
        safePrize = {
          id: resultPrize.id,
          name: resultPrize.name,
          image: resultPrize.image,
          position: resultPrize.position,
          is_thank_you: resultPrize.is_thank_you,
          needs_shipping: resultPrize.needs_shipping,
          effective_probability: resultPrize.effective_probability,
          out_of_stock: updatedQuantity <= 0 ? 1 : 0,
          quantity: updatedQuantity
        };
      } else {
        const allWithProb = calculateEffectiveProbabilities(allPrizes, activity[0].win_rate);
        const thankYouProb = allWithProb.find(p => isThankYou(p.is_thank_you));
        const normalTotalProb = allWithProb
          .filter(p => !isThankYou(p.is_thank_you) && p.effective_probability > 0)
          .reduce((sum, p) => sum + p.effective_probability, 0);
        safePrize = {
          id: resultPrize.id,
          name: resultPrize.name,
          image: resultPrize.image,
          position: resultPrize.position,
          is_thank_you: resultPrize.is_thank_you,
          needs_shipping: 0,
          effective_probability: thankYouProb ? thankYouProb.effective_probability : Math.max(0, 100 - normalTotalProb),
          out_of_stock: 0,
          quantity: resultPrize.quantity || 0
        };
      }
    }
    res.json({
      success: true,
      is_winner: isWinner,
      record_id: recordId,
      prize: safePrize,
      message: isWinner ? '恭喜中奖！' : '谢谢参与，再接再厉！'
    });
  } catch (error) {
    await conn.rollback();
    console.error('抽奖失败:', error);
    res.status(500).json({ error: '抽奖失败，请重试' });
  } finally {
    conn.release();
  }
});

router.get('/records', authenticate, async (req, res) => {
  try {
    const { user_id, activity_id, page = 1, limit = 20 } = req.query;
    const pageNum = Math.max(1, parseInt(page) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit) || 20));
    const offset = (pageNum - 1) * limitNum;

    if (user_id) {
      const currentUserId = getUserId(req);
      let isAdmin = false;
      if (currentUserId) {
        const [adminCheck] = await db.query('SELECT is_admin FROM users WHERE id = ?', [currentUserId]);
        isAdmin = adminCheck.length > 0 && adminCheck[0].is_admin;
      }
      if (!isAdmin && parseInt(user_id) !== parseInt(currentUserId)) {
        return res.status(403).json({ error: '无权查看他人抽奖记录' });
      }
    }

    let query = 'SELECT lr.*, lp.name as prize_name, lp.image as prize_image, lp.needs_shipping FROM lottery_records lr LEFT JOIN lottery_prizes lp ON lr.prize_id = lp.id WHERE 1=1';
    let countQuery = 'SELECT COUNT(*) as total FROM lottery_records lr WHERE 1=1';
    const params = [];
    const countParams = [];

    if (user_id) {
      query += ' AND lr.user_id = ?';
      countQuery += ' AND lr.user_id = ?';
      params.push(user_id);
      countParams.push(user_id);
    }

    if (activity_id) {
      query += ' AND lr.activity_id = ?';
      countQuery += ' AND lr.activity_id = ?';
      params.push(activity_id);
      countParams.push(activity_id);
    }

    query += ' ORDER BY lr.draw_time DESC LIMIT ? OFFSET ?';
    params.push(limitNum, offset);

    const [records] = await db.query(query, params);
    const [countResult] = await db.query(countQuery, countParams);

    const recordIds = records.filter(r => Number(r.is_winner)).map(r => r.id);
    let shippedRecordIds = [];
    let shippingMap = {};
    if (recordIds.length > 0) {
      const [shippingAddresses] = await db.query(
        'SELECT record_id, shipping_status, tracking_number, courier_company FROM lottery_shipping_addresses WHERE record_id IN (?)',
        [recordIds]
      );
      shippedRecordIds = shippingAddresses.map(r => r.record_id);
      shippingAddresses.forEach(r => {
        shippingMap[r.record_id] = {
          shipping_status: r.shipping_status,
          tracking_number: r.tracking_number,
          courier_company: r.courier_company
        };
      });
    }

    const normalizedRecords = records.map(r => {
      const shipping = shippingMap[r.id] || {};
      return {
        ...r,
        is_winner: Number(r.is_winner) || 0,
        needs_shipping: Number(r.is_winner) ? (Number(r.needs_shipping) || 0) : 0,
        has_address: Number(r.is_winner) ? shippedRecordIds.includes(r.id) : false,
        shipping_status: Number(r.is_winner) ? (shipping.shipping_status || null) : null,
        tracking_number: Number(r.is_winner) ? (shipping.tracking_number || null) : null,
        courier_company: Number(r.is_winner) ? (shipping.courier_company || null) : null
      };
    });

    res.json({
      success: true,
      data: normalizedRecords,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total: countResult[0].total,
        total_pages: Math.ceil(countResult[0].total / limitNum)
      }
    });
  } catch (error) {
    console.error('获取抽奖记录失败:', error);
    res.status(500).json({ error: '获取抽奖记录失败' });
  }
});

async function handleAdWatch(req, res) {
  const conn = await db.getConnection();
  try {
    const { user_id, activity_id, ad_id, ad_duration, watch_duration } = req.body;

    if (!user_id || !activity_id || !ad_id || ad_duration === undefined || watch_duration === undefined) {
      return res.status(400).json({ error: '缺少必要参数' });
    }

    if (!req.user || !getUserId(req) || parseInt(user_id) !== parseInt(getUserId(req))) {
      return res.status(403).json({ error: '无权操作' });
    }

    await conn.beginTransaction();

    const clientIP = req.ip || req.connection.remoteAddress;
    const userAgent = req.headers['user-agent'];

    const [user] = await conn.query('SELECT id FROM users WHERE id = ?', [user_id]);
    if (user.length === 0) {
      await conn.rollback();
      return res.status(404).json({ error: '用户不存在' });
    }

    const [activity] = await conn.query('SELECT id, status, start_time, end_time FROM lottery_activities WHERE id = ?', [activity_id]);
    if (activity.length === 0) {
      await conn.rollback();
      return res.status(404).json({ error: '活动不存在' });
    }

    const act = activity[0];
    const isActActive = act.status === 'active' && new Date(act.start_time) <= new Date() && new Date(act.end_time) >= new Date();
    if (!isActActive) {
      await conn.rollback();
      return res.status(400).json({ error: '活动未开始或已结束，无法观看广告获取奖励' });
    }

    if (ad_duration < 30) {
      await conn.rollback();
      return res.status(400).json({ error: '广告时长必须至少为30秒' });
    }

    const MIN_WATCH_RATIO = 0.95;
    if (watch_duration < ad_duration * MIN_WATCH_RATIO) {
      await conn.execute(
        'INSERT INTO ad_watch_records (user_id, activity_id, ad_id, ad_duration, watch_duration, status, ip_address, user_agent) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
        [user_id, activity_id, ad_id, ad_duration, watch_duration, 'incomplete', clientIP, userAgent]
      );
      await conn.commit();
      return res.status(400).json({ error: '广告观看时长不足' });
    }

    const [recentWatch] = await conn.query(
      'SELECT id FROM ad_watch_records WHERE user_id = ? AND activity_id = ? AND ad_id = ? AND status = ? AND watch_time > DATE_SUB(NOW(), INTERVAL 30 MINUTE)',
      [user_id, activity_id, ad_id, 'completed']
    );
    if (recentWatch.length > 0) {
      await conn.rollback();
      return res.status(400).json({ error: '您最近已经观看过该广告' });
    }

    const [hourlyWatches] = await conn.query(
      "SELECT COUNT(*) as count FROM ad_watch_records WHERE user_id = ? AND status = 'completed' AND watch_time > DATE_SUB(NOW(), INTERVAL 1 HOUR)",
      [user_id]
    );
    if (hourlyWatches[0].count >= 10) {
      await conn.rollback();
      return res.status(400).json({ error: '广告观看过于频繁，请稍后再试' });
    }

    const [ipWatches] = await conn.query(
      "SELECT COUNT(*) as count FROM ad_watch_records WHERE ip_address = ? AND status = 'completed' AND watch_time > DATE_SUB(NOW(), INTERVAL 1 HOUR)",
      [clientIP]
    );
    if (ipWatches[0].count >= 20) {
      await conn.rollback();
      return res.status(400).json({ error: '该IP广告观看过于频繁，请稍后再试' });
    }

    const [dailyRecord] = await conn.query(
      'SELECT * FROM user_daily_lottery WHERE user_id = ? AND activity_id = ? AND date = CURDATE() FOR UPDATE',
      [user_id, activity_id]
    );

    const [todayAdWatches] = await conn.query(
      "SELECT COUNT(*) as count FROM ad_watch_records WHERE user_id = ? AND activity_id = ? AND status = 'completed' AND DATE(watch_time) = CURDATE()",
      [user_id, activity_id]
    );
    if (todayAdWatches[0].count >= 5) {
      await conn.rollback();
      return res.status(400).json({ error: '今日广告奖励次数已达上限' });
    }

    await conn.execute(
      'INSERT INTO ad_watch_records (user_id, activity_id, ad_id, ad_duration, watch_duration, status, ip_address, user_agent) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [user_id, activity_id, ad_id, ad_duration, watch_duration, 'completed', clientIP, userAgent]
    );

    if (dailyRecord.length > 0) {
      await conn.execute(
        'UPDATE user_daily_lottery SET bonus_count = bonus_count + 1 WHERE id = ?',
        [dailyRecord[0].id]
      );
    } else {
      await conn.execute(
        'INSERT INTO user_daily_lottery (user_id, activity_id, date, draw_count, bonus_count, invite_bonus) VALUES (?, ?, CURDATE(), 0, 1, 0) ON DUPLICATE KEY UPDATE bonus_count = bonus_count + 1',
        [user_id, activity_id]
      );
    }

    await conn.commit();
    res.json({
      success: true,
      message: '广告观看完成，获得额外抽奖次数',
      status: 'completed'
    });
  } catch (error) {
    await conn.rollback();
    console.error('记录广告观看失败:', error);
    res.status(500).json({ error: '记录广告观看失败' });
  } finally {
    conn.release();
  }
}

router.post('/ad-watch', authenticate, handleAdWatch);
router.post('/watch-ad', authenticate, handleAdWatch);

router.get('/ad-watch-records', authenticate, requireAdmin, async (req, res) => {
  try {
    const { user_id, activity_id, page = 1, limit = 20 } = req.query;
    const pageNum = Math.max(1, parseInt(page) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit) || 20));
    const offset = (pageNum - 1) * limitNum;

    let query = 'SELECT * FROM ad_watch_records WHERE 1=1';
    let countQuery = 'SELECT COUNT(*) as total FROM ad_watch_records WHERE 1=1';
    const params = [];
    const countParams = [];

    if (user_id) {
      query += ' AND user_id = ?';
      countQuery += ' AND user_id = ?';
      params.push(user_id);
      countParams.push(user_id);
    }

    if (activity_id) {
      query += ' AND activity_id = ?';
      countQuery += ' AND activity_id = ?';
      params.push(activity_id);
      countParams.push(activity_id);
    }

    query += ' ORDER BY watch_time DESC LIMIT ? OFFSET ?';
    params.push(limitNum, offset);

    const [records] = await db.query(query, params);
    const [countResult] = await db.query(countQuery, countParams);

    res.json({
      success: true,
      data: records,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total: countResult[0].total,
        total_pages: Math.ceil(countResult[0].total / limitNum)
      }
    });
  } catch (error) {
    console.error('获取广告观看记录失败:', error);
    res.status(500).json({ error: '获取广告观看记录失败' });
  }
});

router.get('/stats/:activity_id', authenticate, requireAdmin, async (req, res) => {
  try {
    const { activity_id } = req.params;

    const [activityInfo] = await db.query('SELECT win_rate FROM lottery_activities WHERE id = ?', [activity_id]);
    const configuredWinRate = activityInfo.length > 0 ? Number(activityInfo[0].win_rate) : 30;

    const [participants] = await db.query(
      'SELECT COUNT(DISTINCT user_id) as count FROM lottery_records WHERE activity_id = ?',
      [activity_id]
    );

    const [totalDraws] = await db.query(
      'SELECT COUNT(*) as count FROM lottery_records WHERE activity_id = ?',
      [activity_id]
    );

    const [winningDraws] = await db.query(
      'SELECT COUNT(*) as count FROM lottery_records WHERE activity_id = ? AND is_winner = 1',
      [activity_id]
    );

    const [adWatchCount] = await db.query(
      "SELECT COUNT(*) as count FROM ad_watch_records WHERE activity_id = ? AND status = 'completed'",
      [activity_id]
    );

    const [inviteCount] = await db.query(
      'SELECT COUNT(*) as count FROM user_invitations WHERE activity_id = ?',
      [activity_id]
    );

    const [shippedCount] = await db.query(
      'SELECT COUNT(*) as count FROM lottery_records lr JOIN lottery_shipping_addresses lsa ON lr.id = lsa.record_id WHERE lr.activity_id = ? AND lr.is_winner = 1',
      [activity_id]
    );

    const [needShippingCount] = await db.query(
      'SELECT COUNT(*) as count FROM lottery_records lr JOIN lottery_prizes lp ON lr.prize_id = lp.id WHERE lr.activity_id = ? AND lr.is_winner = 1 AND lp.needs_shipping = 1',
      [activity_id]
    );

    const [prizes] = await db.query(
      'SELECT lp.id, lp.name, lp.original_quantity, lp.quantity, lp.is_thank_you, lp.needs_shipping, (SELECT COUNT(*) FROM lottery_records lr WHERE lr.prize_id = lp.id AND lr.is_winner = 1) as awarded_count FROM lottery_prizes lp WHERE lp.activity_id = ?',
      [activity_id]
    );

    const actualWinRate = totalDraws[0].count > 0 ? (winningDraws[0].count / totalDraws[0].count * 100) : 0;

    res.json({
      participants: participants[0].count,
      total_draws: totalDraws[0].count,
      winning_draws: winningDraws[0].count,
      ad_watch_count: adWatchCount[0].count,
      invite_count: inviteCount[0].count,
      configured_win_rate: configuredWinRate,
      actual_win_rate: Math.round(actualWinRate * 100) / 100,
      shipping_progress: {
        shipped: shippedCount[0].count,
        total_need_shipping: needShippingCount[0].count
      },
      prizes
    });
  } catch (error) {
    console.error('获取活动统计失败:', error);
    res.status(500).json({ error: '获取活动统计失败', details: error.message });
  }
});

router.post('/shipping-address', authenticate, async (req, res) => {
  const conn = await db.getConnection();
  try {
    const { record_id, user_id, name, phone, province, city, district, detail_address } = req.body;

    if (!record_id || !user_id || !name || !phone || !province || !city || !district || !detail_address) {
      return res.status(400).json({ error: '缺少必要参数' });
    }

    if (!/^1[3-9]\d{9}$/.test(String(phone))) {
      return res.status(400).json({ error: '手机号格式不正确' });
    }

    if (String(name).length > 50) {
      return res.status(400).json({ error: '收货人姓名不能超过50个字符' });
    }
    if (String(detail_address).length > 500) {
      return res.status(400).json({ error: '详细地址不能超过500个字符' });
    }
    if (String(province).length > 50 || String(city).length > 50 || String(district).length > 50) {
      return res.status(400).json({ error: '地区信息不能超过50个字符' });
    }

    if (!req.user || !getUserId(req) || parseInt(user_id) !== parseInt(getUserId(req))) {
      return res.status(403).json({ error: '无权操作，只能为自己填写收货地址' });
    }

    await conn.beginTransaction();

    const [record] = await conn.query(
      'SELECT * FROM lottery_records WHERE id = ? AND user_id = ? AND is_winner = 1',
      [record_id, user_id]
    );
    if (record.length === 0) {
      await conn.rollback();
      return res.status(400).json({ error: '中奖记录不存在或不属于该用户' });
    }

    const [prizeInfo] = await conn.query(
      'SELECT needs_shipping FROM lottery_prizes WHERE id = ?',
      [record[0].prize_id]
    );
    if (prizeInfo.length > 0 && !prizeInfo[0].needs_shipping) {
      await conn.rollback();
      return res.status(400).json({ error: '该奖品为虚拟奖品，无需填写收货地址' });
    }

    const [existing] = await conn.query(
      'SELECT * FROM lottery_shipping_addresses WHERE record_id = ?',
      [record_id]
    );
    if (existing.length > 0) {
      await conn.rollback();
      return res.status(400).json({ error: '该中奖记录已填写收货地址' });
    }

    await conn.execute(
      'INSERT INTO lottery_shipping_addresses (record_id, user_id, prize_id, name, phone, province, city, district, detail_address) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [record_id, user_id, record[0].prize_id, name, phone, province, city, district, detail_address]
    );

    await conn.commit();
    res.json({ success: true, message: '收货地址提交成功' });
  } catch (error) {
    await conn.rollback();
    console.error('提交收货地址失败:', error);
    res.status(500).json({ error: '提交收货地址失败' });
  } finally {
    conn.release();
  }
});

router.get('/shipping-address', authenticate, async (req, res) => {
  try {
    const { user_id, record_id, activity_id } = req.query;

    const userId = getUserId(req);
    let isAdmin = false;
    if (userId) {
      const [adminCheck] = await db.query('SELECT is_admin FROM users WHERE id = ?', [userId]);
      isAdmin = adminCheck.length > 0 && adminCheck[0].is_admin;
    }

    if (!user_id && !record_id && !activity_id) {
      if (!isAdmin) {
        return res.status(400).json({ error: '缺少 user_id、record_id 或 activity_id 参数' });
      }
    }

    if (!isAdmin) {
      if (activity_id && !user_id) {
        return res.status(403).json({ error: '普通用户不能按活动查询所有地址' });
      }
      if (user_id && (!req.user || !getUserId(req) || parseInt(user_id) !== parseInt(getUserId(req)))) {
        return res.status(403).json({ error: '无权查看他人收货地址' });
      }
    }

    let query = 'SELECT sa.*, lr.prize_id, lr.activity_id, lp.name as prize_name, la.name as activity_name, u.nick_name, u.username, u.phone as user_phone FROM lottery_shipping_addresses sa LEFT JOIN lottery_records lr ON sa.record_id = lr.id LEFT JOIN lottery_prizes lp ON sa.prize_id = lp.id LEFT JOIN lottery_activities la ON lr.activity_id = la.id LEFT JOIN users u ON sa.user_id = u.id WHERE 1=1';
    const params = [];

    if (user_id) {
      query += ' AND sa.user_id = ?';
      params.push(user_id);
    }
    if (record_id) {
      query += ' AND sa.record_id = ?';
      params.push(record_id);
    }
    if (activity_id) {
      query += ' AND lr.activity_id = ?';
      params.push(activity_id);
    }

    query += ' ORDER BY sa.created_at DESC';

    const [addresses] = await db.query(query, params);
    res.json({ success: true, data: addresses });
  } catch (error) {
    console.error('获取收货地址失败:', error);
    res.status(500).json({ error: '获取收货地址失败' });
  }
});

router.put('/shipping-address/:id/status', authenticate, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { shipping_status, tracking_number, courier_company } = req.body;

    if (!shipping_status) {
      return res.status(400).json({ error: '缺少发货状态' });
    }

    const validStatuses = ['pending', 'shipped', 'delivered'];
    if (!validStatuses.includes(shipping_status)) {
      return res.status(400).json({ error: '无效的发货状态' });
    }

    const validCouriers = ['顺丰速运', '中通快递', '圆通速递', '韵达快递', '申通快递', '百世快递', '极兔速递', '邮政EMS', '京东物流', '德邦快递', '天天快递', '宅急送', '其他'];
    if (courier_company && !validCouriers.includes(courier_company)) {
      return res.status(400).json({ error: '无效的快递公司' });
    }

    const statusFlow = { pending: 'shipped', shipped: 'delivered' };

    const [existing] = await db.query('SELECT * FROM lottery_shipping_addresses WHERE id = ?', [id]);
    if (existing.length === 0) {
      return res.status(404).json({ error: '收货地址记录不存在' });
    }

    const currentStatus = existing[0].shipping_status;
    if (currentStatus === 'delivered') {
      return res.status(400).json({ error: '订单已签收，不可修改状态' });
    }
    if (statusFlow[currentStatus] && shipping_status !== statusFlow[currentStatus]) {
      return res.status(400).json({ error: `状态只能从 '${currentStatus}' 变更为 '${statusFlow[currentStatus]}'` });
    }

    if (shipping_status === 'shipped' && !tracking_number) {
      return res.status(400).json({ error: '发货时必须填写快递单号' });
    }

    await db.execute(
      'UPDATE lottery_shipping_addresses SET shipping_status = ?, tracking_number = ?, courier_company = ? WHERE id = ?',
      [shipping_status, tracking_number || existing[0].tracking_number, courier_company || existing[0].courier_company, id]
    );

    res.json({ success: true, message: '更新成功' });
  } catch (error) {
    console.error('更新发货状态失败:', error);
    res.status(500).json({ error: '更新发货状态失败' });
  }
});

router.get('/user-draw-info', authenticate, async (req, res) => {
  try {
    const { user_id, activity_id } = req.query;

    if (!user_id || !activity_id) {
      return res.status(400).json({ error: '缺少必要参数' });
    }

    const currentUserId = getUserId(req);
    if (!currentUserId || parseInt(user_id) !== parseInt(currentUserId)) {
      return res.status(403).json({ error: '无权查看他人抽奖信息' });
    }

    const [dailyRecord] = await db.query(
      'SELECT * FROM user_daily_lottery WHERE user_id = ? AND activity_id = ? AND date = CURDATE()',
      [user_id, activity_id]
    );

    const dailyUsed = dailyRecord.length > 0 ? Math.max(0, dailyRecord[0].draw_count) : 0;
    const dailyBonus = dailyRecord.length > 0 ? Math.max(0, dailyRecord[0].bonus_count || 0) : 0;
    const persistedInviteBonus = dailyRecord.length > 0 ? Math.max(0, dailyRecord[0].invite_bonus || 0) : 0;

    const [activity] = await db.query('SELECT daily_limit, total_limit FROM lottery_activities WHERE id = ?', [activity_id]);
    const dailyLimit = activity.length > 0 ? activity[0].daily_limit : 0;
    const totalLimit = activity.length > 0 ? activity[0].total_limit : 0;

    const [inviteRecords] = await db.query(
      'SELECT COUNT(*) as count FROM user_invitations WHERE inviter_id = ? AND (activity_id = ? OR activity_id IS NULL) AND DATE(created_at) = CURDATE()',
      [user_id, activity_id]
    );
    const inviteBonus = Math.max(persistedInviteBonus, Math.min(inviteRecords[0].count, 2));

    const effectiveDailyLimit = dailyLimit + inviteBonus + dailyBonus;

    const [totalRecords] = await db.query(
      'SELECT COUNT(*) as count FROM lottery_records WHERE user_id = ? AND activity_id = ?',
      [user_id, activity_id]
    );
    const totalUsed = totalRecords[0].count;

    const [winRecords] = await db.query(
      'SELECT lr.*, lp.name as prize_name, lp.image as prize_image, lp.needs_shipping FROM lottery_records lr LEFT JOIN lottery_prizes lp ON lr.prize_id = lp.id WHERE lr.user_id = ? AND lr.activity_id = ? AND lr.is_winner = 1 ORDER BY lr.draw_time DESC',
      [user_id, activity_id]
    );

    const [allRecords] = await db.query(
      'SELECT lr.*, lp.name as prize_name, lp.image as prize_image, lp.needs_shipping FROM lottery_records lr LEFT JOIN lottery_prizes lp ON lr.prize_id = lp.id WHERE lr.user_id = ? AND lr.activity_id = ? ORDER BY lr.draw_time DESC LIMIT 50',
      [user_id, activity_id]
    );

    const [shippingAddresses] = await db.query(
      'SELECT record_id, shipping_status, tracking_number, courier_company FROM lottery_shipping_addresses WHERE user_id = ?',
      [user_id]
    );
    const shippedRecordIds = shippingAddresses.map(r => r.record_id);
    const shippingMap = {};
    shippingAddresses.forEach(r => {
      shippingMap[r.record_id] = {
        shipping_status: r.shipping_status,
        tracking_number: r.tracking_number,
        courier_company: r.courier_company
      };
    });

    const winRecordsWithAddress = winRecords.map(r => {
      const shipping = shippingMap[r.id] || {};
      return {
        ...r,
        is_winner: Number(r.is_winner) || 0,
        needs_shipping: Number(r.is_winner) ? (Number(r.needs_shipping) || 0) : 0,
        has_address: shippedRecordIds.includes(r.id),
        shipping_status: shipping.shipping_status || null,
        tracking_number: shipping.tracking_number || null,
        courier_company: shipping.courier_company || null
      };
    });

    const allRecordsWithDetail = allRecords.map(r => {
      const shipping = shippingMap[r.id] || {};
      return {
        ...r,
        is_winner: Number(r.is_winner) || 0,
        needs_shipping: Number(r.is_winner) ? (Number(r.needs_shipping) || 0) : 0,
        has_address: Number(r.is_winner) ? shippedRecordIds.includes(r.id) : false,
        shipping_status: Number(r.is_winner) ? (shipping.shipping_status || null) : null,
        tracking_number: Number(r.is_winner) ? (shipping.tracking_number || null) : null,
        courier_company: Number(r.is_winner) ? (shipping.courier_company || null) : null
      };
    });

    res.json({
      success: true,
      data: {
        daily_used: dailyUsed,
        daily_bonus: dailyBonus,
        daily_limit: dailyLimit,
        invite_bonus_today: inviteBonus,
        effective_daily_limit: effectiveDailyLimit,
        daily_remaining: Math.max(0, effectiveDailyLimit - dailyUsed),
        total_used: totalUsed,
        total_limit: totalLimit,
        total_remaining: Math.max(0, totalLimit - totalUsed),
        win_records: winRecordsWithAddress,
        all_records: allRecordsWithDetail
      }
    });
  } catch (error) {
    console.error('获取用户抽奖信息失败:', error);
    res.status(500).json({ error: '获取用户抽奖信息失败' });
  }
});

router.get('/invite-info', authenticate, async (req, res) => {
  try {
    const { user_id, activity_id } = req.query;

    if (!user_id) {
      return res.status(400).json({ error: '缺少必要参数' });
    }

    const currentUserId = getUserId(req);
    if (!currentUserId || parseInt(user_id) !== parseInt(currentUserId)) {
      return res.status(403).json({ error: '无权查看他人邀请信息' });
    }

    const inviteCode = await getUserInviteCode(parseInt(user_id));

    let inviteQuery = 'SELECT ui.*, u.username, u.nick_name FROM user_invitations ui LEFT JOIN users u ON ui.invitee_id = u.id WHERE ui.inviter_id = ?';
    const inviteParams = [user_id];

    let todayQuery = 'SELECT COUNT(*) as count FROM user_invitations WHERE inviter_id = ? AND DATE(created_at) = CURDATE()';
    const todayParams = [user_id];

    if (activity_id) {
      inviteQuery += ' AND ui.activity_id = ?';
      inviteParams.push(activity_id);
      todayQuery += ' AND activity_id = ?';
      todayParams.push(activity_id);
    }

    inviteQuery += ' ORDER BY ui.created_at DESC';

    const [inviteRecords] = await db.query(inviteQuery, inviteParams);

    const [todayInvites] = await db.query(todayQuery, todayParams);

    const [dailyRecord] = await db.query(
      'SELECT invite_bonus FROM user_daily_lottery WHERE user_id = ? AND date = CURDATE()',
      [user_id]
    );
    const persistedInviteBonus = dailyRecord.length > 0 ? (dailyRecord[0].invite_bonus || 0) : 0;
    const inviteBonusToday = Math.max(persistedInviteBonus, Math.min(todayInvites[0].count, 2));

    res.json({
      success: true,
      data: {
        invite_code: inviteCode || user_id.toString(),
        total_invites: inviteRecords.length,
        today_invites: todayInvites[0].count,
        invite_bonus_today: inviteBonusToday,
        invite_records: inviteRecords
      }
    });
  } catch (error) {
    console.error('获取邀请信息失败:', error);
    res.status(500).json({ error: '获取邀请信息失败' });
  }
});

router.post('/record-invite', authenticate, async (req, res) => {
  const conn = await db.getConnection();
  try {
    let { inviter_id, invitee_id, activity_id, invite_code } = req.body;

    if (!invite_code && !inviter_id) {
      return res.status(400).json({ error: '缺少必要参数' });
    }

    if (invite_code && !inviter_id) {
      inviter_id = await findUserByInviteCode(invite_code);
      if (!inviter_id) {
        return res.status(400).json({ error: '邀请码无效' });
      }
    }

    if (!invitee_id) {
      return res.status(400).json({ error: '缺少被邀请人ID' });
    }

    if (!inviter_id) {
      return res.status(400).json({ error: '缺少邀请人ID或邀请码' });
    }

    if (parseInt(inviter_id) === parseInt(invitee_id)) {
      return res.status(400).json({ error: '不能邀请自己' });
    }

    if (!req.user || !getUserId(req) || parseInt(invitee_id) !== parseInt(getUserId(req))) {
      return res.status(403).json({ error: '无权操作' });
    }

    await conn.beginTransaction();

    const [inviterUser] = await conn.query('SELECT id FROM users WHERE id = ? FOR UPDATE', [inviter_id]);
    if (inviterUser.length === 0) {
      await conn.rollback();
      return res.status(400).json({ error: '邀请人不存在' });
    }

    const [inviteeUser] = await conn.query('SELECT id FROM users WHERE id = ? FOR UPDATE', [invitee_id]);
    if (inviteeUser.length === 0) {
      await conn.rollback();
      return res.status(400).json({ error: '被邀请人不存在' });
    }

    const [existing] = await conn.query(
      'SELECT id FROM user_invitations WHERE invitee_id = ? FOR UPDATE',
      [invitee_id]
    );
    if (existing.length > 0) {
      await conn.commit();
      return res.json({
        success: true,
        message: '该用户已被邀请过',
        bonus_granted: false
      });
    }

    if (!activity_id) {
      const [activeActivity] = await conn.query(
        'SELECT id FROM lottery_activities WHERE status = ? AND start_time <= NOW() AND end_time >= NOW() ORDER BY created_at DESC LIMIT 1',
        ['active']
      );
      activity_id = activeActivity.length > 0 ? activeActivity[0].id : null;
    } else {
      const [actCheck] = await conn.query(
        'SELECT id FROM lottery_activities WHERE id = ? AND status = ? AND start_time <= NOW() AND end_time >= NOW()',
        [activity_id, 'active']
      );
      if (actCheck.length === 0) {
        await conn.rollback();
        return res.status(400).json({ error: '指定活动不存在或未在活跃状态，无法记录邀请' });
      }
    }

    if (!activity_id) {
      await conn.rollback();
      return res.status(400).json({ error: '当前没有活跃的抽奖活动，无法记录邀请' });
    }

    await conn.execute(
      'INSERT INTO user_invitations (inviter_id, invitee_id, activity_id) VALUES (?, ?, ?)',
      [inviter_id, invitee_id, activity_id]
    );

    const [todayInvitesAfter] = await conn.query(
      'SELECT COUNT(*) as count FROM user_invitations WHERE inviter_id = ? AND (activity_id = ? OR activity_id IS NULL) AND DATE(created_at) = CURDATE()',
      [inviter_id, activity_id]
    );

    const bonusGranted = todayInvitesAfter[0].count <= 2;

    if (bonusGranted) {
      const [dailyRecord] = await conn.query(
        'SELECT id FROM user_daily_lottery WHERE user_id = ? AND activity_id = ? AND date = CURDATE()',
        [inviter_id, activity_id]
      );
      const newBonus = Math.min(todayInvitesAfter[0].count, 2);
      if (dailyRecord.length > 0) {
        await conn.execute(
          'UPDATE user_daily_lottery SET invite_bonus = ? WHERE id = ?',
          [newBonus, dailyRecord[0].id]
        );
      } else {
        await conn.execute(
          'INSERT INTO user_daily_lottery (user_id, activity_id, date, draw_count, bonus_count, invite_bonus) VALUES (?, ?, CURDATE(), 0, 0, ?) ON DUPLICATE KEY UPDATE invite_bonus = GREATEST(invite_bonus, ?)',
          [inviter_id, activity_id, newBonus, newBonus]
        );
      }
    }

    await conn.commit();

    res.json({
      success: true,
      message: bonusGranted ? '邀请成功，获得额外抽奖机会' : '邀请成功，今日邀请奖励次数已达上限',
      bonus_granted: bonusGranted
    });
  } catch (error) {
    try { await conn.rollback(); } catch (e) {}
    console.error('记录邀请失败:', error);
    res.status(500).json({ error: '记录邀请失败' });
  } finally {
    conn.release();
  }
});

module.exports = router;
