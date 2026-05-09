const db = require('../config/db');
const bcrypt = require('bcryptjs');

/**
 * User Model
 */
class User {
  /**
   * Find user by username
   * @param {string} username - Username
   * @returns {Promise<Object|null>} User object or null
   */
  static async findByUsername(username) {
    try {
      const [rows] = await db.query('SELECT * FROM users WHERE username = ?', [username]);
      return rows.length > 0 ? rows[0] : null;
    } catch (error) {
      console.error('Find user by username failed:', error.message);
      throw error;
    }
  }

  /**
   * Find user by phone
   * @param {string} phone - Phone number
   * @returns {Promise<Object|null>} User object or null
   */
  static async findByPhone(phone) {
    try {
      const [rows] = await db.query('SELECT * FROM users WHERE phone = ?', [phone]);
      return rows.length > 0 ? rows[0] : null;
    } catch (error) {
      console.error('Find user by phone failed:', error.message);
      throw error;
    }
  }

  /**
   * Find user by email
   * @param {string} email - Email
   * @returns {Promise<Object|null>} User object or null
   */
  static async findByEmail(email) {
    try {
      const [rows] = await db.query('SELECT * FROM users WHERE email = ?', [email]);
      return rows.length > 0 ? rows[0] : null;
    } catch (error) {
      console.error('Find user by email failed:', error.message);
      throw error;
    }
  }

  /**
   * Find user by any identifier (username/phone/email)
   * @param {string} identifier - Username, phone or email
   * @returns {Promise<Object|null>} User object or null
   */
  static async findByIdentifier(identifier) {
    try {
      const [rows] = await db.query(
        'SELECT * FROM users WHERE username = ? OR phone = ? OR email = ?',
        [identifier, identifier, identifier]
      );
      return rows.length > 0 ? rows[0] : null;
    } catch (error) {
      console.error('Find user by identifier failed:', error.message);
      throw error;
    }
  }

  /**
   * Find user by openid
   * @param {string} openid - Wechat openid
   * @returns {Promise<Object|null>} User object or null
   */
  static async findByOpenid(openid) {
    try {
      let [rows] = await db.query('SELECT * FROM users WHERE wx_openid = ?', [openid]);
      if (rows.length === 0) {
        [rows] = await db.query('SELECT * FROM users WHERE openid = ?', [openid]);
      }
      return rows.length > 0 ? rows[0] : null;
    } catch (error) {
      console.error('Find user failed:', error.message);
      throw error;
    }
  }

  /**
   * Get max username for a specific user type
   * @param {boolean} isAppUser - Whether it's an app user
   * @returns {Promise<number>} Max username number
   */
  static async getMaxUsername(isAppUser = false) {
    try {
      let maxUsername = 0;
      if (isAppUser) {
        const [result] = await db.query(
          'SELECT MAX(CAST(username AS UNSIGNED)) as max_username FROM users'
        );
        if (result && result[0] && result[0].max_username) {
          maxUsername = parseInt(result[0].max_username, 10) || 0;
        }
      } else {
        const [result] = await db.query(
          'SELECT MAX(CAST(username AS UNSIGNED)) as max_username FROM users WHERE (app_user = FALSE OR app_user IS NULL)'
        );
        if (result && result[0] && result[0].max_username) {
          maxUsername = parseInt(result[0].max_username, 10) || 0;
        }
      }
      return maxUsername;
    } catch (error) {
      console.error('Get max username failed:', error.message);
      return 0;
    }
  }

  /**
   * Create new wechat user
   * @param {Object} userData - User data
   * @returns {Promise<Object>} Created user
   */
  static async create(userData) {
    const { openid, unionid, nick_name, avatar_url } = userData;

    const adminOpenids = [
      'o2b_9433AOhJ_nS-JLOp4g7JN5ZM',
      'o2b_94-117wT3JUCZK1i6LZt_YI',
      'your_wechat_openid_here'
    ];
    const isAdmin = adminOpenids.includes(openid);

    let isFirstUser = false;
    try {
      const [userCount] = await db.query('SELECT COUNT(*) as count FROM users');
      isFirstUser = userCount[0].count === 0;
    } catch (error) {
      console.error('Get user count failed:', error.message);
    }

    if (isFirstUser) {
      console.log('First registered user, set as admin');
    }

    const finalIsAdmin = isAdmin || isFirstUser;
    const password = '';

    // username 全表唯一：必须与 APP 用户共用同一套数字递增规则（此前仅用微信用户算 MAX，会与 APP 已占用的 041 等冲突）
    for (let attempt = 0; attempt < 20; attempt++) {
      try {
        const maxUsername = await this.getMaxUsername(true);
        const nextUsername = maxUsername + 1;
        const username = nextUsername.toString().padStart(3, '0');

        const [result] = await db.query(
          'INSERT INTO users (wx_openid, openid, unionid, username, password, nick_name, avatar_url, is_admin, app_user) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
          [openid, openid, unionid, username, password, nick_name || null, avatar_url || null, finalIsAdmin, false]
        );

        console.log(`Wechat user created: ${username}, Admin: ${finalIsAdmin}`);
        return this.findById(result.insertId);
      } catch (error) {
        const dup =
          error.code === 'ER_DUP_ENTRY' ||
          (error.message && error.message.includes('Duplicate entry'));
        if (dup && error.message && error.message.includes('username')) {
          console.warn(`Wechat username collision, retry ${attempt + 1}:`, error.message);
          continue;
        }
        console.error('Create wechat user failed:', error.message);
        throw error;
      }
    }
    throw new Error('Create wechat user failed: could not allocate unique username');
  }

