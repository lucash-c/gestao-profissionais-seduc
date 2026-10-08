[CmdletBinding()]
param(
  [string]$DatabaseUrl = $env:DATABASE_URL,
  [string]$BackupFile = $env:BACKUP_FILE,
  [string]$AllowDatabaseRestore = $env:ALLOW_DATABASE_RESTORE
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

if ($AllowDatabaseRestore -ne 'true') {
  throw 'Restauração bloqueada. Defina ALLOW_DATABASE_RESTORE=true explicitamente.'
}
if ([string]::IsNullOrWhiteSpace($DatabaseUrl)) {
  throw 'DATABASE_URL é obrigatória.'
}
if ([string]::IsNullOrWhiteSpace($BackupFile) -or -not (Test-Path -LiteralPath $BackupFile -PathType Leaf)) {
  throw 'BACKUP_FILE deve apontar para um arquivo existente.'
}
if (-not (Get-Command pg_restore -ErrorAction SilentlyContinue)) {
  throw 'pg_restore não foi encontrado no PATH.'
}

$source = (Resolve-Path -LiteralPath $BackupFile).Path
$pgDatabaseUrl = ConvertTo-PgClientUrl $DatabaseUrl
& pg_restore "--dbname=$pgDatabaseUrl" '--clean' '--if-exists' '--no-owner' '--no-privileges' '--exit-on-error' '--single-transaction' $source
if ($LASTEXITCODE -ne 0) {
  throw "pg_restore terminou com código $LASTEXITCODE."
}

Write-Output 'Restauração concluída e transação confirmada.'
