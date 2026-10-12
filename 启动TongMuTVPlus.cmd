@echo off
chcp 65001 >nul
setlocal
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo Please install Node.js 24, then double-click this file again.
  pause
  exit /b 1
)
node scripts\start-local.cjs
if errorlevel 1 (
  echo.
  echo Startup failed. Please keep the error above for troubleshooting.
  pause
)
endlocal
