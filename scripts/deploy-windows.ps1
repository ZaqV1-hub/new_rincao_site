param(
  [int]$Port = 3002
)

$ErrorActionPreference = "Stop"

$projectRoot = Split-Path -Parent $PSScriptRoot
Set-Location $projectRoot

Write-Host "Projeto:" $projectRoot
Write-Host "Porta do app:" $Port

$connections = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue

if ($connections) {
  $processIds = $connections | Select-Object -ExpandProperty OwningProcess -Unique

  foreach ($processId in $processIds) {
    $process = Get-Process -Id $processId -ErrorAction SilentlyContinue

    if ($process -and $process.ProcessName -eq "node") {
      Write-Host "Parando processo node PID" $processId "que esta usando a porta" $Port
      Stop-Process -Id $processId -Force
    }
  }

  Start-Sleep -Seconds 2
}

Write-Host "Rodando npm ci..."
npm ci
if ($LASTEXITCODE -ne 0) {
  throw "npm ci falhou."
}

Write-Host "Rodando npm run build..."
npm run build
if ($LASTEXITCODE -ne 0) {
  throw "npm run build falhou."
}

Write-Host "Sincronizando assets publicos para o runtime standalone..."
robocopy public .next\standalone\public /E /NFL /NDL /NJH /NJS /NP | Out-Null
if ($LASTEXITCODE -ge 8) {
  throw "Falha ao copiar a pasta public para .next\\standalone\\public."
}

Write-Host "Sincronizando assets compilados do Next para o runtime standalone..."
robocopy .next\static .next\standalone\.next\static /E /NFL /NDL /NJH /NJS /NP | Out-Null
if ($LASTEXITCODE -ge 8) {
  throw "Falha ao copiar .next\\static para .next\\standalone\\.next\\static."
}

Write-Host ""
Write-Host "Deploy preparado com sucesso."
Write-Host "Para subir o app novamente:"
Write-Host "  Get-Content .env.local | ForEach-Object { if ($_ -match '^[^#=]+=' ) { `$name, `$value = `$_ -split '=', 2; [Environment]::SetEnvironmentVariable(`$name, `$value, 'Process') } }"
Write-Host "  `$env:ESTANCIA_SITE_STORAGE_ROOT='$projectRoot'"
Write-Host "  `$env:HOSTNAME='127.0.0.1'; `$env:PORT='$Port'; node .next\\standalone\\server.js"
