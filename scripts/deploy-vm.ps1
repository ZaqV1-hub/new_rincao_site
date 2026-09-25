[CmdletBinding()]
param(
  [Parameter(Mandatory = $true)]
  [ValidateSet("prod", "hml")]
  [string]$Environment,

  [string]$SourceRoot = (Split-Path -Parent $PSScriptRoot),

  [string]$ReleaseId = $env:GITHUB_SHA,

  [switch]$SkipBuild
)

$ErrorActionPreference = "Stop"

$settings = @{
  prod = @{
    Port = 8061
    Domain = "https://cluberincao.com.br/"
    TaskName = "NovoSiteRincaoNext8061"
    IisAppPool = "Novo Site do Rincao"
    SharedRoot = "C:\SitesData\Rincao\prod"
    DeploymentRoot = "C:\Deploy\Rincao\prod"
    LegacyRoot = "C:\Sites\AzureIIS\Novo_Site_do_Rincao"
  }
  hml = @{
    Port = 8062
    Domain = "https://cluberincao.questione.ai/"
    TaskName = "NovoSiteRincaoNext8062"
    IisAppPool = $null
    SharedRoot = "C:\SitesData\Rincao\hml"
    DeploymentRoot = "C:\Deploy\Rincao\hml"
    LegacyRoot = "C:\Sites\AzureIIS\Novo_Site_do_Rincao_HML"
  }
}

$config = $settings[$Environment]
$deploymentRoot = [string]$config.DeploymentRoot
$sharedRoot = [string]$config.SharedRoot
$legacyRoot = [string]$config.LegacyRoot
$releasesRoot = Join-Path $deploymentRoot "releases"
$currentFile = Join-Path $deploymentRoot "current.txt"
$opsRoot = "C:\Deploy\Rincao\ops"
$nodeRoot = "C:\Tools\node-v20.19.5-win-x64"
$nodeExe = Join-Path $nodeRoot "node.exe"
$npmCli = Join-Path $nodeRoot "node_modules\npm\bin\npm-cli.js"

if (-not $ReleaseId) {
  $ReleaseId = (git -C $SourceRoot rev-parse HEAD).Trim()
}

$safeReleaseId = $ReleaseId -replace "[^A-Za-z0-9._-]", "-"
$releaseRoot = Join-Path $releasesRoot $safeReleaseId
$standaloneRoot = Join-Path $SourceRoot ".next\standalone"
$installScriptSource = Join-Path $SourceRoot "scripts\install-vm-runtime.ps1"
$envFile = Join-Path $sharedRoot ".env.local"

if (-not (Test-Path -LiteralPath $envFile)) {
  throw "Execute scripts\migrate-vm-storage.ps1 -Environment $Environment antes do primeiro deploy."
}

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

$env:RINCAO_SITE_STORAGE_ROOT = $sharedRoot
$env:GROUP_REGISTRATION_STORAGE_DIR = Join-Path $sharedRoot ".data\group-registrations"
$env:DEPLOYMENT_VERSION = $safeReleaseId

if (-not $SkipBuild) {
  if (-not (Test-Path -LiteralPath $nodeExe) -or -not (Test-Path -LiteralPath $npmCli)) {
    throw "Node.js/npm da VM nao encontrados em $nodeRoot."
  }

  Push-Location $SourceRoot
  try {
    $env:Path = "$nodeRoot;$env:Path"
    & $nodeExe $npmCli ci --include=dev
    if ($LASTEXITCODE -ne 0) { throw "npm ci falhou com codigo $LASTEXITCODE." }
    & $nodeExe $npmCli run build
    if ($LASTEXITCODE -ne 0) { throw "npm run build falhou com codigo $LASTEXITCODE." }
  } finally {
    Pop-Location
  }
}

if (-not (Test-Path -LiteralPath (Join-Path $standaloneRoot "server.js"))) {
  throw "Artefato standalone nao encontrado em $standaloneRoot."
}

New-Item -ItemType Directory -Force -Path $releasesRoot, $opsRoot | Out-Null

