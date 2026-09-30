[CmdletBinding()]
param(
  [Parameter(Mandatory = $true)]
  [ValidateSet("prod", "hml")]
  [string]$Environment
)

$ErrorActionPreference = "Stop"

$settings = @{
  prod = @{
    Port = 8061
    SharedRoot = "C:\SitesData\Rincao\prod"
    DeploymentRoot = "C:\Deploy\Rincao\prod"
  }
  hml = @{
    Port = 8062
    SharedRoot = "C:\SitesData\Rincao\hml"
    DeploymentRoot = "C:\Deploy\Rincao\hml"
  }
}

$config = $settings[$Environment]
$environmentFile = Join-Path ([string]$config.SharedRoot) ".env.local"
$logFile = Join-Path ([string]$config.DeploymentRoot) "logs\cash-auto-close-scheduled.log"
New-Item -ItemType Directory -Force -Path (Split-Path -Parent $logFile) | Out-Null

function Write-CashAutoCloseLog {
  param([string]$Message)

  $timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss zzz"
  Add-Content -LiteralPath $logFile -Value "$timestamp $Message" -Encoding UTF8
}

if (-not (Test-Path -LiteralPath $environmentFile)) {
  Write-CashAutoCloseLog "result=failed reason=environment_file_missing"
  throw "Arquivo de ambiente do fechamento automatico nao encontrado."
}

$operationsToken = $null
Get-Content -LiteralPath $environmentFile | ForEach-Object {
  $line = $_.Trim()
  if (-not $line -or $line.StartsWith("#") -or -not $line.Contains("=")) {
    return
  }

  $name, $value = $line -split "=", 2
  if ($name.Trim() -eq "INGRESSO_OPERATIONS_API_TOKEN") {
    $operationsToken = $value.Trim().Trim('"').Trim("'")
  }
}

if (-not $operationsToken) {
  Write-CashAutoCloseLog "result=failed reason=operations_token_missing"
  throw "Token operacional do fechamento automatico nao configurado."
}

$headers = @{ Authorization = "Bearer $operationsToken" }
$body = @{
  reason = "Fechamento automatico diario a meia-noite"
  actor = @{ name = "scheduler" }
} | ConvertTo-Json -Compress

try {
  $response = Invoke-RestMethod `
    -Method Post `
    -Uri "http://127.0.0.1:$([int]$config.Port)/api/ops/cash-closures/auto-close" `
    -Headers $headers `
    -ContentType "application/json" `
    -Body $body `
    -TimeoutSec 120

  if (-not $response.ok -or $response.data.action -ne "auto_close") {
    Write-CashAutoCloseLog "result=failed reason=unexpected_api_response"
    throw "O fechamento automatico nao foi confirmado pela aplicacao."
  }

  Write-CashAutoCloseLog "result=success closed_count=$([int]$response.data.closedCount)"
} catch {
  if ($_.Exception.Message -notmatch "nao foi confirmado") {
    Write-CashAutoCloseLog "result=failed reason=request_failed"
  }
  throw
} finally {
  $operationsToken = $null
}
