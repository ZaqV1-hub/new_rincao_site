@echo off
setlocal

cd /d "%~dp0.."

if not exist ".next\standalone\server.js" (
  echo Runtime standalone nao encontrado. Rode npm run build antes de sincronizar os assets.
  exit /b 1
)

call :sync_dir "public" ".next\standalone\public"
if errorlevel 1 exit /b 1

call :sync_dir ".next\static" ".next\standalone\.next\static"
if errorlevel 1 exit /b 1

echo Assets do standalone sincronizados.
exit /b 0

:sync_dir
set "SRC=%~1"
set "DEST=%~2"

if not exist "%SRC%" (
  echo Pasta de origem nao encontrada: %SRC%
  exit /b 1
)

if not exist "%DEST%" mkdir "%DEST%"

robocopy "%SRC%" "%DEST%" /E /NFL /NDL /NJH /NJS /NP >nul
if errorlevel 8 (
  echo Falha ao sincronizar %SRC% para %DEST%
  exit /b 1
)

exit /b 0
