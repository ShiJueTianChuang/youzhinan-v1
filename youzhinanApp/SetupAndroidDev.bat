@echo off
chcp 65001 >nul 2>&1
title Android Dev Migration

echo ================================================
echo   Move Android Dev to D:\AndroidDev
echo ================================================
echo.
echo Target:
echo   D:\AndroidDev\
echo   +-- IDE\       (Android Studio)
echo   +-- SDK\       (Android SDK)
echo   +-- JDK\       (JDK JBR 21)
echo   +-- Gradle\    (Gradle cache)
echo   +-- Projects\  (Code)
echo   +-- Keystore\  (Signing key backup)
echo.
pause

echo.
echo [1/7] Create directories...
mkdir "D:\AndroidDev\IDE" 2>nul
mkdir "D:\AndroidDev\SDK" 2>nul
mkdir "D:\AndroidDev\JDK" 2>nul
mkdir "D:\AndroidDev\Gradle" 2>nul
mkdir "D:\AndroidDev\Projects" 2>nul
mkdir "D:\AndroidDev\Keystore" 2>nul
echo [OK] Directories created

echo.
echo [2/7] Move Android Studio IDE...
echo   D:\Android Studio -- D:\AndroidDev\IDE
echo   (About 3GB, please wait...)
if not exist "D:\AndroidDev\IDE\bin" (
    xcopy "D:\Android Studio\*" "D:\AndroidDev\IDE\" /E /I /Q /Y
    echo [OK] IDE moved
) else (
    echo [SKIP] IDE already moved
)

echo.
echo [3/7] Move Android SDK...
echo   D:\AndroidSdk -- D:\AndroidDev\SDK
if not exist "D:\AndroidDev\SDK\platforms" (
    xcopy "D:\AndroidSdk\*" "D:\AndroidDev\SDK\" /E /I /Q /Y
    echo [OK] SDK moved
) else (
    echo [SKIP] SDK already moved
)

echo.
echo [4/7] Copy JDK (JBR)...
echo   D:\AndroidDev\IDE\jbr -- D:\AndroidDev\JDK
if not exist "D:\AndroidDev\JDK\bin\java.exe" (
    xcopy "D:\AndroidDev\IDE\jbr\*" "D:\AndroidDev\JDK\" /E /I /Q /Y
    echo [OK] JDK copied
) else (
    echo [SKIP] JDK already copied
)

echo.
echo [5/7] Move Gradle cache...
echo   C:\Users\LDF\.gradle -- D:\AndroidDev\Gradle
if not exist "D:\AndroidDev\Gradle\wrapper" (
    xcopy "C:\Users\LDF\.gradle\*" "D:\AndroidDev\Gradle\" /E /I /Q /Y
    echo [OK] Gradle cache copied
) else (
    echo [SKIP] Gradle cache already moved
)

echo.
echo [6/7] Move projects...
if not exist "D:\AndroidDev\Projects\youyiyoubanapp\build.gradle.kts" (
    xcopy "D:\Users\LDF\Desktop\youyiyoubanapp" "D:\AndroidDev\Projects\youyiyoubanapp\" /E /I /Q /Y
    echo [OK] youyiyoubanapp copied
) else (
    echo [SKIP] youyiyoubanapp already moved
)
if not exist "D:\AndroidDev\Projects\info-management-system\server.js" (
    xcopy "D:\Users\LDF\Desktop\info-management-system" "D:\AndroidDev\Projects\info-management-system\" /E /I /Q /Y
    echo [OK] info-management-system copied
) else (
    echo [SKIP] info-management-system already moved
)

echo.
echo [7/7] Update config and env vars...
copy /Y "D:\AndroidDev\Projects\youyiyoubanapp\app\my-release-key.jks" "D:\AndroidDev\Keystore\my-release-key.jks" >nul 2>&1

echo sdk.dir=D\:\\AndroidDev\\SDK> "D:\AndroidDev\Projects\youyiyoubanapp\local.properties"

powershell -Command "(Get-Content 'D:\AndroidDev\Projects\youyiyoubanapp\gradle.properties') -replace 'org\.gradle\.java\.home=.*', 'org.gradle.java.home=D\\:\\AndroidDev\\JDK' | Set-Content 'D:\AndroidDev\Projects\youyiyoubanapp\gradle.properties'"

powershell -Command "[System.Environment]::SetEnvironmentVariable('GRADLE_USER_HOME', 'D:\AndroidDev\Gradle', 'User'); [System.Environment]::SetEnvironmentVariable('ANDROID_HOME', 'D:\AndroidDev\SDK', 'User'); [System.Environment]::SetEnvironmentVariable('ANDROID_SDK_ROOT', 'D:\AndroidDev\SDK', 'User'); [System.Environment]::SetEnvironmentVariable('JAVA_HOME', 'D:\AndroidDev\\JDK', 'User')"

echo [OK] Config updated, env vars set

echo.
echo ================================================
echo   ALL DONE!
echo ================================================
echo.
echo D:\AndroidDev contents:
dir "D:\AndroidDev" /B
echo.
echo IMPORTANT:
echo   1. Open Android Studio, set SDK path to D:\AndroidDev\SDK
echo   2. After confirming build works, delete old dirs:
echo      - D:\Users\LDF\Desktop\youyiyoubanapp
echo      - D:\Users\LDF\Desktop\info-management-system
echo      - C:\Users\LDF\.gradle
echo   3. Reboot PC to apply env vars
echo.
pause
