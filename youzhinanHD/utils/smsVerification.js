const db = require('../config/db');

const VERIFICATION_CODE_EXPIRY = 10 * 60 * 1000; // 10分钟过期
const RESEND_COOLDOWN = 60 * 1000; // 60秒冷却
const MAX_ATTEMPTS = 5; // 最多验证5次

class SmsVerificationCode {
  /**
   * 创建短信验证码
   * @param {string} phone - 手机号
   * @param {string} type - 类型: register, login, reset_password
   * @returns {Promise<{id: number, code: string}>}
   */
  static async create(phone, type) {
    const code = this.generateCode();
    const now = new Date();

    // 检查冷却时间
    const existing = await this.findLatestByPhone(phone, type);
    if (existing && now - new Date(existing.created_at) < RESEND_COOLDOWN) {
      const remaining = Math.ceil((RESEND_COOLDOWN - (now - new Date(existing.created_at))) / 1000);
      throw new Error(`请等待 ${remaining} 秒后再发送`);
    }

    // 将旧验证码标记为过期
    await this.deactivateOldCodes(phone, type);

    const [result] = await db.query(
      'INSERT INTO sms_verification_codes (phone, code, type, status, created_at, expires_at) VALUES (?, ?, ?, ?, ?, ?)',
      [phone, code, type, 'active', now, new Date(now.getTime() + VERIFICATION_CODE_EXPIRY)]
    );

    console.log(`[短信验证码] 已生成 - 手机: ${phone}, 类型: ${type}, 验证码: ${code}`);
    return { id: result.insertId, code };
  }

  /**
   * 验证短信验证码
   * @param {string} phone - 手机号
   * @param {string} code - 验证码
   * @param {string} type - 类型
   * @returns {Promise<boolean>}
   */
  static async verify(phone, code, type) {
    const now = new Date();

    const [rows] = await db.query(
      'SELECT * FROM sms_verification_codes WHERE phone = ? AND type = ? AND status = "active" ORDER BY created_at DESC LIMIT 1',
      [phone, type]
    );

    if (rows.length === 0) {
      await this.logAttempt(phone, type, 'no_code');
      throw new Error('请先获取验证码');
    }

    const record = rows[0];

    if (now > new Date(record.expires_at)) {
      await this.deactivate(record.id, 'expired');
      await this.logAttempt(phone, type, 'expired');
      throw new Error('验证码已过期，请重新获取');
    }

    if (record.attempts >= MAX_ATTEMPTS) {
      await this.deactivate(record.id, 'too_many_attempts');
      await this.logAttempt(phone, type, 'too_many_attempts');
      throw new Error('验证次数过多，请重新获取验证码');
    }

    if (record.code !== code) {
      await db.query(
        'UPDATE sms_verification_codes SET attempts = attempts + 1 WHERE id = ?',
        [record.id]
      );
      await this.logAttempt(phone, type, 'wrong_code');
      throw new Error('验证码错误');
    }

    await this.deactivate(record.id, 'verified');
    await this.logAttempt(phone, type, 'success');
    console.log(`[短信验证码] 验证成功 - 手机: ${phone}, 类型: ${type}`);
    return true;
  }

  /**
   * 将已验证的验证码标记为已使用
   */
  static async markAsUsed(phone, type) {
    await db.query(
      'UPDATE sms_verification_codes SET status = "used" WHERE phone = ? AND type = ? AND status = "verified"',
      [phone, type]
    );
  }

  /**
   * 生成6位数字验证码
   */
  static generateCode() {
    return Math.floor(100000 + Math.random() * 900000).toString();
  }

  static findLatestByPhone(phone, type) {
    return db.query(
      'SELECT * FROM sms_verification_codes WHERE phone = ? AND type = ? ORDER BY created_at DESC LIMIT 1',
      [phone, type]
    ).then(([rows]) => rows[0] || null);
  }

  static deactivateOldCodes(phone, type) {
    return db.query(
      'UPDATE sms_verification_codes SET status = "superseded" WHERE phone = ? AND type = ? AND status = "active"',
      [phone, type]
    );
  }

  static deactivate(id, status) {
    return db.query(
      'UPDATE sms_verification_codes SET status = ? WHERE id = ?',
      [status, id]
    );
  }

  static async logAttempt(phone, type, result) {
    await db.query(
      'INSERT INTO sms_verification_logs (phone, type, result, created_at) VALUES (?, ?, ?, ?)',
      [phone, type, result, new Date()]
    );
  }

  static async cleanupExpired() {
    const [result] = await db.query(
      'DELETE FROM sms_verification_codes WHERE expires_at < NOW() - INTERVAL 1 DAY'
    );
    console.log(`[短信验证码清理] 删除了 ${result.affectedRows} 条过期记录`);
  }
}

module.exports = {
  SmsVerificationCode,
  VERIFICATION_CODE_EXPIRY,
  RESEND_COOLDOWN
};
