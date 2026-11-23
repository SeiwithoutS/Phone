@echo off
setlocal
cd /d "%~dp0" || goto failed
where node >nul 2>&1 || (echo EPhone needs Node.js 22 or later. & goto failed)
where npm >nul 2>&1 || (echo EPhone needs npm. & goto failed)
node scripts/start.mjs --build %* || goto failed
exit /b 0

:failed
echo.
echo EPhone did not start. Check the error above.
if not defined CI pause
exit /b 1
