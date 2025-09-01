param(
  [string]$EnvFile = '.env.local'
)

function Write-Info($m){ Write-Host "[rebuild] $m" -ForegroundColor Cyan }
Set-Location (Resolve-Path (Join-Path $PSScriptRoot '..'))

$args = @('compose','-f','docker-compose.yml','-f','docker-compose.local.yml')
if (Test-Path $EnvFile) { $args += @('--env-file',$EnvFile) }
$args += @('up','-d','--build','nginx')

Write-Info "Rebuilding Nginx dev container (serving built SPA)"
docker @args