  /**
   * Create user with custom username and password
   * @param {Object} userData - User data
   * @returns {Promise<Object>} Created user
   */
  static async createWithUsername(userData) {
    try {
      const { username, password, nick_name, avatar_url, phone, email } = userData;
      
      let isFirstUser = false;
      try {
        const [userCount] = await db.query('SELECT COUNT(*) as count FROM users');
        isFirstUser = userCount[0].count === 0;
      } catch (error) {
        console.error('Get user count failed:', error.message);
      }
      
      const [result] = await db.query(
        'INSERT INTO users (username, password, nick_name, avatar_url, phone, email, is_admin, app_user) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
        [username, password, nick_name || username, avatar_url || null, phone || null, email || null, isFirstUser, true]
      );
      
      console.log(`User created with custom username: ${username}`);
      
      return this.findById(result.insertId);
    } catch (error) {
      console.error('Create user with custom username failed:', error.message);
      throw error;
    }
  }

  /**
   * Create new app user
   * @param {Object} userData - User data
   * @param {string} defaultPassword - Default password
   * @returns {Promise<Object>} Created user with credentials
   */
  static async createAppUser(userData, defaultPassword) {
    try {
      const { nick_name, avatar_url, phone, email } = userData;
      
      const maxUsername = await this.getMaxUsername(true);
      
      const nextUsername = maxUsername + 1;
      const username = nextUsername.toString().padStart(3, '0');
      
      const hashedPassword = await bcrypt.hash(defaultPassword, 10);
      
      let isFirstUser = false;
      try {
        const [userCount] = await db.query('SELECT COUNT(*) as count FROM users');
        isFirstUser = userCount[0].count === 0;
      } catch (error) {
        console.error('Get user count failed:', error.message);
      }
      
      const [result] = await db.query(
        'INSERT INTO users (username, password, nick_name, avatar_url, phone, email, is_admin, app_user) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
        [username, hashedPassword, nick_name || null, avatar_url || null, phone || null, email || null, isFirstUser, true]
      );
      
      console.log(`App user created: ${username}`);
      
      const user = await this.findById(result.insertId);
      
      return {
        user,
        username,
        password: defaultPassword
      };
    } catch (error) {
      console.error('Create app user failed:', error.message);
      throw error;
    }
  }

  /**
   * Find user by ID
   * @param {number} id - User ID
   * @returns {Promise<Object|null>} User object or null
   */
  static async findById(id) {
    try {
      const [rows] = await db.query('SELECT * FROM users WHERE id = ?', [id]);
      return rows.length > 0 ? rows[0] : null;
    } catch (error) {
      console.error('Find user by ID failed:', error.message);
      throw error;
    }
  }

  /**
   * Update user info
   * @param {number} id - User ID
   * @param {Object} userData - User data
   * @returns {Promise<Object>} Updated user
   */
  static async update(id, userData) {
    try {
      const updateFields = [];
      const updateValues = [];
      
      const nick_name = userData.nick_name || userData.nickName || userData.nickname;
      if (nick_name !== undefined && nick_name !== null) {
        updateFields.push('nick_name = ?');
        updateValues.push(nick_name);
      }
      
      const avatar_url = userData.avatar_url || userData.avatarUrl || userData.avatar;
      if (avatar_url !== undefined && avatar_url !== null) {
        updateFields.push('avatar_url = ?');
        updateValues.push(avatar_url);
      }
      
      if (userData.wx_openid) {
        updateFields.push('wx_openid = ?');
        updateValues.push(userData.wx_openid);
      }
      
      if (userData.phone !== undefined && userData.phone !== null) {
        updateFields.push('phone = ?');
        updateValues.push(userData.phone);
      }
      
      if (userData.email !== undefined && userData.email !== null) {
        updateFields.push('email = ?');
        updateValues.push(userData.email);
      }
      
      if (updateFields.length === 0) {
        console.log('No fields to update');
        return this.findById(id);
      }
      
      updateValues.push(id);
      
      const sql = `UPDATE users SET ${updateFields.join(', ')} WHERE id = ?`;
      console.log('Update SQL:', sql);
      console.log('Update params:', updateValues);
      
      await db.query(sql, updateValues);
      
      return this.findById(id);
    } catch (error) {
      console.error('Update user failed:', error.message);
      throw error;
    }
  }

  /**
   * Get safe user info (without sensitive fields)
   * @param {Object} user - Full user info
   * @returns {Object} Safe user info
   */
  static getSafeUserInfo(user) {
    if (!user) return null;
    
    return {
      id: user.id,
      openid: user.openid,
      username: user.username,
      nick_name: user.nick_name,
      avatar_url: user.avatar_url,
      phone: user.phone,
      email: user.email,
      gender: user.gender,
      city: user.city,
      province: user.province,
      country: user.country,
      hasProfile: !!(user.nick_name && user.avatar_url),
      is_admin: user.is_admin || false,
      isAdmin: user.is_admin || false,
      app_user: user.app_user || false,
      created_at: user.created_at,
      updated_at: user.updated_at
    };
  }
}

module.exports = User;
