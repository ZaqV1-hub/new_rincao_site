@echo off
setlocal

set "PORT=%~1"
if "%PORT%"=="" (
  for /f "usebackq tokens=1,* delims==" %%A in (".env.local") do (
    if /I "%%A"=="PORT" set "PORT=%%B"
  )
)
if "%PORT%"=="" set "PORT=3002"

cd /d "%~dp0.."

echo Projeto: %CD%
echo Porta do app: %PORT%

for /f "tokens=5" %%P in ('netstat -ano ^| findstr /R /C:":%PORT% .*LISTENING"') do (
  echo Parando processo PID %%P que esta usando a porta %PORT%
  taskkill /PID %%P /F >nul 2>nul
)

for /f "tokens=5" %%P in ('netstat -ano ^| findstr /R /C:":3002 .*LISTENING"') do (
  echo Parando processo PID %%P que esta usando a porta 3002
  taskkill /PID %%P /F >nul 2>nul
)

if exist node_modules (
  echo Limpando node_modules anterior...
  rmdir /S /Q node_modules
  if exist node_modules (
    echo Nao foi possivel remover node_modules. Feche editores, terminais e antivirus que estejam usando a pasta.
    goto :error
  )
)

if exist .next (
  echo Limpando build anterior...
  rmdir /S /Q .next
  if exist .next (
    echo Nao foi possivel remover .next.
    goto :error
  )
)

echo Rodando npm ci...
call npm ci
if errorlevel 1 goto :error
if not exist node_modules\next (
  echo npm ci terminou sem instalar o Next corretamente.
  goto :error
)

echo Rodando npm run build...
call npm run build
if errorlevel 1 goto :error

echo Sincronizando assets publicos para o runtime standalone...
call :sync_dir "public" ".next\standalone\public"
if errorlevel 1 goto :error

echo Sincronizando assets compilados do Next para o runtime standalone...
call :sync_dir ".next\static" ".next\standalone\.next\static"
if errorlevel 1 goto :error

echo.
echo Deploy preparado com sucesso.
echo Para subir o app novamente:
echo   for /f "usebackq tokens=1,* delims==" %%A in (".env.local") do @if not "%%A"=="" if not "%%A:~0,1%%"=="#" set "%%A=%%B"
echo   set ESTANCIA_SITE_STORAGE_ROOT=%CD%
echo   set HOSTNAME=127.0.0.1^&^& set PORT=%PORT%^&^& node .next\standalone\server.js
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

:error
echo.
echo Falha durante o deploy.
exit /b 1
