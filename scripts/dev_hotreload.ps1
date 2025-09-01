param(
  [ValidateSet('up','down','restart','logs','ps')]
  [string]$Action = 'up',
  [string]$EnvFile = '.env.local',
  [switch]$Detached,
  [switch]$PruneVolumes
)

function Write-Info($msg){ Write-Host "[dev] $msg" -ForegroundColor Cyan }
function Write-Warn($msg){ Write-Host "[dev] $msg" -ForegroundColor Yellow }
function Ensure-Tool($name){ if (-not (Get-Command $name -ErrorAction SilentlyContinue)) { throw "Required tool not found: $name" } }

try {
  Ensure-Tool docker
} catch { Write-Error $_.Exception.Message; exit 1 }

# Resolve repo root (script is in scripts/)
$Root = Resolve-Path (Join-Path $PSScriptRoot '..') | Select-Object -ExpandProperty Path
Set-Location $Root

$composeFiles = @(
  '-f', 'docker-compose.yml',
  '-f', 'docker-compose.local.vite.yml'
)

if (-not (Test-Path $EnvFile)) {
  Write-Warn "Env-fil '$EnvFile' finnes ikke. Fortsetter uten --env-file (miljøvariabler må da komme fra systemet)."
  $envArg = @()
} else {
  $envArg = @('--env-file', $EnvFile)
}

switch ($Action) {
  'up' {
    $args = @('compose') + $composeFiles + $envArg + @('up')
    if ($Detached) { $args += '-d' }
    Write-Info "Starter hot-reload stack (backend: tsx watch, frontend: Vite)."
    Write-Host "docker $($args -join ' ')"
    docker @args
  }
  'down' {
    $args = @('compose') + $composeFiles + $envArg + @('down')
    if ($PruneVolumes) { $args += '-v' }
    Write-Info "Stopper stack${if($PruneVolumes){' og fjerner volumer'}else{''}}."
    docker @args
  }
  'restart' {
    Write-Info 'Restarter stacken...'
    & $PSCommandPath -Action down -EnvFile $EnvFile -PruneVolumes:$PruneVolumes | Out-Null
    & $PSCommandPath -Action up -EnvFile $EnvFile -Detached:$Detached
  }
  'logs' {
    $args = @('compose') + $composeFiles + $envArg + @('logs','-f','backend','frontend')
    Write-Info 'Følger logger (Ctrl+C for å avslutte)'
    docker @args
  }
  'ps' {
    $args = @('compose') + $composeFiles + $envArg + @('ps')
    docker @args
  }
}

<#
.SYNOPSIS
  Start/stop hot-reload stack (Docker) for lokal utvikling.

.DESCRIPTION
  Kjører backend i tsx watch og frontend i Vite dev-server inne i containere,
  med bind mounts slik at kodeendringer reflekteres umiddelbart.

.EXAMPLES
  # Start i forgrunnen
  .\scripts\dev_hotreload.ps1 up

  # Start i bakgrunnen
  .\scripts\dev_hotreload.ps1 up -Detached

  # Se logger
  .\scripts\dev_hotreload.ps1 logs

  # Stopp (behold volumer)
  .\scripts\dev_hotreload.ps1 down

  # Stopp og fjern volumer
  .\scripts\dev_hotreload.ps1 down -PruneVolumes
#>
