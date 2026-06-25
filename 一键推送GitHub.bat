@echo off
chcp 65001 >nul
setlocal

set "GIT=C:\Users\admin\.workbuddy\vendor\PortableGit\mingw64\bin\git.exe"
set "REPO=C:\Users\admin\WorkBuddy\2026-06-21-15-31-50"
set "LOG=%REPO%\push-log.txt"

cd /d "%REPO%"

echo [%date% %time%] 开始推送... >> "%LOG%"

:: 去除代理环境变量
set HTTP_PROXY=
set HTTPS_PROXY=
set http_proxy=
set https_proxy=

:: 清理锁文件
if exist ".git\index.lock" del /f ".git\index.lock" >nul 2>&1

:: 添加文件
"%GIT%" add "产品开发进度_管理工具.html" "index.html" >> "%LOG%" 2>&1
if %errorlevel% neq 0 (
    echo ❌ git add 失败，查看 push-log.txt
    pause
    exit /b 1
)

:: 检查是否有改动
"%GIT%" diff --cached --stat >> "%LOG%" 2>&1
"%GIT%" diff --cached --quiet >nul 2>&1
if %errorlevel% equ 0 (
    echo ✅ 没有需要推送的改动
    pause
    exit /b 0
)

:: 提交
"%GIT%" commit -m "手动推送: %date% %time%" >> "%LOG%" 2>&1
if %errorlevel% neq 0 (
    echo ❌ git commit 失败，查看 push-log.txt
    pause
    exit /b 1
)

:: 推送
"%GIT%" push origin main >> "%LOG%" 2>&1
if %errorlevel% neq 0 (
    echo ❌ git push 失败，查看 push-log.txt
    pause
    exit /b 1
)

echo ✅ 推送成功！>> "%LOG%"
echo ✅ 推送成功！—— https://2621559957.github.io/runyu-dev-progress/
pause
