<div align="center">

# 🌈 有指南 YouZhiNan

### 全国彩虹信息查询智能助手

**一站式生活信息服务平台 · 覆盖 Android / 微信小程序 / Web 三端**

[![Version](https://img.shields.io/badge/version-v1.2.5-blue.svg)](https://github.com/ShiJueTianChuang/youzhinan-v1)
[![Platform](https://img.shields.io/badge/platform-Android%20%7C%20WeChat%20%7C%20Web-green.svg)]()
[![License](https://img.shields.io/badge/license-MIT-orange.svg)](LICENSE)
[![Node](https://img.shields.io/badge/Node.js-%3E%3D18-brightgreen.svg)]()
[![Kotlin](https://img.shields.io/badge/Kotlin-2.2.10-purple.svg)]()

</div>

---

## 📖 项目简介

**有指南**是一款面向全国的生活信息查询与智能助手平台，帮助用户快速发现身边的酒吧、民宿、公园等场所信息，并提供 AI 智能对话、语音交互、地图导航等丰富功能。

### ✨ 核心特性

| 功能 | 描述 |
|------|------|
| 🔍 **智能搜索** | 按城市、区域、分类多维度精准搜索场所信息 |
| 🤖 **AI 对话** | 集成豆包大模型，支持文字/语音多模态智能对话 |
| 🗺️ **地图导航** | 接入高德地图，实时距离计算与一键导航 |
| 🎤 **语音交互** | 讯飞语音识别 + 语音合成，解放双手 |
| 💬 **在线客服** | 实时 WebSocket 消息系统，即时沟通 |
| 📱 **多端覆盖** | Android APP + 微信小程序 + Web 下载页三端同步 |
| 🔐 **多种登录** | 微信一键登录 / 手机短信登录 / 邮箱登录 / 密码登录 |
| ⭐ **收藏管理** | 一键收藏心仪场所，随时查看 |
| 🎰 **积分抽奖** | 用户积分体系 + 趣味抽奖活动 |
| 📤 **信息投稿** | 用户可提交新场所信息，管理员审核后上线 |
| 🔄 **版本更新** | APP 内检测更新，自动提示下载安装 |
| 🎨 **Material 3** | Android 端采用 Material Design 3 设计语言 |

---

## 🏗️ 系统架构

```
┌─────────────────────────────────────────────────────────────┐
│                        客户端层                              │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────┐  │
│  │  Android APP │  │  微信小程序    │  │   Web 下载页      │  │
│  │  (Kotlin +   │  │  (原生框架 +  │  │   (HTML/CSS/JS)  │  │
│  │   Compose)   │  │   自定义TabBar)│  │                  │  │
│  └──────┬───────┘  └──────┬───────┘  └────────┬─────────┘  │
│         │                 │                    │             │
└─────────┼─────────────────┼────────────────────┼─────────────┘
          │                 │                    │
          ▼                 ▼                    ▼
┌─────────────────────────────────────────────────────────────┐
│                      后端服务层                               │
│  ┌──────────────────────────────────────────────────────┐   │
│  │              Express + Node.js                        │   │
│  │  ┌─────────┐ ┌──────────┐ ┌────────┐ ┌───────────┐  │   │
│  │  │ REST API│ │ WebSocket│ │ JWT认证│ │ 文件上传   │  │   │
│  │  │ (20+路由)│ │ (实时消息)│ │(多方式)│ │(图片/缩略图)│  │   │
│  │  └─────────┘ └──────────┘ └────────┘ └───────────┘  │   │
│  └──────────────────────────────────────────────────────┘   │
│                          │                                   │
└──────────────────────────┼───────────────────────────────────┘
                           │
          ┌────────────────┼────────────────┐
          ▼                ▼                ▼
┌──────────────┐  ┌──────────────┐  ┌──────────────┐
│   MySQL      │  │  第三方服务    │  │  AI 服务     │
│  (数据存储)   │  │  ┌──────────┐│  │  ┌──────────┐│
│              │  │  │ 高德地图  ││  │  │ 豆包大模型 ││
│  - users     │  │  │ 阿里云短信││  │  │ (火山方舟) ││
│  - info      │  │  │ 微信开放平台│ │  │  └──────────┘│
│  - categories│  │  │ QQ邮箱   ││  │  │  ┌──────────┐│
│  - favorites │  │  │ 讯飞语音  ││  │  │ 视觉模型   ││
│  - messages  │  │  └──────────┘│  │  │ (图片理解) ││
│  - visits    │  │              │  │  └──────────┘│
│  - ...       │  │              │  │              │
└──────────────┘  └──────────────┘  └──────────────┘
```

---

## 📁 项目结构

```
youzhinan-v1/
│
├── youyiyoubanAPP/              # 📱 Android 客户端
│   ├── app/
│   │   ├── src/main/
│   │   │   ├── java/com/example/youzhinan/
│   │   │   │   ├── data/api/          # 网络请求层 (Retrofit)
│   │   │   │   │   ├── ApiService.kt       # 主要业务接口
│   │   │   │   │   ├── AiChatApi.kt        # AI 对话接口
│   │   │   │   │   ├── AmapApiClient.kt    # 高德地图接口
│   │   │   │   │   ├── SmsAuthApi.kt       # 短信认证接口
│   │   │   │   │   ├── EmailLoginApi.kt    # 邮箱登录接口
│   │   │   │   │   ├── AppVersionApi.kt    # 版本更新接口
│   │   │   │   │   └── RetrofitClient.kt   # 网络客户端配置
│   │   │   │   ├── ui/
│   │   │   │   │   ├── pages/        # 页面组件
│   │   │   │   │   │   ├── HomePage.kt          # 首页
│   │   │   │   │   │   ├── SearchPage.kt        # 搜索页
│   │   │   │   │   │   ├── AIChatPage.kt        # AI 对话页
│   │   │   │   │   │   ├── ProfilePage.kt       # 个人中心
│   │   │   │   │   │   ├── FavoritesPage.kt     # 收藏页
│   │   │   │   │   │   ├── MessagesPage.kt      # 消息页
│   │   │   │   │   │   ├── LotteryPage.kt       # 抽奖页
│   │   │   │   │   │   ├── SubmitPage.kt        # 投稿页
│   │   │   │   │   │   └── ...                  # 更多页面
│   │   │   │   │   ├── components/   # 通用组件
│   │   │   │   │   └── theme/        # 主题配置
│   │   │   │   ├── utils/            # 工具类
│   │   │   │   │   ├── LocationHelper.kt       # 定位辅助
│   │   │   │   │   ├── NetworkMonitor.kt       # 网络监控
│   │   │   │   │   ├── XunfeiSpeechRecognizer.kt  # 讯飞语音识别
│   │   │   │   │   └── XunfeiSpeechSynthesizer.kt # 讯飞语音合成
│   │   │   │   └── viewmodel/        # ViewModel 层
│   │   │   └── res/                  # 资源文件
│   │   └── build.gradle.kts          # 应用构建配置
│   ├── gradle/                       # Gradle 版本目录
│   └── build.gradle.kts              # 项目构建配置
│
├── youzhinanHD/                  # 🖥️ 后端服务
│   ├── config/                       # 配置文件
│   │   ├── db.js                         # 数据库连接池
│   │   ├── env.js                       # 环境变量
│   │   └── api_keys.json                # API 密钥（不入库）
│   ├── middleware/                    # 中间件
│   │   └── auth.js                       # JWT 认证中间件
│   ├── models/                       # 数据模型
│   │   └── user.js                       # 用户模型
│   ├── routes/                       # API 路由（20+ 接口模块）
│   │   ├── app.js                        # APP 专用接口
│   │   ├── user.js                       # 用户管理
│   │   ├── info.js                       # 场所信息管理
│   │   ├── category.js                   # 分类管理
│   │   ├── aiChat.js                     # AI 对话
│   │   ├── aiModel.js                    # AI 模型管理
│   │   ├── speech.js                     # 语音服务
│   │   ├── smsAuth.js                    # 短信认证
│   │   ├── emailAuth.js                  # 邮箱认证
│   │   ├── wxlogin.js                    # 微信登录
│   │   ├── gaode.js                      # 高德地图代理
│   │   ├── images.js                     # 图片上传
│   │   ├── lottery.js                    # 抽奖活动
│   │   ├── messages.js                   # 消息系统
│   │   ├── nearby.js                     # 附近搜索
│   │   ├── regions.js                    # 地区数据
│   │   ├── submissions.js                # 用户投稿
│   │   ├── admin.js                      # 后台管理
│   │   ├── stats.js                      # 数据统计
│   │   ├── about.js                      # 关于页面
│   │   ├── appVersion.js                 # 版本管理
│   │   └── customerService.js            # 客服系统
│   ├── utils/                         # 工具模块
│   │   ├── aiService.js                  # AI 服务封装
│   │   ├── speechService.js              # 语音服务封装
│   │   ├── emailService.js               # 邮件服务
│   │   ├── smsService.js                 # 短信服务
│   │   ├── wechat.js                     # 微信 API 封装
│   │   ├── inviteCode.js                 # 邀请码系统
│   │   ├── documentParser.js             # 文档解析
│   │   └── thumbnailMiddleware.js        # 缩略图中间件
│   ├── server.js                      # 服务入口
│   ├── .env.example                   # 环境变量模板
│   └── package.json                   # 依赖管理
│
├── youzhinanWX/                  # 💬 微信小程序
│   ├── pages/                         # 页面目录
│   │   ├── home/                         # 首页（场所列表）
│   │   ├── index/                        # 搜索页
│   │   ├── mine/                         # 个人中心
│   │   ├── detail/                       # 场所详情
│   │   ├── favorites/                    # 收藏列表
│   │   ├── messages/                     # 消息中心
│   │   ├── about/                        # 关于我们
│   │   ├── manage/                       # 管理后台
│   │   ├── backend/                      # 后台面板
│   │   ├── userManagement/               # 用户管理
│   │   ├── infoManagement/               # 信息管理
│   │   └── categoryManagement/           # 分类管理
│   ├── custom-tab-bar/               # 自定义底部导航栏
│   ├── utils/                         # 工具模块
│   │   ├── constants.js                  # 全局配置
│   │   ├── commonUtils.js                # 通用工具
│   │   ├── favoriteUtil.js               # 收藏工具
│   │   ├── geocodeCache.js               # 地理编码缓存
│   │   ├── provinceCityUtil.js            # 省市数据处理
│   │   └── qqmap-wx-jssdk.min.js         # 腾讯地图 SDK
│   ├── images/                        # 静态图片资源
│   ├── app.js                         # 小程序入口
│   ├── app.json                       # 小程序配置
│   └── db_init.sql                    # 数据库初始化脚本
│
├── youzhinanGW/                  # 🌐 Web 下载页
│   ├── index.html                     # 下载页面
│   ├── script.js                      # 页面逻辑
│   ├── style.css                      # 页面样式
│   ├── logo.png                       # Logo 图片
│   └── downloads/                     # APK 下载目录
│       └── youzhinan-v1.2.5.apk           # 最新安装包
│
├── README.md                     # 📖 项目主文档（本文件）
├── CHANGELOG.md                  # 📝 版本更新日志
└── LICENSE                       # ⚖️ 开源许可证
```

---

## 🛠️ 技术栈详情

### 📱 Android 客户端

| 技术 | 版本 | 用途 |
|------|------|------|
| Kotlin | 2.2.10 | 开发语言 |
| Jetpack Compose | BOM 2025.02.00 | 声明式 UI 框架 |
| Material 3 | - | 设计系统 |
| Retrofit | 2.11.0 | 网络请求 |
| OkHttp | 4.12.0 | HTTP 客户端 |
| Coil | 2.4.0 | 图片加载 |
| Navigation Compose | 2.8.9 | 页面导航 |
| Accompanist | 0.32.0 | 系统UI控制/权限 |
| Google Play Services Location | 21.1.0 | 定位服务 |
| Min SDK | 26 (Android 8.0) | 最低兼容版本 |
| Target SDK | 36 | 目标 SDK 版本 |

### 🖥️ 后端服务

| 技术 | 版本 | 用途 |
|------|------|------|
| Node.js | >= 18 | 运行时环境 |
| Express | 4.18.2 | Web 框架 |
| MySQL2 | 3.16.1 | 数据库驱动 |
| JWT (jsonwebtoken) | 9.0.3 | 身份认证 |
| Bcrypt.js | 2.4.3 | 密码加密 |
| Multer | 1.4.5 | 文件上传 |
| Sharp | 0.34.5 | 图片处理/缩略图 |
| Nodemailer | 6.9.16 | 邮件发送 |
| Axios | 1.13.3 | HTTP 客户端 |
| ws | 8.18.0 | WebSocket 服务 |
| XLSX | 0.18.5 | Excel 导入导出 |
| PDF-Parse | 2.4.5 | PDF 文档解析 |
| Compression | 1.8.1 | Gzip 响应压缩 |

### 💬 微信小程序

| 技术 | 用途 |
|------|------|
| 微信小程序原生框架 | 基础运行环境 |
| 自定义 TabBar | 底部导航栏定制 |
| 腾讯地图微信 SDK | 地图与定位 |
| wx.login / wx.request | 登录与网络请求 |

### 🌐 Web 下载页

| 技术 | 用途 |
|------|------|
| HTML5 | 页面结构 |
| CSS3 (响应式) | 页面样式 |
| Vanilla JavaScript | 页面交互 |
| Google Fonts (Inter) | 字体服务 |

---

## 🚀 快速开始

### 环境要求

| 工具 | 最低版本 | 推荐版本 |
|------|---------|---------|
| Node.js | 18.x | 20.x LTS |
| MySQL | 5.7 | 8.0+ |
| Android Studio | Hedgehog | 最新稳定版 |
| JDK | 11 | 17 |
| 微信开发者工具 | 稳定版 | 最新版 |
| npm | 9.x | 10.x |

### 1️⃣ 克隆项目

```bash
git clone https://github.com/ShiJueTianChuang/youzhinan-v1.git
cd youzhinan-v1
```

### 2️⃣ 启动后端服务

```bash
cd youzhinanHD

# 安装依赖
npm install

# 配置环境变量
cp .env.example .env
# 编辑 .env 文件，填入你的数据库和第三方服务配置

# 初始化数据库
mysql -u root -p < ../youzhinanWX/db_init.sql

# 启动开发服务器
npm run dev

# 或启动生产服务器
npm start
```

服务默认运行在 `http://localhost:3004`

### 3️⃣ 运行 Android 客户端

```bash
cd youyiyoubanAPP

# 使用 Android Studio 打开项目
# File → Open → 选择 youyiyoubanAPP 目录

# 配置签名信息
# 在 local.properties 中添加：
# KEYSTORE_PASSWORD=your_keystore_password
# KEY_ALIAS=your_key_alias
# KEY_PASSWORD=your_key_password

# 选择设备并运行
```

### 4️⃣ 运行微信小程序

```bash
# 使用微信开发者工具打开 youzhinanWX 目录
# 填入你的 AppID
# 编译运行
```

### 5️⃣ Web 下载页

```bash
# 直接在浏览器中打开
cd youzhinanGW
# 使用任意 HTTP 服务器托管即可
# 例如: npx serve .
```

---

## ⚙️ 配置说明

后端服务的所有配置通过 `.env` 文件管理，参考 `.env.example` 模板：

| 配置项 | 必填 | 说明 |
|--------|------|------|
| `DB_HOST` | ✅ | MySQL 主机地址 |
| `DB_USER` | ✅ | 数据库用户名 |
| `DB_PASSWORD` | ✅ | 数据库密码 |
| `DB_NAME` | ✅ | 数据库名称 |
| `JWT_SECRET` | ✅ | JWT 签名密钥（至少32位） |
| `PORT` | ❌ | 服务端口，默认 3004 |
| `WECHAT_APPID` | ✅ | 微信小程序 AppID |
| `WECHAT_SECRET` | ✅ | 微信小程序 AppSecret |
| `ALIYUN_SMS_ACCESS_KEY_ID` | ❌ | 阿里云短信 AccessKey（短信登录需要） |
| `ALIYUN_SMS_ACCESS_KEY_SECRET` | ❌ | 阿里云短信 Secret（短信登录需要） |
| `EMAIL_USER` | ❌ | QQ 邮箱账号（邮箱登录需要） |
| `EMAIL_PASS` | ❌ | QQ 邮箱授权码（邮箱登录需要） |
| `GAODE_API_KEY` | ❌ | 高德地图 API Key（地图功能需要） |
| `ARK_API_KEY` | ❌ | 火山方舟 API Key（AI 对话需要） |

---

## 📡 API 接口概览

后端提供 20+ 个 RESTful API 模块：

| 模块 | 路径前缀 | 说明 |
|------|---------|------|
| 用户管理 | `/api/user` | 用户注册、登录、资料管理 |
| APP 专用 | `/api/app` | 快速注册、运营商登录、密码管理 |
| 场所信息 | `/api/info` | 场所 CRUD、搜索、浏览统计 |
| 分类管理 | `/api/category` | 分类增删改查 |
| AI 对话 | `/api/ai` | 智能对话、历史记录 |
| AI 模型 | `/api/ai-model` | 模型配置管理 |
| 语音服务 | `/api/speech` | 语音识别/合成代理 |
| 短信认证 | `/api/sms-auth` | 短信验证码发送/验证 |
| 邮箱认证 | `/api/email-auth` | 邮箱验证码发送/验证 |
| 微信登录 | `/api/wxlogin` | 微信小程序登录 |
| 高德地图 | `/api/gaode` | 地理编码/逆地理编码代理 |
| 图片上传 | `/api/images` | 图片上传、缩略图生成 |
| 抽奖活动 | `/api/lottery` | 积分抽奖 |
| 消息系统 | `/api/messages` | WebSocket 实时消息 |
| 附近搜索 | `/api/nearby` | 基于位置的附近场所 |
| 地区数据 | `/api/regions` | 省市区三级联动数据 |
| 用户投稿 | `/api/submissions` | 投稿提交与审核 |
| 后台管理 | `/api/admin` | 管理员操作接口 |
| 数据统计 | `/api/stats` | 平台数据统计 |
| 版本管理 | `/api/app-version` | APP 版本检测更新 |
| 客服系统 | `/api/customer-service` | 在线客服 |
| 关于页面 | `/api/about` | 关于我们内容 |
| 健康检查 | `/api/health` | 服务健康状态 |

---

## 🗄️ 数据库设计

主要数据表：

```
┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│   users      │     │    info       │     │  categories  │
├──────────────┤     ├──────────────┤     ├──────────────┤
│ id (PK)      │     │ id (PK)      │     │ id (PK)      │
│ openid       │     │ store_name   │     │ name         │
│ unionid      │     │ category (FK)│────▶│ created_at   │
│ username     │     │ province     │     │ updated_at   │
│ password     │     │ city         │     └──────────────┘
│ nick_name    │     │ district     │
│ avatar_url   │     │ address      │     ┌──────────────┐
│ is_admin     │     │ images (JSON)│     │  favorites   │
│ points       │     │ view_count   │     ├──────────────┤
│ created_at   │     │ created_at   │     │ id (PK)      │
└──────┬───────┘     └──────┬───────┘     │ user_id (FK) │──────▶ users
       │                    │              │ info_id (FK) │──────▶ info
       │                    │              └──────────────┘
       │                    │
       │              ┌─────┴────────┐     ┌──────────────┐
       │              │   visits     │     │  messages    │
       │              ├──────────────┤     ├──────────────┤
       └─────────────▶│ id (PK)      │     │ id (PK)      │
                      │ user_id (FK) │     │ sender_id    │
                      │ info_id (FK) │     │ receiver_id  │
                      │ visited_at   │     │ content      │
                      └──────────────┘     │ created_at   │
                                           └──────────────┘
```

---

## 🔒 安全说明

- 所有敏感配置（数据库密码、API 密钥等）通过 `.env` 文件管理，**不会提交到仓库**
- `config/api_keys.json` 已加入 `.gitignore`，不会泄露
- Android 签名密码存储在 `local.properties`，已加入 `.gitignore`
- 用户密码使用 bcrypt 算法加密存储
- JWT Token 认证保护所有需要登录的接口
- 生产环境建议启用 HTTPS 并设置正确的 CORS 域名

如发现安全漏洞，请**不要**在公开 Issue 中报告，请通过邮件联系维护者。

---

## 🤝 贡献指南

欢迎对本项目做出贡献！

1. Fork 本仓库
2. 创建功能分支 (`git checkout -b feature/amazing-feature`)
3. 提交更改 (`git commit -m 'Add some amazing feature'`)
4. 推送到分支 (`git push origin feature/amazing-feature`)
5. 提交 Pull Request

### 代码规范

- 后端：遵循 JavaScript Standard Style
- Android：遵循 Kotlin 编码规范
- 微信小程序：遵循微信小程序开发规范
- 提交信息：使用语义化提交（Conventional Commits）

---

## 📄 开源许可证

本项目基于 [MIT License](LICENSE) 开源。

---

## 📮 联系方式

- 项目主页：[GitHub](https://github.com/ShiJueTianChuang/youzhinan-v1)
- 官方网站：[https://your-domain.com](https://your-domain.com)

---

<div align="center">

**如果这个项目对你有帮助，请给个 ⭐ Star 支持一下！**

</div>
