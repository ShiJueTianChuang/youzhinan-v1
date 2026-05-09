const db = require('../config/db');

const VERIFICATION_CODE_EXPIRY = 10 * 60 * 1000;
const RESEND_COOLDOWN = 60 * 1000;
const MAX_ATTEMPTS = 5;
const LOCKOUT_DURATION = 30 * 60 * 1000;

class VerificationCode {
  static async create(email, type) {
    const code = this.generateCode();
    const now = new Date();
    
    const existing = await this.findLatestByEmail(email, type);
    if (existing && now - new Date(existing.created_at) < RESEND_COOLDOWN) {
      const remaining = Math.ceil((RESEND_COOLDOWN - (now - new Date(existing.created_at))) / 1000);
      throw new Error(`请等待 ${remaining} 秒后再发送`);
    }

    await this.deactivateOldCodes(email, type);

    const [result] = await db.query(
      'INSERT INTO email_verification_codes (email, code, type, status, created_at, expires_at) VALUES (?, ?, ?, ?, ?, ?)',
      [email, code, type, 'active', now, new Date(now.getTime() + VERIFICATION_CODE_EXPIRY)]
    );

    console.log(`[验证码] 已发送 - 邮箱: ${email}, 类型: ${type}, 验证码: ${code}`);
    return { id: result.insertId, code };
  }

  static async verify(email, code, type) {
    const now = new Date();
    
    const [rows] = await db.query(
      'SELECT * FROM email_verification_codes WHERE email = ? AND type = ? AND status = "active" ORDER BY created_at DESC LIMIT 1',
      [email, type]
    );

    if (rows.length === 0) {
      await this.logAttempt(email, type, 'no_code');
      throw new Error('请先获取验证码');
    }

    const record = rows[0];

    if (now > new Date(record.expires_at)) {
      await this.deactivate(record.id, 'expired');
      await this.logAttempt(email, type, 'expired');
      throw new Error('验证码已过期，请重新获取');
    }

    if (record.attempts >= MAX_ATTEMPTS) {
      await this.deactivate(record.id, 'too_many_attempts');
      await this.logAttempt(email, type, 'too_many_attempts');
      throw new Error('验证次数过多，请重新获取验证码');
    }

    if (record.code !== code) {
      await db.query(
        'UPDATE email_verification_codes SET attempts = attempts + 1 WHERE id = ?',
        [record.id]
      );
      await this.logAttempt(email, type, 'wrong_code');
      throw new Error('验证码错误');
    }

    await this.deactivate(record.id, 'verified');
    await this.logAttempt(email, type, 'success');
    console.log(`[验证码] 验证成功 - 邮箱: ${email}, 类型: ${type}`);
    return true;
  }

  static async markAsUsed(email, type) {
    await db.query(
      'UPDATE email_verification_codes SET status = "used" WHERE email = ? AND type = ? AND status = "verified"',
      [email, type]
    );
  }

  static generateCode() {
    return Math.floor(100000 + Math.random() * 900000).toString();
  }

  static findLatestByEmail(email, type) {
    return db.query(
      'SELECT * FROM email_verification_codes WHERE email = ? AND type = ? ORDER BY created_at DESC LIMIT 1',
      [email, type]
    ).then(([rows]) => rows[0] || null);
  }

  static deactivateOldCodes(email, type) {
    return db.query(
      'UPDATE email_verification_codes SET status = "superseded" WHERE email = ? AND type = ? AND status = "active"',
      [email, type]
    );
  }

  static deactivate(id, status) {
    return db.query(
      'UPDATE email_verification_codes SET status = ? WHERE id = ?',
      [status, id]
    );
  }

  static async logAttempt(email, type, result) {
    await db.query(
      'INSERT INTO email_verification_logs (email, type, result, created_at) VALUES (?, ?, ?, ?)',
      [email, type, result, new Date()]
    );
  }

  static async cleanupExpired() {
    const [result] = await db.query(
      'DELETE FROM email_verification_codes WHERE expires_at < NOW() - INTERVAL 1 DAY'
    );
    console.log(`[验证码清理] 删除了 ${result.affectedRows} 条过期记录`);
  }
}

class LoginAttempt {
  static async record(email, success) {
    await db.query(
      'INSERT INTO login_attempts (email, success, created_at) VALUES (?, ?, ?)',
      [email, success ? 1 : 0, new Date()]
    );
  }

  static async isLocked(email) {
    const [rows] = await db.query(
      'SELECT COUNT(*) as count FROM login_attempts WHERE email = ? AND success = 0 AND created_at > DATE_SUB(NOW(), INTERVAL 1 HOUR)',
      [email]
    );
    return rows[0].count >= 10;
  }

  static async getRemainingAttempts(email) {
    const [rows] = await db.query(
      'SELECT COUNT(*) as count FROM login_attempts WHERE email = ? AND success = 0 AND created_at > DATE_SUB(NOW(), INTERVAL 1 HOUR)',
      [email]
    );
    return Math.max(0, 10 - rows[0].count);
  }
}

function validateEmail(email) {
  const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
  return emailRegex.test(email);
}

function validatePasswordComplexity(password) {
  if (!password || password.length < 8) {
    return { valid: false, message: '密码长度至少8位' };
  }
  if (!/[a-z]/.test(password)) {
    return { valid: false, message: '密码必须包含小写字母' };
  }
  if (!/[A-Z]/.test(password)) {
    return { valid: false, message: '密码必须包含大写字母' };
  }
  if (!/[0-9]/.test(password)) {
    return { valid: false, message: '密码必须包含数字' };
  }
  if (!/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
    return { valid: false, message: '密码必须包含特殊字符' };
  }
  return { valid: true };
}

module.exports = {
  VerificationCode,
  LoginAttempt,
  validateEmail,
  validatePasswordComplexity,
  VERIFICATION_CODE_EXPIRY,
  RESEND_COOLDOWN
};