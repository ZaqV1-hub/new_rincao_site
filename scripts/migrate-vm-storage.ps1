[CmdletBinding()]
param(
  [Parameter(Mandatory = $true)]
  [ValidateSet("prod", "hml")]
  [string]$Environment
)

$ErrorActionPreference = "Stop"

$settings = @{
  prod = @{
    LegacyRoot = "C:\Sites\AzureIIS\Novo_Site_do_Rincao"
    SharedRoot = "C:\SitesData\Rincao\prod"
  }
  hml = @{
    LegacyRoot = "C:\Sites\AzureIIS\Novo_Site_do_Rincao_HML"
    SharedRoot = "C:\SitesData\Rincao\hml"
  }
}

$config = $settings[$Environment]
$legacyRoot = [string]$config.LegacyRoot
$sharedRoot = [string]$config.SharedRoot
$timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
$backupRoot = "C:\Sites\AzureIIS\_deploy_backups\new_rincao_site\$Environment\$timestamp"

function Copy-Tree {
  param(
    [Parameter(Mandatory = $true)][string]$Source,
    [Parameter(Mandatory = $true)][string]$Destination,
    [switch]$MissingOnly
  )

  if (-not (Test-Path -LiteralPath $Source)) {
    return
  }

  New-Item -ItemType Directory -Force -Path $Destination | Out-Null
  $arguments = @($Source, $Destination, "/E", "/COPY:DAT", "/DCOPY:DAT", "/R:2", "/W:2", "/NFL", "/NDL", "/NJH", "/NJS", "/NP")
  if ($MissingOnly) { $arguments += @("/XC", "/XN", "/XO") }
  & robocopy @arguments | Out-Null
  if ($LASTEXITCODE -ge 8) { throw "Falha ao copiar $Source para $Destination." }
}

if (-not (Test-Path -LiteralPath $legacyRoot)) {
  throw "Diretorio legado nao encontrado: $legacyRoot."
}

New-Item -ItemType Directory -Force -Path $backupRoot, $sharedRoot | Out-Null

foreach ($relative in @(".env.local", ".local", ".data", "public\uploads", ".next\standalone\.data", ".next\standalone\public\uploads")) {
  $source = Join-Path $legacyRoot $relative
  $destination = Join-Path $backupRoot $relative

  if (Test-Path -LiteralPath $source -PathType Leaf) {
    New-Item -ItemType Directory -Force -Path (Split-Path -Parent $destination) | Out-Null
    Copy-Item -LiteralPath $source -Destination $destination -Force
  } elseif (Test-Path -LiteralPath $source -PathType Container) {
    Copy-Tree -Source $source -Destination $destination
  }
}

$legacyEnv = Join-Path $legacyRoot ".env.local"
$sharedEnv = Join-Path $sharedRoot ".env.local"
if (-not (Test-Path -LiteralPath $sharedEnv)) {
  Copy-Item -LiteralPath $legacyEnv -Destination $sharedEnv
}

$sharedData = Join-Path $sharedRoot ".data"
$runtimeData = Join-Path $legacyRoot ".next\standalone\.data"
$rootData = Join-Path $legacyRoot ".data"
Copy-Tree -Source $runtimeData -Destination $sharedData
Copy-Tree -Source $rootData -Destination $sharedData -MissingOnly

$sharedPublicUploads = Join-Path $sharedRoot "public\uploads\site"
$sharedBinaryUploads = Join-Path $sharedData "uploads\site"
$runtimePublicUploads = Join-Path $legacyRoot ".next\standalone\public\uploads\site"
$rootPublicUploads = Join-Path $legacyRoot "public\uploads\site"

Copy-Tree -Source $runtimePublicUploads -Destination $sharedPublicUploads
Copy-Tree -Source $rootPublicUploads -Destination $sharedPublicUploads -MissingOnly
Copy-Tree -Source $runtimePublicUploads -Destination $sharedBinaryUploads -MissingOnly
Copy-Tree -Source $rootPublicUploads -Destination $sharedBinaryUploads -MissingOnly

$sharedFiles = @(Get-ChildItem -LiteralPath $sharedRoot -Recurse -File)
$sharedBytes = ($sharedFiles | Measure-Object -Property Length -Sum).Sum

Write-Host "Migracao persistente concluida: ambiente=$Environment arquivos=$($sharedFiles.Count) bytes=$sharedBytes"
Write-Host "Backup preservado em $backupRoot"
