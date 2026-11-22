@echo off
setlocal
cd /d "%~dp0"
where node >nul 2>&1 || (echo EPhone needs Node.js 22 or later. & exit /b 1)
where npm >nul 2>&1 || (echo EPhone needs npm. & exit /b 1)
node -e "if (+process.versions.node.split('.')[0] < 22) { console.error('EPhone needs Node.js 22 or later.'); process.exit(1) }" || exit /b 1
call npm ci --include=dev --no-audit --no-fund || exit /b 1
call npm run build || exit /b 1
node build/server/index.js %*
