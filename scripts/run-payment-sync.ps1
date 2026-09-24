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

function Get-PaymentSyncErrorCategory {
  param([string]$Note)

  if ($Note -match "^cielo_ecommerce_error_(\d{3})") {
    return "cielo_http_$($Matches[1])"
  }

  if ($Note -match "cielo_payment_id_invalid") { return "invalid_payment_id" }
  if ($Note -match "payment_reference_mismatch") { return "reference_mismatch" }
  if ($Note -match "payment_purchase_not_found") { return "purchase_not_found" }
  if ($Note -match "abort|timed?\s*out|timeout") { return "timeout" }
  if ($Note -match "fetch failed|ECONN|ENOTFOUND|EAI_AGAIN") { return "network" }

  return "other"
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
  limit = 700
  perDayLimit = 100
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

  $purchaseStatusCounts = @{
    conc = 0
    pend = 0
    canc = 0
    unknown = 0
  }
  $gatewayStatusCounts = @{}
  $errorCategoryCounts = @{}

  foreach ($item in @($data.items)) {
    $purchaseStatus = [string]$item.purchaseStatus
    if (-not $purchaseStatusCounts.ContainsKey($purchaseStatus)) {
      $purchaseStatus = "unknown"
    }
    $purchaseStatusCounts[$purchaseStatus] += 1

    if ($null -ne $item.gatewayStatus) {
      $gatewayStatus = [string]$item.gatewayStatus
      if ($gatewayStatus -notmatch "^\d+$") { $gatewayStatus = "other" }
      if (-not $gatewayStatusCounts.ContainsKey($gatewayStatus)) {
        $gatewayStatusCounts[$gatewayStatus] = 0
      }
      $gatewayStatusCounts[$gatewayStatus] += 1
    }

    if ($item.result -eq "error") {
      $category = Get-PaymentSyncErrorCategory -Note ([string]$item.note)
      if (-not $errorCategoryCounts.ContainsKey($category)) {
        $errorCategoryCounts[$category] = 0
      }
      $errorCategoryCounts[$category] += 1
    }
  }

  $purchaseStatusSummary = ($purchaseStatusCounts.GetEnumerator() |
    Sort-Object Name |
    ForEach-Object { "$($_.Name):$($_.Value)" }) -join ","
  $gatewayStatusSummary = ($gatewayStatusCounts.GetEnumerator() |
    Sort-Object Name |
    ForEach-Object { "$($_.Name):$($_.Value)" }) -join ","
  $errorCategorySummary = ($errorCategoryCounts.GetEnumerator() |
    Sort-Object Name |
    ForEach-Object { "$($_.Name):$($_.Value)" }) -join ","
  $summary = "result=completed candidates=$($data.candidates) processed=$($data.processed) reconciled=$($data.reconciled) cancelled=$($data.cancelled) missing=$($data.missing) failed=$($data.failed) purchase_status=[$purchaseStatusSummary] gateway_status=[$gatewayStatusSummary] error_category=[$errorCategorySummary]"
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
