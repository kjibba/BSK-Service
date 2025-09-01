param(
  [int]$DebounceMs = 1500,
  [ValidateSet('auto','backend','nginx','all')]
  [string]$Mode = 'auto',
  [switch]$NoInitUp
)

<#
.SYNOPSIS
  Watcher som redeployer docker-tjenester automatisk ved filendringer.

.DESCRIPTION
  Oppdager endringer i backend-nodejs, frontend og nginx, og kjører:
    - backend-endring:  docker compose up -d --build backend
    - frontend/nginx:   docker compose up -d --build nginx

  Debounce samler raske endringer til én redeploy. Kjør i repo-roten.

.USAGE
  pwsh -File scripts/dev_watch.ps1
  pwsh -File scripts/dev_watch.ps1 -Mode backend
  pwsh -File scripts/dev_watch.ps1 -DebounceMs 2500
#>

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

function Write-Log([string]$m){
  $ts = (Get-Date).ToString('HH:mm:ss')
  Write-Host "[watch $ts] $m"
}

function Test-Cli([string]$name){
  $null = & $name --version 2>$null
  return $LASTEXITCODE -eq 0
}

if (-not (Test-Cli 'docker') -and -not (Test-Cli 'docker-compose')){ Write-Host "Docker/Docker Compose ikke funnet i PATH." -ForegroundColor Red; exit 1 }

# Resolve compose command (docker compose vs docker-compose)
$composeExe = 'docker'
$composeArgsBase = @('compose')
try {
  $null = & $composeExe @('compose','version') 2>$null
  if ($LASTEXITCODE -ne 0) { throw 'no docker compose subcommand' }
} catch {
  if (Test-Cli 'docker-compose') {
    $composeExe = 'docker-compose'
    $composeArgsBase = @()
  } else {
    Write-Host "Fant verken 'docker compose' eller 'docker-compose'." -ForegroundColor Red
    exit 1
  }
}

function Invoke-Compose([string[]]$moreArgs){
  & $composeExe @composeArgsBase @moreArgs | Write-Host
}

$repoRoot = Split-Path -Parent $PSCommandPath | Split-Path -Parent
Set-Location $repoRoot

$backendDir = Join-Path $repoRoot 'backend-nodejs'
$frontendDir = Join-Path $repoRoot 'frontend'
$nginxDir   = Join-Path $repoRoot 'nginx'

if (-not $NoInitUp) {
  Write-Log "Starter (eller oppdaterer) stack: compose up -d"
  Invoke-Compose @('up','-d')
}

# State
$pending = [System.Collections.Concurrent.ConcurrentDictionary[string, bool]]::new()
$timer = New-Object System.Timers.Timer($DebounceMs)
$timer.AutoReset = $false

function Invoke-Redeploy {
  $keys = $pending.Keys
  if ($keys.Count -eq 0) { return }
  $svcBackend = $keys -contains 'backend'
  $svcNginx   = $keys -contains 'nginx'
  $pending.Clear() | Out-Null
  if ($Mode -eq 'backend') { $svcNginx = $false }
  if ($Mode -eq 'nginx') { $svcBackend = $false; $svcNginx = $true }
  if ($Mode -eq 'all') { $svcBackend = $true; $svcNginx = $true }

  if ($svcBackend) {
    Write-Log "Endringer oppdaget i backend → bygger og starter backend"
    Invoke-Compose @('up','-d','--build','backend')
  }
  if ($svcNginx) {
    Write-Log "Endringer oppdaget i frontend/nginx → bygger og starter nginx"
    Invoke-Compose @('up','-d','--build','nginx')
  }
}

$timer.Add_Elapsed({ Invoke-Redeploy })

function Set-PendingService([string]$svc){
  $pending[$svc] = $true | Out-Null
  $timer.Stop(); $timer.Interval = $DebounceMs; $timer.Start()
}

function New-Watcher([string]$path, [string]$svc){
  if (-not (Test-Path $path)) { return $null }
  $w = New-Object System.IO.FileSystemWatcher
  $w.Path = $path
  $w.Filter = '*.*'
  $w.IncludeSubdirectories = $true
  $w.EnableRaisingEvents = $true

  $exclude = @(
    '\\.git($|\\)',
    'node_modules($|\\)',
    'dist($|\\)',
    'frontend\\dist($|\\)',
    '\\.vscode($|\\)',
    '\\.idea($|\\)'
  )
  $rx = [string]::Join('|', $exclude)

  $action = {
    $full = $Event.SourceEventArgs.FullPath
    if (-not $full) { return }
    if ($full -match $args[0]) { return }
    # Ignore temp/editor swap files
    if ($full -match '(~$|\.swp$|\.swx$|\.tmp$)') { return }
    Write-Host " → ${using:svc}: $($Event.SourceEventArgs.ChangeType) $full" -ForegroundColor DarkGray
  Set-PendingService -svc $using:svc
  }.GetNewClosure()

  Register-ObjectEvent $w Changed -Action $action -MessageData $rx | Out-Null
  Register-ObjectEvent $w Created -Action $action -MessageData $rx | Out-Null
  Register-ObjectEvent $w Deleted -Action $action -MessageData $rx | Out-Null
  Register-ObjectEvent $w Renamed -Action $action -MessageData $rx | Out-Null
  return $w
}

Write-Log "Watching… (Debounce: ${DebounceMs}ms, Mode: $Mode). Trykk Ctrl+C for å avslutte."
$w1 = New-Watcher $backendDir  'backend'
$w2 = New-Watcher $frontendDir 'nginx'
$w3 = New-Watcher $nginxDir    'nginx'

try {
  while ($true) { Start-Sleep -Seconds 1 }
} finally {
  Write-Log "Stopper watcher"
  $timer.Dispose()
  foreach ($w in @($w1,$w2,$w3)) { if ($w) { $w.EnableRaisingEvents = $false } }
}
