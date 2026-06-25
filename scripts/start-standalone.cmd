@echo off
setlocal

cd /d "%~dp0.."

for /f "usebackq tokens=1,* delims==" %%A in (".env.local") do (
  if not "%%A"=="" if not "%%A:~0,1%%"=="#" set "%%A=%%B"
)

if "%PORT%"=="" set "PORT=3002"
if "%NODE_ENV%"=="" set "NODE_ENV=production"
if "%HOSTNAME%"=="" set "HOSTNAME=127.0.0.1"

set "RINCAO_SITE_STORAGE_ROOT=%CD%"

echo Projeto: %CD%
echo Porta: %PORT%
echo Ambiente: %NODE_ENV%

call scripts\sync-standalone-assets.cmd
if errorlevel 1 exit /b 1

node .next\standalone\server.js
