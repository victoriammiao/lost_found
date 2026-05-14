@echo off
chcp 65001 >nul
cd /d "%~dp0"

REM 若仓库根目录存在 .venv，则优先使用该虚拟环境
if exist "%~dp0..\.venv\Scripts\activate.bat" (
  call "%~dp0..\.venv\Scripts\activate.bat"
) else if exist "%~dp0.venv\Scripts\activate.bat" (
  call "%~dp0.venv\Scripts\activate.bat"
)

where python >nul 2>nul
if errorlevel 1 (
  echo [错误] 未找到 python，请先安装 Python 并加入 PATH。
  pause
  exit /b 1
)

echo [启动] backend-admin Flask ^(默认 http://0.0.0.0:3001^) ...
python app.py
pause
