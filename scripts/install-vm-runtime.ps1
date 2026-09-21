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
$settings = New-ScheduledTaskSettingsSet -StartWhenAvailable -RestartCount 3 -RestartInterval (New-TimeSpan -Minutes 1)

Register-ScheduledTask `
  -TaskName $taskName `
  -Action $action `
  -Trigger $trigger `
  -Principal $principal `
  -Settings $settings `
  -Force | Out-Null

Write-Host "Tarefa instalada: $taskName"