$previousRelease = $null
if (Test-Path -LiteralPath $currentFile) {
  $previousRelease = (Get-Content -LiteralPath $currentFile -Raw).Trim()
} else {
  $legacyStandalone = Join-Path $legacyRoot ".next\standalone"
  if (Test-Path -LiteralPath (Join-Path $legacyStandalone "server.js")) {
    $legacyRelease = Join-Path $releasesRoot ("legacy-" + (Get-Date -Format "yyyyMMdd-HHmmss"))
    robocopy $legacyStandalone $legacyRelease /E /COPY:DAT /DCOPY:DAT /R:2 /W:2 /NFL /NDL /NJH /NJS /NP | Out-Null
    if ($LASTEXITCODE -ge 8) { throw "Falha ao preservar a release legada de $Environment." }
    $previousRelease = $legacyRelease
  }
}

if (-not (Test-Path -LiteralPath $releaseRoot)) {
  New-Item -ItemType Directory -Force -Path $releaseRoot | Out-Null
  robocopy $standaloneRoot $releaseRoot /E /COPY:DAT /DCOPY:DAT /R:2 /W:2 /NFL /NDL /NJH /NJS /NP | Out-Null
  if ($LASTEXITCODE -ge 8) { throw "Falha ao copiar a release para $releaseRoot." }
}

function Wait-RuntimeHealth {
  param([int]$Port, [int]$TimeoutSeconds = 90)

  $healthUrl = "http://127.0.0.1:$Port/robots.txt"
  $deadline = (Get-Date).AddSeconds($TimeoutSeconds)

  while ((Get-Date) -lt $deadline) {
    try {
      $response = Invoke-WebRequest -UseBasicParsing -TimeoutSec 2 $healthUrl
      if ($response.StatusCode -ge 200 -and $response.StatusCode -lt 400) {
        return
      }
    } catch {
      Start-Sleep -Seconds 1
    }
  }

  throw "Runtime nao respondeu com sucesso em $healthUrl."
}

function Wait-PublicHealth {
  param([string]$Url, [int]$TimeoutSeconds = 90)

  $deadline = (Get-Date).AddSeconds($TimeoutSeconds)

  while ((Get-Date) -lt $deadline) {
    try {
      $response = Invoke-WebRequest -UseBasicParsing -TimeoutSec 2 $Url
      if ($response.StatusCode -ge 200 -and $response.StatusCode -lt 400) {
        return
      }
    } catch {
      Start-Sleep -Seconds 1
    }
  }

  throw "Dominio publico nao respondeu com sucesso em $Url."
}

function Warm-PublicHome {
  param([string]$Url, [int]$TimeoutSeconds = 60)

  $homeUrl = $Url.TrimEnd("/") + "/"
  $response = Invoke-WebRequest -UseBasicParsing -TimeoutSec $TimeoutSeconds $homeUrl

  if ($response.StatusCode -lt 200 -or $response.StatusCode -ge 400) {
    throw "Home publica nao aqueceu com sucesso em $homeUrl."
  }
}

try {
  Set-Content -LiteralPath $currentFile -Value $releaseRoot -Encoding UTF8
  & $installScriptSource -Environment $Environment
  Start-ScheduledTask -TaskName ([string]$config.TaskName)
  Wait-RuntimeHealth -Port ([int]$config.Port)

  if ($config.IisAppPool) {
    Import-Module WebAdministration
    Restart-WebAppPool -Name ([string]$config.IisAppPool)
  }

  Wait-PublicHealth -Url ([string]$config.Domain + "robots.txt")
  Warm-PublicHome -Url ([string]$config.Domain)
} catch {
  $deployError = $_
  if ($previousRelease -and (Test-Path -LiteralPath (Join-Path $previousRelease "server.js"))) {
    Write-Warning "Deploy falhou; restaurando release anterior $previousRelease."
    Stop-ScheduledTask -TaskName ([string]$config.TaskName) -ErrorAction SilentlyContinue
    Set-Content -LiteralPath $currentFile -Value $previousRelease -Encoding UTF8
    Start-ScheduledTask -TaskName ([string]$config.TaskName)
    Wait-RuntimeHealth -Port ([int]$config.Port)
    if ($config.IisAppPool) {
      Import-Module WebAdministration
      Restart-WebAppPool -Name ([string]$config.IisAppPool)
    }
  }
  throw $deployError
}

Write-Host "Deploy concluido: ambiente=$Environment release=$releaseRoot dominio=$($config.Domain)"
