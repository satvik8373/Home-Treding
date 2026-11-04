@echo off
setlocal
cd /d "%~dp0"
where node >nul 2>&1
if errorlevel 1 (
  echo Install Node.js 22.18 or newer, then run this file again.
  pause
  exit /b 1
)
if not exist node_modules (
  call npm ci
  if errorlevel 1 goto failed
)
call npm run build
if errorlevel 1 goto failed
start "" "http://127.0.0.1:4310"
call npm start
if errorlevel 1 goto failed
exit /b 0
:failed
echo.
echo Startup stopped. Read the error above. If 009 is already running, use its existing browser window.
pause
exit /b 1
