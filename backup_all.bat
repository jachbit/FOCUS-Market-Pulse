@echo off
title F.O.C.U.S. Market Pulse - backup
rem Timestamped copies of the project files into backups\ (run before every edit session).
cd /d "%~dp0"
for /f %%i in ('powershell -NoProfile -Command "Get-Date -Format yyyyMMdd_HHmmss"') do set TS=%%i
if not exist backups mkdir backups
xcopy "pulse" "backups\pulse_%TS%\" /E /I /Q /Y >nul && echo   [OK] pulse\
xcopy "web\src" "backups\web_src_%TS%\" /E /I /Q /Y >nul && echo   [OK] web\src\
copy ".github\workflows\pulse.yml" "backups\pulse_yml_%TS%.yml" >nul && echo   [OK] .github\workflows\pulse.yml
copy "README.md" "backups\README_%TS%.md" >nul && echo   [OK] README.md
copy "start.bat" "backups\start_%TS%.bat" >nul && echo   [OK] start.bat
echo.
echo Backup done: backups\*_%TS%
