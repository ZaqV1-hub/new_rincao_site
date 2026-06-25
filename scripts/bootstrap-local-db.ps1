param(
  [string]$SourceEnvFile = ".env.schema-source",
  [string]$SchemaOutput = "docker/initdb/01_schema.sql"
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

function Set-EnvFromFile {
  param([string]$Path)

  if (-not (Test-Path -LiteralPath $Path)) {
    return
  }

  Get-Content -LiteralPath $Path | ForEach-Object {
    $line = $_.Trim()

    if (-not $line -or $line.StartsWith("#")) {
      return
    }

    $parts = $line -split "=", 2
    if ($parts.Count -ne 2) {
      return
    }

    [Environment]::SetEnvironmentVariable($parts[0], $parts[1])
  }
}

Set-EnvFromFile -Path $SourceEnvFile

$sourceHost = $env:SOURCE_INGRESSO_DB_HOST
$sourcePort = if ($env:SOURCE_INGRESSO_DB_PORT) { $env:SOURCE_INGRESSO_DB_PORT } else { "5432" }
$sourceDatabase = $env:SOURCE_INGRESSO_DB_NAME
$sourceUser = $env:SOURCE_INGRESSO_DB_USER
$sourcePassword = $env:SOURCE_INGRESSO_DB_PASSWORD
$sourceSsl = if ($env:SOURCE_INGRESSO_DB_SSL) { $env:SOURCE_INGRESSO_DB_SSL } else { "true" }

if (-not $sourceHost -or -not $sourceDatabase -or -not $sourceUser -or -not $sourcePassword) {
  throw "Preencha SOURCE_INGRESSO_DB_HOST, SOURCE_INGRESSO_DB_NAME, SOURCE_INGRESSO_DB_USER e SOURCE_INGRESSO_DB_PASSWORD em $SourceEnvFile."
}

$schemaDir = Split-Path -Parent $SchemaOutput
if (-not (Test-Path -LiteralPath $schemaDir)) {
  New-Item -ItemType Directory -Path $schemaDir | Out-Null
}

$sslMode = if ($sourceSsl -eq "true") { "require" } else { "disable" }
$workspacePath = (Get-Location).Path

$pgDumpCommand = @"
set -e
export PGPASSWORD='$sourcePassword'
export PGSSLMODE='$sslMode'
pg_dump \
  --schema-only \
  --no-owner \
  --no-privileges \
  --host '$sourceHost' \
  --port '$sourcePort' \
  --username '$sourceUser' \
  --dbname '$sourceDatabase' \
  --file /work/$SchemaOutput
"@

docker run --rm `
  -v "${workspacePath}:/work" `
  -w /work `
  postgres:17 `
  bash -lc $pgDumpCommand

if ($LASTEXITCODE -ne 0) {
  throw "Falha ao exportar o schema com docker run."
}

Write-Host "Schema exportado para $SchemaOutput"
