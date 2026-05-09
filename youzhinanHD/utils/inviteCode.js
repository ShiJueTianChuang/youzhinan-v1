const db = require('../config/db');

function generateInviteCode(userId) {
  const letters = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  const digits = '0123456789';

  let code = '';
  let seed = BigInt(userId);

  for (let i = 0; i < 3; i++) {
    code += letters[Number(seed % BigInt(letters.length))];
    seed = seed / BigInt(letters.length);
  }

  for (let i = 0; i < 5; i++) {
    code += digits[Number(seed % BigInt(digits.length))];
    seed = seed / BigInt(digits.length);
  }

  return code;
}

function decodeInviteCode(code) {
  if (!code || code.length !== 8) return null;

  const letters = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  const digits = '0123456789';

  const letterPart = code.substring(0, 3).toUpperCase();
  const digitPart = code.substring(3, 8);

  let seed1 = 0n;
  let multiplier1 = 1n;
  for (let i = 0; i < 3; i++) {
    const idx = letters.indexOf(letterPart[i]);
    if (idx === -1) return null;
    seed1 += BigInt(idx) * multiplier1;
    multiplier1 *= BigInt(letters.length);
  }

  let seed2 = 0n;
  let multiplier2 = 1n;
  for (let i = 0; i < 5; i++) {
    const idx = digits.indexOf(digitPart[i]);
    if (idx === -1) return null;
    seed2 += BigInt(idx) * multiplier2;
    multiplier2 *= BigInt(digits.length);
  }

  let userId = seed1;
  let temp = seed2;
  for (let i = 0; i < 5; i++) {
    userId += (temp % BigInt(digits.length)) * (BigInt(letters.length) ** BigInt(3 + i));
    temp = temp / BigInt(digits.length);
  }

  return userId > 0n ? Number(userId) : null;
}

async function getUserInviteCode(userId) {
  const [rows] = await db.query('SELECT invite_code FROM users WHERE id = ?', [userId]);

  if (rows.length === 0) return null;

  if (rows[0].invite_code) {
    return rows[0].invite_code;
  }

  const newCode = generateInviteCode(userId);
  await db.query('UPDATE users SET invite_code = ? WHERE id = ?', [newCode, userId]);

  return newCode;
}

async function findUserByInviteCode(code) {
  if (!code) return null;

  const [rows] = await db.query('SELECT id FROM users WHERE invite_code = ?', [code.toUpperCase()]);

  if (rows.length > 0) {
    return rows[0].id;
  }

  const userId = decodeInviteCode(code);
  if (userId) {
    const [userRows] = await db.query('SELECT id FROM users WHERE id = ?', [userId]);
    if (userRows.length > 0) {
      if (!userRows[0].invite_code || userRows[0].invite_code !== code.toUpperCase()) {
        await db.query('UPDATE users SET invite_code = ? WHERE id = ?', [code.toUpperCase(), userId]);
      }
      return userId;
    }
  }

  return null;
}

async function ensureInviteCodeColumn() {
  try {
    const [col] = await db.query(
      "SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'users' AND COLUMN_NAME = 'invite_code'"
    );

    if (col.length === 0) {
      await db.query("ALTER TABLE users ADD COLUMN invite_code VARCHAR(20) DEFAULT NULL AFTER id");
      await db.query("ALTER TABLE users ADD UNIQUE INDEX idx_invite_code (invite_code)");
      console.log('已添加invite_code字段到users表');

      const [users] = await db.query('SELECT id FROM users');
      for (const user of users) {
        const code = generateInviteCode(user.id);
        await db.query('UPDATE users SET invite_code = ? WHERE id = ?', [code, user.id]);
      }
      console.log(`已为${users.length}个用户生成邀请码`);
    }
  } catch (error) {
    console.error('确保invite_code字段存在时出错:', error);
  }
}

module.exports = {
  generateInviteCode,
  decodeInviteCode,
  getUserInviteCode,
  findUserByInviteCode,
  ensureInviteCodeColumn
};
