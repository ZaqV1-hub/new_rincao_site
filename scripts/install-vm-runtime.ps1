[CmdletBinding()]
param(
  [Parameter(Mandatory = $true)]
  [ValidateSet("prod", "hml")]
  [string]$Environment
)

$ErrorActionPreference = "Stop"

$taskNames = @{
  prod = "NovoSiteRincaoNext8061"
  hml = "NovoSiteRincaoNext8062"
}

$opsRoot = "C:\Deploy\Rincao\ops"
$sourceScript = Join-Path $PSScriptRoot "start-vm-runtime.ps1"
$installedScript = Join-Path $opsRoot "start-vm-runtime.ps1"
$taskName = $taskNames[$Environment]

New-Item -ItemType Directory -Force -Path $opsRoot | Out-Null
Copy-Item -LiteralPath $sourceScript -Destination $installedScript -Force

$action = New-ScheduledTaskAction `
  -Execute "powershell.exe" `
  -Argument "-NoProfile -ExecutionPolicy Bypass -File `"$installedScript`" -Environment $Environment"
$trigger = New-ScheduledTaskTrigger -AtStartup
$principal = New-ScheduledTaskPrincipal -UserId "SYSTEM" -LogonType ServiceAccount -RunLevel Highest
$settings = New-ScheduledTaskSettingsSet `
  -StartWhenAvailable `
  -RestartCount 3 `
  -RestartInterval (New-TimeSpan -Minutes 1) `
  -ExecutionTimeLimit ([TimeSpan]::Zero) `
  -MultipleInstances IgnoreNew

$existingTask = Get-ScheduledTask -TaskName $taskName -ErrorAction SilentlyContinue
if ($existingTask -and $existingTask.State -eq "Running") {
  Stop-ScheduledTask -TaskName $taskName
  $deadline = (Get-Date).AddSeconds(20)
  while ((Get-ScheduledTask -TaskName $taskName).State -eq "Running" -and (Get-Date) -lt $deadline) {
    Start-Sleep -Milliseconds 250
  }
}

Register-ScheduledTask `
  -TaskName $taskName `
  -Action $action `
  -Trigger $trigger `
  -Principal $principal `
  -Settings $settings `
  -Force | Out-Null

Write-Host "Tarefa instalada: $taskName"

$paymentSyncSourceScript = Join-Path $PSScriptRoot "run-payment-sync.ps1"
if (-not (Test-Path -LiteralPath $paymentSyncSourceScript)) {
  throw "Script de conciliacao de pagamentos nao encontrado em $paymentSyncSourceScript."
}

$paymentSyncTokens = $null
$paymentSyncParseErrors = $null
[System.Management.Automation.Language.Parser]::ParseFile(
  $paymentSyncSourceScript,
  [ref]$paymentSyncTokens,
  [ref]$paymentSyncParseErrors
) | Out-Null

if ($paymentSyncParseErrors.Count -gt 0) {
  throw "Script de conciliacao de pagamentos contem erro de sintaxe: $($paymentSyncParseErrors[0].Message)"
}

if ($Environment -eq "prod") {
  $paymentSyncTaskName = "NovoSiteRincaoPaymentSync"
  $paymentSyncInstalledScript = Join-Path $opsRoot "run-payment-sync.ps1"

  Copy-Item -LiteralPath $paymentSyncSourceScript -Destination $paymentSyncInstalledScript -Force

  $paymentSyncAction = New-ScheduledTaskAction `
    -Execute "powershell.exe" `
    -Argument "-NoProfile -ExecutionPolicy Bypass -File `"$paymentSyncInstalledScript`" -Environment prod"
  $paymentSyncTrigger = New-ScheduledTaskTrigger -Daily -At "4:00AM"
  $paymentSyncPrincipal = New-ScheduledTaskPrincipal -UserId "SYSTEM" -LogonType ServiceAccount -RunLevel Highest
  $paymentSyncSettings = New-ScheduledTaskSettingsSet `
    -RestartCount 3 `
    -RestartInterval (New-TimeSpan -Minutes 1) `
    -ExecutionTimeLimit (New-TimeSpan -Hours 1) `
    -MultipleInstances IgnoreNew

  Register-ScheduledTask `
    -TaskName $paymentSyncTaskName `
    -Action $paymentSyncAction `
    -Trigger $paymentSyncTrigger `
    -Principal $paymentSyncPrincipal `
    -Settings $paymentSyncSettings `
    -Force | Out-Null

  Write-Host "Tarefa diaria de conciliacao instalada: $paymentSyncTaskName (04:00, horario local da VM)."
}
