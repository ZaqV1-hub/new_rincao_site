[CmdletBinding()]
param(
  [Parameter(Mandatory = $true)]
  [ValidateSet("prod")]
  [string]$Environment
)

$ErrorActionPreference = "Stop"

$settings = @{
  prod = @{
    Port = 8061
    SharedRoot = "C:\SitesData\Rincao\prod"
    DeploymentRoot = "C:\Deploy\Rincao\prod"
  }
}

$config = $settings[$Environment]
$environmentFile = Join-Path ([string]$config.SharedRoot) ".env.local"
$logFile = Join-Path ([string]$config.DeploymentRoot) "logs\payment-sync-scheduled.log"
$logDirectory = Split-Path -Parent $logFile

New-Item -ItemType Directory -Force -Path $logDirectory | Out-Null

function Write-PaymentSyncLog {
  param([string]$Message)

  $timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss zzz"
  Add-Content -LiteralPath $logFile -Value "$timestamp $Message" -Encoding UTF8
}

if (-not (Test-Path -LiteralPath $environmentFile)) {
  Write-PaymentSyncLog "result=failed reason=environment_file_missing"
  throw "Arquivo de ambiente da conciliacao nao encontrado."
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
  Write-PaymentSyncLog "result=failed reason=operations_token_missing"
  throw "Token operacional da conciliacao nao configurado."
}

$headers = @{ Authorization = "Bearer $operationsToken" }
$body = @{
  recentDays = 7
  cancelAfterDays = 30
  cancelStale = $false
  limit = 50
} | ConvertTo-Json -Compress

try {
  $response = Invoke-RestMethod `
    -Method Post `
    -Uri "http://127.0.0.1:$([int]$config.Port)/api/ops/jobs/payment-sync" `
    -Headers $headers `
    -ContentType "application/json" `
    -Body $body `
    -TimeoutSec 1800

  $data = $response.data

  if (-not $response.ok -or $data.action -ne "payment_sync" -or -not $data.configured) {
    Write-PaymentSyncLog "result=failed reason=payment_sync_unavailable"
    throw "A rotina de conciliacao nao concluiu a verificacao."
  }

  $summary = "result=completed candidates=$($data.candidates) processed=$($data.processed) reconciled=$($data.reconciled) cancelled=$($data.cancelled) missing=$($data.missing) failed=$($data.failed)"
  Write-PaymentSyncLog $summary
  Write-Output $summary
} catch {
  if ($_.Exception.Message -notlike "A rotina de conciliacao nao concluiu*") {
    Write-PaymentSyncLog "result=failed reason=request_error type=$($_.Exception.GetType().Name)"
  }

  throw "A rotina diaria de conciliacao falhou; consulte o log operacional da VM."
} finally {
  $headers.Clear()
  $operationsToken = $null
}
