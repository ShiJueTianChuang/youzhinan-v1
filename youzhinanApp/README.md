# 📱 有指南 - Android 客户端 (youyiyoubanAPP)

基于 Kotlin + Jetpack Compose 构建的 Android 原生应用，采用 Material Design 3 设计语言。

## 技术栈

| 技术 | 版本 | 用途 |
|------|------|------|
| Kotlin | 2.2.10 | 开发语言 |
| Jetpack Compose | BOM 2025.02.00 | 声明式 UI |
| Material 3 | - | 设计系统 |
| Retrofit | 2.11.0 | 网络请求 |
| OkHttp | 4.12.0 | HTTP 客户端 |
| Coil | 2.4.0 | 图片加载 |
| Navigation Compose | 2.8.9 | 页面导航 |
| Accompanist | 0.32.0 | 系统UI/权限 |
| Google Location Services | 21.1.0 | 定位 |

## 运行要求

- Android Studio (最新稳定版)
- JDK 11+
- Min SDK 26 (Android 8.0)
- Target SDK 36

## 快速开始

### 1. 打开项目

使用 Android Studio 打开 `youyiyoubanAPP` 目录。

### 2. 配置签名

在 `local.properties` 中添加签名信息（此文件不会提交到仓库）：

```properties
KEYSTORE_PASSWORD=your_keystore_password
KEY_ALIAS=your_key_alias
KEY_PASSWORD=your_key_password
```

### 3. 运行

选择目标设备，点击 Run 即可。

## 项目结构

```
app/src/main/java/com/example/youzhinan/
├── data/
│   └── api/                    # 网络请求层
│       ├── RetrofitClient.kt        # Retrofit 客户端配置
│       ├── ApiService.kt            # 主要业务 API 接口
│       ├── AiChatApi.kt             # AI 对话接口
│       ├── AmapApiClient.kt         # 高德地图 API
│       ├── AmapApiService.kt        # 高德地图接口定义
│       ├── ApiModels.kt             # API 数据模型
│       ├── ApiResponse.kt           # 统一响应模型
│       ├── SmsAuthApi.kt            # 短信认证接口
│       ├── EmailLoginApi.kt         # 邮箱登录接口
│       ├── AppVersionApi.kt         # 版本更新接口
│       └── ChangePasswordApi.kt     # 修改密码接口
│
├── ui/
│   ├── pages/                  # 页面组件
│   │   ├── HomePage.kt              # 首页（场所列表）
│   │   ├── SearchPage.kt            # 搜索页
│   │   ├── AIChatPage.kt            # AI 对话页
│   │   ├── AIChatSettingsPage.kt    # AI 对话设置
│   │   ├── AIModelBindPage.kt       # AI 模型绑定
│   │   ├── ProfilePage.kt           # 个人中心
│   │   ├── FavoritesPage.kt         # 收藏列表
│   │   ├── MessagesPage.kt          # 消息中心
│   │   ├── LotteryPage.kt           # 积分抽奖
│   │   ├── SubmitPage.kt            # 信息投稿
│   │   ├── SettingsPage.kt          # 设置页
│   │   ├── AboutPage.kt             # 关于页面
│   │   ├── HelpFeedbackPage.kt      # 帮助反馈
│   │   ├── VersionInfoPage.kt       # 版本信息
│   │   ├── PrivacyPolicyPage.kt     # 隐私政策
│   │   ├── PersonalInfoPage.kt      # 个人信息编辑
│   │   ├── ChangePasswordPage.kt    # 修改密码
│   │   ├── SmsLoginPage.kt          # 短信登录
│   │   ├── SmsRegisterPage.kt       # 短信注册
│   │   ├── EmailAuthPage.kt         # 邮箱认证
│   │   ├── PasswordLoginPage.kt     # 密码登录
│   │   ├── ForgotPasswordPage.kt    # 忘记密码
│   │   ├── InfoDetailPage.kt        # 场所详情
│   │   ├── LocalImagePage.kt        # 本地图片查看
│   │   ├── MySubmissionsPage.kt     # 我的投稿
│   │   └── AgreementComponents.kt   # 协议组件
│   │
│   ├── components/             # 通用组件
│   │   ├── NetworkImage.kt          # 网络图片加载
│   │   └── PerformanceOverlay.kt    # 性能监控覆盖层
│   │
│   └── theme/                  # 主题配置
│       ├── Color.kt                 # 颜色定义
│       ├── Theme.kt                 # 主题配置
│       └── Type.kt                  # 字体排版
│
├── utils/                       # 工具类
│   ├── LocationHelper.kt            # 定位辅助
│   ├── NetworkMonitor.kt            # 网络状态监控
│   ├── DistanceUtils.kt             # 距离计算
│   ├── FavoritesManager.kt          # 收藏管理
│   ├── PasswordValidator.kt         # 密码强度验证
│   ├── ApiErrorUtil.kt              # API 错误处理
│   ├── WavAudioRecorder.kt          # WAV 录音
│   ├── XunfeiSpeechRecognizer.kt    # 讯飞语音识别
│   └── XunfeiSpeechSynthesizer.kt   # 讯飞语音合成
│
├── viewmodel/                   # ViewModel 层
│   ├── HomeViewModel.kt             # 首页逻辑
│   ├── SearchViewModel.kt           # 搜索逻辑
│   ├── ProfileViewModel.kt          # 个人中心逻辑
│   ├── LotteryViewModel.kt          # 抽奖逻辑
│   ├── VersionInfoViewModel.kt      # 版本信息逻辑
│   ├── HelpFeedbackViewModel.kt     # 帮助反馈逻辑
│   └── SubmitViewModel.kt           # 投稿逻辑
│
├── MainActivity.kt              # 主 Activity
└── YouyoubanApplication.kt      # Application 类
```

## 构建说明

### Debug 构建

直接在 Android Studio 中选择 `debug` 变体运行即可，无需签名配置。

### Release 构建

1. 确保 `local.properties` 中配置了签名信息
2. 确保 `app/my-release-key.jks` 签名文件存在
3. 选择 `release` 变体构建

Release 构建启用了代码混淆（R8）和资源压缩。
