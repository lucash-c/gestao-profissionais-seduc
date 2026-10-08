[CmdletBinding()]
param(
  [string]$DatabaseUrl = $env:DATABASE_URL,
  [string]$BackupDirectory = $(if ($env:BACKUP_DIRECTORY) { $env:BACKUP_DIRECTORY } else { '.\backups' }),
  [string]$BackupFile = $env:BACKUP_FILE
)

$ErrorActionPreference = 'Stop'

function ConvertTo-PgClientUrl([string]$Url) {
  $separator = $Url.IndexOf('?')
  if ($separator -lt 0) { return $Url }
  $baseUrl = $Url.Substring(0, $separator)
  $parameters = $Url.Substring($separator + 1).Split('&') | Where-Object {
    $key = ($_ -split '=', 2)[0]
    $key -notin @('schema', 'connection_limit', 'pool_timeout')
  }
  if ($parameters.Count -eq 0) { return $baseUrl }
  return "$baseUrl`?$($parameters -join '&')"
}

if ([string]::IsNullOrWhiteSpace($DatabaseUrl)) {
  throw 'DATABASE_URL é obrigatória.'
}

if (-not (Get-Command pg_dump -ErrorAction SilentlyContinue)) {
  throw 'pg_dump não foi encontrado no PATH.'
}

New-Item -ItemType Directory -Path $BackupDirectory -Force | Out-Null
if ([string]::IsNullOrWhiteSpace($BackupFile)) {
  $timestamp = [DateTime]::UtcNow.ToString('yyyyMMddTHHmmssZ')
  $BackupFile = Join-Path $BackupDirectory "seduc-$timestamp.backup"
}

$target = [System.IO.Path]::GetFullPath($BackupFile)
$pgDatabaseUrl = ConvertTo-PgClientUrl $DatabaseUrl
if (Test-Path -LiteralPath $target) {
  throw "O backup de destino já existe; nada foi sobrescrito: $target"
}

try {
  & pg_dump "--dbname=$pgDatabaseUrl" '--format=custom' '--no-owner' '--no-privileges' "--file=$target"
  if ($LASTEXITCODE -ne 0) {
    throw "pg_dump terminou com código $LASTEXITCODE."
  }
  if (-not (Test-Path -LiteralPath $target) -or (Get-Item -LiteralPath $target).Length -eq 0) {
    throw 'O arquivo de backup ficou vazio.'
  }
}
catch {
  if (Test-Path -LiteralPath $target) {
    Remove-Item -LiteralPath $target -Force
  }
  throw
}

Write-Output $target
