# 🖥️ 有指南 - 后端服务 (youzhinanHD)

基于 Node.js + Express + MySQL 的 RESTful API 后端服务，为 Android APP、微信小程序和 Web 端提供统一的数据接口。

## 技术栈

| 技术 | 版本 | 用途 |
|------|------|------|
| Node.js | >= 18 | 运行时环境 |
| Express | 4.18.2 | Web 框架 |
| MySQL2 | 3.16.1 | 数据库驱动（连接池） |
| jsonwebtoken | 9.0.3 | JWT 身份认证 |
| bcryptjs | 2.4.3 | 密码哈希加密 |
| multer | 1.4.5 | 文件上传处理 |
| sharp | 0.34.5 | 图片处理与缩略图生成 |
| nodemailer | 6.9.16 | 邮件发送（QQ邮箱） |
| axios | 1.13.3 | HTTP 客户端 |
| ws | 8.18.0 | WebSocket 实时通信 |
| xlsx | 0.18.5 | Excel 导入导出 |
| pdf-parse | 2.4.5 | PDF 文档解析 |
| compression | 1.8.1 | Gzip 响应压缩 |

## 项目结构

```
youzhinanHD/
├── config/                     # 配置模块
│   ├── db.js                       # MySQL 连接池配置
│   ├── env.js                      # 环境变量（后端地址）
│   └── api_keys.json               # 第三方 API 密钥（不入库）
│
├── middleware/                  # 中间件
│   └── auth.js                      # JWT 认证中间件
│
├── models/                     # 数据模型
│   └── user.js                      # 用户模型
│
├── routes/                      # API 路由模块
│   ├── app.js                       # APP 专用接口（快速注册/运营商登录）
│   ├── user.js                      # 用户管理（注册/登录/资料）
│   ├── info.js                      # 场所信息 CRUD
│   ├── category.js                  # 分类管理
│   ├── aiChat.js                    # AI 智能对话
│   ├── aiModel.js                   # AI 模型配置
│   ├── speech.js                    # 语音识别/合成代理
│   ├── smsAuth.js                   # 短信验证码认证
│   ├── emailAuth.js                 # 邮箱验证码认证
│   ├── wxlogin.js                   # 微信小程序登录
│   ├── gaode.js                     # 高德地图 API 代理
│   ├── images.js                    # 图片上传
│   ├── lottery.js                   # 积分抽奖
│   ├── messages.js                  # WebSocket 消息
│   ├── nearby.js                    # 附近场所搜索
│   ├── regions.js                   # 省市区数据
│   ├── submissions.js               # 用户投稿
│   ├── adminSubmissions.js          # 投稿审核
│   ├── admin.js                     # 后台管理
│   ├── stats.js                     # 数据统计
│   ├── about.js                     # 关于页面
│   ├── appVersion.js                # APP 版本管理
│   └── customerService.js           # 在线客服
│
├── utils/                       # 工具模块
│   ├── aiService.js                 # 豆包 AI 服务封装
│   ├── speechService.js             # 讯飞语音服务封装
│   ├── emailService.js              # 邮件发送服务
│   ├── smsService.js                # 阿里云短信服务
│   ├── smsVerification.js           # 短信验证码管理
│   ├── emailVerification.js         # 邮箱验证码管理
│   ├── wechat.js                    # 微信 API 封装
│   ├── inviteCode.js                # 邀请码生成与验证
│   ├── documentParser.js            # 文档解析（PDF/Word）
│   └── thumbnailMiddleware.js       # 图片缩略图中间件
│
├── server.js                    # 服务入口文件
├── .env.example                 # 环境变量模板
├── .gitignore                   # Git 忽略规则
└── package.json                 # 依赖管理
```

## 快速开始

### 1. 安装依赖

```bash
npm install
```

### 2. 配置环境变量

```bash
cp .env.example .env
```

编辑 `.env` 文件，至少配置以下必填项：

```env
DB_HOST=localhost
DB_USER=your_db_user
DB_PASSWORD=your_db_password
DB_NAME=info_management
JWT_SECRET=your-super-secret-jwt-key-min-32-chars-long
```

### 3. 初始化数据库

```bash
mysql -u root -p < ../youzhinanWX/db_init.sql
```

### 4. 启动服务

```bash
# 开发模式（热重载）
npm run dev

# 生产模式
npm start
```

服务默认运行在 `http://localhost:3004`

## 环境变量说明

| 变量名 | 必填 | 默认值 | 说明 |
|--------|------|--------|------|
| `DB_HOST` | ✅ | localhost | MySQL 主机地址 |
| `DB_USER` | ✅ | - | 数据库用户名 |
| `DB_PASSWORD` | ✅ | - | 数据库密码 |
| `DB_NAME` | ✅ | info_management | 数据库名称 |
| `DB_PORT` | ❌ | 3306 | 数据库端口 |
| `JWT_SECRET` | ✅ | - | JWT 签名密钥 |
| `JWT_EXPIRES_IN` | ❌ | 30d | Token 有效期 |
| `PORT` | ❌ | 3004 | 服务监听端口 |
| `NODE_ENV` | ❌ | production | 运行环境 |
| `CORS_ORIGIN` | ❌ | * | CORS 允许的来源 |
| `WECHAT_APPID` | ❌ | - | 微信小程序 AppID |
| `WECHAT_SECRET` | ❌ | - | 微信小程序 AppSecret |
| `ALIYUN_SMS_ACCESS_KEY_ID` | ❌ | - | 阿里云短信 Key |
| `ALIYUN_SMS_ACCESS_KEY_SECRET` | ❌ | - | 阿里云短信 Secret |
| `EMAIL_USER` | ❌ | - | 邮箱账号 |
| `EMAIL_PASS` | ❌ | - | 邮箱授权码 |
| `GAODE_API_KEY` | ❌ | - | 高德地图 Key |
| `ARK_API_KEY` | ❌ | - | 火山方舟 AI Key |
| `PUBLIC_ORIGIN` | ❌ | - | 公网域名 |

## API 路由总览

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/app/quick-register` | APP 快速注册 |
| POST | `/api/app/carrier-login` | 运营商一键登录 |
| POST | `/api/app/login` | APP 密码登录 |
| POST | `/api/user/register` | 用户注册 |
| POST | `/api/user/login` | 用户登录 |
| GET | `/api/info` | 获取场所列表 |
| GET | `/api/info/:id` | 获取场所详情 |
| POST | `/api/info` | 新增场所 |
| PUT | `/api/info/:id` | 更新场所 |
| DELETE | `/api/info/:id` | 删除场所 |
| GET | `/api/category` | 获取分类列表 |
| POST | `/api/ai/chat` | AI 对话 |
| POST | `/api/sms-auth/send` | 发送短信验证码 |
| POST | `/api/sms-auth/verify` | 验证短信验证码 |
| POST | `/api/email-auth/send` | 发送邮箱验证码 |
| POST | `/api/wxlogin` | 微信登录 |
| POST | `/api/images/upload` | 图片上传 |
| GET | `/api/nearby` | 附近场所搜索 |
| GET | `/api/regions` | 省市区数据 |
| GET | `/api/health` | 健康检查 |

## 认证机制

- 大部分接口使用 JWT Bearer Token 认证
- 请求头格式：`Authorization: Bearer <token>`
- 管理员接口需要 `is_admin: true` 的用户 Token
