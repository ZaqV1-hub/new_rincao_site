[CmdletBinding()]
param(
  [Parameter(Mandatory = $true)]
  [ValidateSet("prod", "hml")]
  [string]$Environment,

  [string]$ReleaseRoot
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
$port = [int]$config.Port
$sharedRoot = [string]$config.SharedRoot
$deploymentRoot = [string]$config.DeploymentRoot
$currentFile = Join-Path $deploymentRoot "current.txt"
$nodeExe = "C:\Tools\node-v20.19.5-win-x64\node.exe"
$logRoot = Join-Path $deploymentRoot "logs"

if (-not $ReleaseRoot) {
  if (-not (Test-Path -LiteralPath $currentFile)) {
    throw "Release atual nao definida em $currentFile."
  }

  $ReleaseRoot = (Get-Content -LiteralPath $currentFile -Raw).Trim()
}

$serverFile = Join-Path $ReleaseRoot "server.js"
$envFile = Join-Path $sharedRoot ".env.local"

if (-not (Test-Path -LiteralPath $serverFile)) {
  throw "Runtime standalone nao encontrado em $serverFile."
}

if (-not (Test-Path -LiteralPath $envFile)) {
  throw "Arquivo de ambiente persistente nao encontrado em $envFile."
}

if (-not (Test-Path -LiteralPath $nodeExe)) {
  throw "Node.js nao encontrado em $nodeExe."
}

New-Item -ItemType Directory -Force -Path $logRoot | Out-Null
New-Item -ItemType Directory -Force -Path (Join-Path $sharedRoot ".data\group-registrations") | Out-Null

Get-Content -LiteralPath $envFile | ForEach-Object {
  $line = $_.Trim()

  if (-not $line -or $line.StartsWith("#") -or -not $line.Contains("=")) {
    return
  }

  $name, $value = $line -split "=", 2
  $name = $name.Trim()
  $value = $value.Trim()

  if (($value.StartsWith('"') -and $value.EndsWith('"')) -or ($value.StartsWith("'") -and $value.EndsWith("'"))) {
    $value = $value.Substring(1, $value.Length - 2)
  }

  [Environment]::SetEnvironmentVariable($name, $value, "Process")
}

$env:HOSTNAME = "127.0.0.1"
$env:PORT = [string]$port
$env:NODE_ENV = "production"
$env:RINCAO_SITE_STORAGE_ROOT = $sharedRoot
$env:GROUP_REGISTRATION_STORAGE_DIR = Join-Path $sharedRoot ".data\group-registrations"

$connections = Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue
foreach ($processId in @($connections | Select-Object -ExpandProperty OwningProcess -Unique)) {
  $process = Get-Process -Id $processId -ErrorAction SilentlyContinue

  if ($process -and $process.ProcessName -ne "node") {
    throw "A porta $port esta ocupada pelo processo $($process.ProcessName) (PID $processId)."
  }

  if ($process) {
    Stop-Process -Id $processId -Force
  }
}

$stopDeadline = (Get-Date).AddSeconds(15)
while ((Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue) -and (Get-Date) -lt $stopDeadline) {
  Start-Sleep -Milliseconds 250
}

$timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
$stdoutLog = Join-Path $logRoot "$Environment-$timestamp.out.log"
$stderrLog = Join-Path $logRoot "$Environment-$timestamp.err.log"

$process = Start-Process `
  -FilePath $nodeExe `
  -ArgumentList @("server.js") `
  -WorkingDirectory $ReleaseRoot `
  -RedirectStandardOutput $stdoutLog `
  -RedirectStandardError $stderrLog `
  -WindowStyle Hidden `
  -PassThru `
  -Wait

exit $process.ExitCode
