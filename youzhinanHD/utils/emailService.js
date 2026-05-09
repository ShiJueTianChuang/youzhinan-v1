const nodemailer = require('nodemailer');

const EMAIL_CONFIG = {
  host: 'smtp.qq.com',
  port: 587,
  secure: false,
  auth: {
    user: process.env.EMAIL_USER || '',
    pass: process.env.EMAIL_PASS || ''
  }
};

const transporter = nodemailer.createTransport(EMAIL_CONFIG);

async function sendVerificationEmail(to, code, type) {
  const typeNames = {
    register: '注册验证',
    login: '登录验证',
    reset_password: '密码重置验证'
  };

  const subject = `【有壹有伴】${typeNames[type] || '验证'}验证码`;
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
      <h2 style="color: #333;">有壹有伴</h2>
      <p style="font-size: 16px; color: #555;">您好，</p>
      <p style="font-size: 16px; color: #555;">您正在进行${typeNames[type] || '验证'}操作，验证码是：</p>
      <div style="background: #f5f5f5; padding: 20px; text-align: center; margin: 20px 0; border-radius: 8px;">
        <span style="font-size: 32px; font-weight: bold; color: #1890ff; letter-spacing: 8px;">${code}</span>
      </div>
      <p style="font-size: 14px; color: #999;">验证码有效期为10分钟，请尽快使用。</p>
      <p style="font-size: 14px; color: #999;">如果这不是您本人的操作，请忽略此邮件。</p>
      <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">
      <p style="font-size: 12px; color: #ccc;">此邮件由系统自动发送，请勿直接回复。</p>
    </div>
  `;

  const mailOptions = {
    from: {
      name: '有壹有伴',
      address: EMAIL_CONFIG.auth.user
    },
    to: to,
    subject: subject,
    html: html
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    console.log(`[邮件发送] 成功 - 收件人: ${to}, 类型: ${type}, MessageId: ${info.messageId}`);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error(`[邮件发送] 失败 - 收件人: ${to}, 错误:`, error.message);
    throw error;
  }
}

async function sendPasswordChangeNotification(to) {
  const subject = '【有壹有伴】密码修改成功通知';
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
      <h2 style="color: #333;">有壹有伴</h2>
      <p style="font-size: 16px; color: #555;">您好，</p>
      <p style="font-size: 16px; color: #555;">您的账户密码已成功修改。</p>
      <p style="font-size: 14px; color: #ff4d4f;">如果这不是您本人的操作，请立即联系客服或重置密码。</p>
      <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">
      <p style="font-size: 12px; color: #ccc;">此邮件由系统自动发送，请勿直接回复。</p>
    </div>
  `;

  const mailOptions = {
    from: {
      name: '有壹有伴',
      address: EMAIL_CONFIG.auth.user
    },
    to: to,
    subject: subject,
    html: html
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    console.log(`[邮件通知] 成功 - 收件人: ${to}, 类型: 密码修改通知, MessageId: ${info.messageId}`);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error(`[邮件通知] 失败 - 收件人: ${to}, 错误:`, error.message);
    throw error;
  }
}

module.exports = {
  sendVerificationEmail,
  sendPasswordChangeNotification
};