@echo off
chcp 65001
echo ========================================
echo   信息管理系统 - 后端安装包打包工具
echo ========================================
echo.

set PROJECT_DIR=%~dp0
set PACKAGE_NAME=有壹有伴后端指南
set PACKAGE_VERSION=V1.1.3
set OUTPUT_DIR=%PROJECT_DIR%dist

echo 项目目录: %PROJECT_DIR%
echo 打包名称: %PACKAGE_NAME%-%PACKAGE_VERSION%
echo 输出目录: %OUTPUT_DIR%
echo.

REM 创建输出目录
if not exist "%OUTPUT_DIR%" (
    mkdir "%OUTPUT_DIR%"
    echo 已创建输出目录
)

REM 删除旧的打包文件
if exist "%OUTPUT_DIR%\%PACKAGE_NAME%-%PACKAGE_VERSION%.zip" (
    del "%OUTPUT_DIR%\%PACKAGE_NAME%-%PACKAGE_VERSION%.zip"
    echo 已删除旧的打包文件
)

echo.
echo ========================================
echo   正在打包核心文件...
echo ========================================
echo.

REM 使用 PowerShell 创建压缩包
powershell -Command "& {
    $source = @(
        'server.js',
        'package.json',
        '.env',
        'config',
        'routes',
        'models',
        'middleware',
        'utils',
        'public',
        'index.html',
        'login.html',
        'register.html',
        'reset-password.html',
        'home.html',
        'style.css',
        'script.js'
    )
    
    $dest = '%OUTPUT_DIR%\%PACKAGE_NAME%-%PACKAGE_VERSION%.zip'
    
    Compress-Archive -Path $source -DestinationPath $dest -Force
    
    Write-Host '打包完成！' -ForegroundColor Green
    Write-Host ''
    Write-Host '安装包位置:' $dest -ForegroundColor Cyan
}"

echo.
echo ========================================
echo   安装包已生成！
echo ========================================
echo.
echo 安装包包含以下内容：
echo   - server.js              (主入口文件)
echo   - package.json           (依赖配置)
echo   - .env                   (环境配置)
echo   - config/                (配置目录)
echo   - routes/                (路由目录)
echo   - models/                (模型目录)
echo   - middleware/            (中间件目录)
echo   - utils/                 (工具函数目录)
echo   - public/                (公共资源)
echo.
echo 安装步骤：
echo   1. 将压缩包上传到服务器 /www/wwwroot/ 目录
echo   2. 解压到 info-management-system/ 目录
echo   3. 进入目录执行: npm install
echo   4. 启动服务: pm2 start server.js --name info-management-system
echo.
echo ========================================
echo.

pause
