# 🌐 有指南 - Web 下载页 (youzhinanGW)

提供 Android APP 下载服务的响应式网页，支持移动端和桌面端访问。

## 功能

- APP 下载按钮（Android APK）
- 应用介绍与功能展示
- 响应式设计，适配各种屏幕尺寸
- Google Fonts (Inter) 字体服务

## 项目结构

```
youzhinanGW/
├── index.html                  # 下载页面
├── script.js                   # 页面交互逻辑
├── style.css                   # 页面样式（响应式）
├── logo.png                    # 应用 Logo
└── downloads/                  # APK 下载目录
    └── youzhinan-v1.2.5.apk        # 最新安装包
```

## 快速开始

### 本地预览

```bash
# 使用任意 HTTP 服务器
npx serve .

# 或使用 Python
python -m http.server 8080
```

### 部署

将整个目录部署到任意静态文件服务器即可，如 Nginx、Apache、Vercel 等。

### 更新 APK

1. 将新的 APK 文件放入 `downloads/` 目录
2. 更新 `index.html` 中的下载链接和版本号

## 自定义

- 修改 `style.css` 调整页面样式
- 修改 `index.html` 更新应用介绍内容
- 替换 `logo.png` 更换应用图标
