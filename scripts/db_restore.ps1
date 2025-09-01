param(
  [Parameter(Mandatory=$true)][string]$Path,
  [switch]$UseRoot
)

function Write-Info($m){ Write-Host "[restore] $m" -ForegroundColor Cyan }
function Throw-Err($m){ throw $m }

if (-not (Test-Path $Path)) { Throw-Err "File not found: $Path" }

# Move to repo root
Set-Location (Resolve-Path (Join-Path $PSScriptRoot '..'))

# Get db container id
$dbId = (docker compose ps -q db).Trim()
if (-not $dbId) { Throw-Err "DB container not running. Start stack first (docker compose up)." }

$isGz = $Path.ToLower().EndsWith('.gz')
$remotePath = "/tmp/restore.sql"
if ($isGz) { $remotePath = $remotePath + '.gz' }

Write-Info "Copying dump into container: $remotePath"
docker cp $Path "$($dbId):$remotePath" | Out-Null

if ($UseRoot) { Write-Info "Using root credentials for import" }

if ($isGz) {
  Write-Info "Decompressing inside container..."
  docker compose exec -T db sh -lc "gzip -dc '$remotePath' > /tmp/restore_import.sql || exit 1"
  Write-Info "Importing SQL via mysql --execute=source ..."
  $cmd = if ($UseRoot) { "mysql -uroot -p`$MYSQL_ROOT_PASSWORD `$MYSQL_DATABASE --execute='source /tmp/restore_import.sql'" } else { "mysql -u`$MYSQL_USER -p`$MYSQL_PASSWORD `$MYSQL_DATABASE --execute='source /tmp/restore_import.sql'" }
  docker compose exec -T db sh -lc $cmd
} else {
  Write-Info "Importing SQL via mysql --execute=source ..."
  $cmd = if ($UseRoot) { "mysql -uroot -p`$MYSQL_ROOT_PASSWORD `$MYSQL_DATABASE --execute='source $remotePath'" } else { "mysql -u`$MYSQL_USER -p`$MYSQL_PASSWORD `$MYSQL_DATABASE --execute='source $remotePath'" }
  docker compose exec -T db sh -lc $cmd
}

if ($LASTEXITCODE -ne 0) { throw "Restore failed with exit code $LASTEXITCODE" }

Write-Info "Restore complete."
