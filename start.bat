@echo off
title F.O.C.U.S. Market Pulse - Jachbit 2026
rem Local preview: refresh the data (yfinance, no keys), then open the site at http://localhost:8793
cd /d "%~dp0"
echo Fetching the data (about a minute)...
python pulse\build.py
if not exist "web\node_modules" (
  echo Installing the site packages...
  pushd web
  call npm install --no-audit --no-fund
  popd
)
pushd web
call npm run dev -- --port 8793 --open
popd
