[CmdletBinding()]
param(
  [string]$SiteName = "Novo Site do Rincao"
)

$ErrorActionPreference = "Stop"
Import-Module WebAdministration

$site = Get-Website -Name $SiteName
if (-not $site -or $site.Name -ne $SiteName) { throw "IIS site not found." }
$webConfig = Join-Path ([Environment]::ExpandEnvironmentVariables($site.physicalPath)) "web.config"
$document = New-Object System.Xml.XmlDocument
$document.Load($webConfig)
$rules = $document.SelectSingleNode("/configuration/system.webServer/rewrite/rules")
$proxies = @($rules.SelectNodes("rule[@name='ReverseProxyToNextStandalone']"))
if ($proxies.Count -ne 1 -or $proxies[0].match.url -ne "(.*)" -or
    $proxies[0].action.url -notmatch '^http://127\.0\.0\.1:(\d+)/\{R:1\}$') {
  throw "Expected a catch-all loopback proxy; refusing to change an unknown configuration."
}
$backendPort = [int]$Matches[1]
$listeners = @(Get-NetTCPConnection -LocalPort $backendPort -State Listen -ErrorAction SilentlyContinue)
if (@($listeners | Where-Object { $_.LocalAddress -ne '127.0.0.1' }).Count -gt 0) {
  throw "Backend must not listen outside IPv4 loopback before trusting the IIS source header."
}

$addressFile = Join-Path (Split-Path -Parent $PSScriptRoot) "src\lib\cielo-chargeback-production-ips.json"
$addresses = Get-Content -LiteralPath $addressFile -Raw | ConvertFrom-Json
if ($addresses.Count -ne 6) { throw "Unexpected Cielo production address list." }
foreach ($address in $addresses) {
  $parsed = $null
  if (-not [System.Net.IPAddress]::TryParse($address, [ref]$parsed) -or
      $parsed.AddressFamily -ne [System.Net.Sockets.AddressFamily]::InterNetwork) {
    throw "Invalid Cielo production address."
  }
}
$sourcePattern = '^(?:::ffff:)?(' + (($addresses | ForEach-Object { [regex]::Escape($_) }) -join '|') + ')$'
$ruleName = 'CieloChargebackProductionSources'
foreach ($old in @($rules.SelectNodes("rule[@name='$ruleName']"))) { [void]$rules.RemoveChild($old) }
$guard = $document.CreateElement('rule')
$guard.SetAttribute('name', $ruleName)
$guard.SetAttribute('stopProcessing', 'true')
$guard.InnerXml = '<match url="^api/cielo/chargebacks(?:/|$)" ignoreCase="true" />' +
  '<conditions><add input="{REMOTE_ADDR}" pattern="' + $sourcePattern + '" negate="true" /></conditions>' +
  '<action type="CustomResponse" statusCode="403" statusReason="Forbidden" statusDescription="Forbidden" />'
[void]$rules.PrependChild($guard)

$proxy = $proxies[0]
$variables = $proxy.SelectSingleNode('serverVariables')
if (-not $variables) {
  $variables = $document.CreateElement('serverVariables')
  [void]$proxy.InsertBefore($variables, $proxy.SelectSingleNode('action'))
}
$variableName = 'HTTP_X_RINCAO_REMOTE_ADDRESS'
foreach ($old in @($variables.SelectNodes("set[@name='$variableName']"))) { [void]$variables.RemoveChild($old) }
$variable = $document.CreateElement('set')
$variable.SetAttribute('name', $variableName)
$variable.SetAttribute('value', '{REMOTE_ADDR}')
$variable.SetAttribute('replace', 'true')
[void]$variables.AppendChild($variable)

$backupRoot = 'C:\Deploy\Rincao\proxy-backups'
New-Item -ItemType Directory -Force -Path $backupRoot | Out-Null
$id = [guid]::NewGuid().ToString('N')
$backupFile = Join-Path $backupRoot "chargeback-$id.config"
Copy-Item -LiteralPath $webConfig -Destination $backupFile

$allowedFilter = "system.webServer/rewrite/allowedServerVariables/add[@name='$variableName']"
$allowed = Get-WebConfigurationProperty -PSPath 'MACHINE/WEBROOT/APPHOST' -Location $SiteName -Filter $allowedFilter -Name 'name'
if (-not $allowed) {
  Add-WebConfigurationProperty -PSPath 'MACHINE/WEBROOT/APPHOST' -Location $SiteName `
    -Filter 'system.webServer/rewrite/allowedServerVariables' -Name '.' -Value @{ name = $variableName }
}
$candidate = Join-Path (Split-Path -Parent $webConfig) "chargeback-$id.tmp"
try {
  $document.Save($candidate)
  [System.IO.File]::Replace($candidate, $webConfig, "$backupFile.atomic")
  Get-WebConfiguration -PSPath 'MACHINE/WEBROOT/APPHOST' -Location $SiteName `
    -Filter 'system.webServer/rewrite/rules' | Out-Null
} catch {
  Copy-Item -LiteralPath $backupFile -Destination $webConfig -Force
  throw
} finally {
  if (Test-Path -LiteralPath $candidate) { Remove-Item -LiteralPath $candidate -Force }
}
Write-Host "Chargeback proxy protected for site '$SiteName'; previous config: $backupFile"
[pscustomobject]@{ BackupPath = $backupFile; ConfigPath = $webConfig }
