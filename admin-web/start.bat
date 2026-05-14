@echo off
chcp 65001 >nul
cd /d "%~dp0"

where npm >nul 2>nul
if errorlevel 1 (
  echo [错误] 未找到 npm，请先安装 Node.js 并加入 PATH。
  pause
  exit /b 1
)

if not exist "node_modules\" (
  echo [提示] 未检测到 node_modules，正在执行 npm install ...
  call npm install
  if errorlevel 1 (
    echo [错误] npm install 失败。
    pause
    exit /b 1
  )
)

echo [启动] admin-web 开发服务器 ^(Vite^) ...
call npm run dev
pause
