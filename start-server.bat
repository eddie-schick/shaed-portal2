@echo off
echo Starting Ford Marketplace Development Server...
cd /d "%~dp0"
npx vite --port 3000 --host
pause
