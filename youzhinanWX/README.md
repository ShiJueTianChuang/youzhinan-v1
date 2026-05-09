# 💬 有指南 - 微信小程序 (youzhinanWX)

基于微信小程序原生框架开发的移动端应用，提供场所信息查询、AI 对话、用户管理等功能。

## 功能模块

### 用户端

| 页面 | 路径 | 功能 |
|------|------|------|
| 首页 | `pages/home/` | 场所信息列表、分类筛选、距离排序 |
| 搜索 | `pages/index/` | 关键词搜索、城市筛选、分类筛选 |
| 场所详情 | `pages/detail/` | 场所信息、图片浏览、导航、收藏 |
| 个人中心 | `pages/mine/` | 用户信息、登录/注册、设置 |
| 收藏列表 | `pages/favorites/` | 已收藏的场所管理 |
| 消息中心 | `pages/messages/` | 系统消息与通知 |
| 关于我们 | `pages/about/` | 应用介绍与联系方式 |

### 管理端

| 页面 | 路径 | 功能 |
|------|------|------|
| 管理后台 | `pages/backend/` | 后台管理入口 |
| 信息管理 | `pages/infoManagement/` | 场所信息增删改查 |
| 分类管理 | `pages/categoryManagement/` | 分类增删改查 |
| 用户管理 | `pages/userManagement/` | 用户列表与管理 |
| 管理面板 | `pages/manage/` | 管理员操作面板 |

## 项目结构

```
youzhinanWX/
├── pages/                      # 页面目录
│   ├── home/                       # 首页
│   ├── index/                      # 搜索页
│   ├── mine/                       # 个人中心
│   ├── detail/                     # 场所详情
│   ├── favorites/                  # 收藏
│   ├── messages/                   # 消息
│   ├── about/                      # 关于
│   ├── manage/                     # 管理面板
│   ├── backend/                    # 后台入口
│   ├── userManagement/             # 用户管理
│   ├── infoManagement/             # 信息管理
│   └── categoryManagement/         # 分类管理
│
├── custom-tab-bar/             # 自定义底部导航栏
│   ├── index.js
│   ├── index.json
│   ├── index.wxml
│   └── index.wxss
│
├── utils/                       # 工具模块
│   ├── constants.js                # 全局配置（API地址等）
│   ├── commonUtils.js              # 通用工具函数
│   ├── favoriteUtil.js             # 收藏管理
│   ├── geocodeCache.js             # 地理编码缓存
│   ├── provinceCityUtil.js         # 省市数据处理
│   └── qqmap-wx-jssdk.min.js      # 腾讯地图 SDK
│
├── images/                      # 静态图片资源
├── app.js                       # 小程序入口
├── app.json                     # 小程序配置
├── app.wxml                     # 小程序根模板
├── db_init.sql                  # 数据库初始化脚本
├── project.config.json          # 项目配置
└── sitemap.json                 # 站点地图
```

## 快速开始

### 1. 导入项目

1. 打开[微信开发者工具](https://developers.weixin.qq.com/miniprogram/dev/devtools/download.html)
2. 选择「导入项目」
3. 目录选择 `youzhinanWX`
4. 填入你的 AppID
5. 点击「确定」

### 2. 配置后端地址

编辑 `utils/constants.js`，修改 `API_BASE_URL` 为你的后端地址：

```javascript
const API_BASE_URL = 'https://your-backend-url';
```

### 3. 初始化数据库

```bash
mysql -u root -p < db_init.sql
```

### 4. 编译运行

在微信开发者工具中点击「编译」即可预览。

## 自定义 TabBar

本项目使用自定义 TabBar，配置位于 `custom-tab-bar/` 目录：

- **首页**：场所信息列表
- **搜索**：搜索与筛选
- **我的**：个人中心

如需修改 Tab 项，编辑 `app.json` 中的 `tabBar.list` 和 `custom-tab-bar/index.js`。

## 权限说明

| 权限 | 用途 |
|------|------|
| `scope.userLocation` | 获取用户位置，用于距离计算和附近搜索 |

## 数据库初始化

项目包含 `db_init.sql` 文件，用于初始化 MySQL 数据库：

- 创建 `info_management` 数据库
- 创建 `categories`、`info`、`users`、`visits`、`favorites` 等表
- 插入初始分类数据
- 插入测试用户数据

```bash
mysql -u root -p < db_init.sql
```

## 常见问题

### 登录失败
- 检查后端服务是否启动
- 检查 `constants.js` 中的 API 地址是否正确
- 检查微信小程序 AppID 和 AppSecret 配置

### 头像不显示
- 检查头像 URL 是否可访问
- 检查后端是否成功下载和存储头像

### 定位失败
- 检查是否授予位置权限
- 检查微信开发者工具中的定位模拟设置
