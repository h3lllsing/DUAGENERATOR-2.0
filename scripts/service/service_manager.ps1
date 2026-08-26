# Dua Video Studio - Service Manager
# Usage: .\service_manager.ps1 [install|uninstall|start|stop|restart|status|logs]

param(
    [Parameter(Position=0)]
    [ValidateSet('install', 'uninstall', 'start', 'stop', 'restart', 'status', 'logs')]
    [string]$Action = 'status'
)

$ErrorActionPreference = 'Stop'
$ServiceName = 'DuaVideoStudio'
$DashboardDir = Join-Path $PSScriptRoot '..\..\remotion\dashboard'
$ProjectDir = Join-Path $PSScriptRoot '..\..'
$NodeExe = (Get-Command node -ErrorAction SilentlyContinue).Source
$Pm2Exe = (Get-Command pm2 -ErrorAction SilentlyContinue).Source
$NssmExe = Join-Path $ProjectDir 'tools\nssm\nssm.exe'
$LogDir = Join-Path $DashboardDir 'logs'

function Write-Status($msg) { Write-Host "[*] $msg" -ForegroundColor Cyan }
function Write-OK($msg)     { Write-Host "[+] $msg" -ForegroundColor Green }
function Write-Err($msg)    { Write-Host "[-] $msg" -ForegroundColor Red }

function Test-Prereqs {
    if (-not $NodeExe) {
        Write-Err "Node.js not found. Install from https://nodejs.org"
        exit 1
    }
    Write-OK "Node: $NodeExe"

    if (-not (Test-Path $NssmExe)) {
        Write-Err "NSSM not found at $NssmExe"
        Write-Status "Download from https://nssm.cc/download and extract to tools\nssm\"
        exit 1
    }
    Write-OK "NSSM: $NssmExe"

    if (-not $Pm2Exe) {
        Write-Status "Installing PM2 globally..."
        & npm install -g pm2
        if ($LASTEXITCODE -ne 0) { Write-Err "PM2 install failed"; exit 1 }
        $script:Pm2Exe = (Get-Command pm2).Source
    }
    Write-OK "PM2: $Pm2Exe"
}

function Install-Service {
    Write-Status "Installing $ServiceName service..."

    if (-not (Test-Path $LogDir)) { New-Item -ItemType Directory -Path $LogDir -Force | Out-Null }

    # Start PM2 with ecosystem config
    Push-Location $DashboardDir
    & pm2 start ecosystem.config.js
    & pm2 save
    Pop-Location

    # Register PM2 daemon with NSSM as Windows service
    & $NssmExe install $ServiceName $Pm2Exe "dashboard"
    & $NssmExe set $ServiceName AppDirectory $DashboardDir
    & $NssmExe set $ServiceName DisplayName "Dua Video Studio Dashboard"
    & $NssmExe set $ServiceName Description "Dua Video Studio dashboard server on port 7860"
    & $NssmExe set $ServiceName Start SERVICE_AUTO_START
    & $NssmExe set $ServiceName AppStdout "$LogDir\nssm-stdout.log"
    & $NssmExe set $ServiceName AppStderr "$LogDir\nssm-stderr.log"
    & $NssmExe set $ServiceName AppRotateFiles 1
    & $NssmExe set $ServiceName AppRotateBytes 5242880
    & $NssmExe set $ServiceName AppEnvironmentExtra "NODE_ENV=production" "PORT=7860"
    & $NssmExe set $ServiceName AppNoConsole 1
    & $NssmExe set $ServiceName AppRestartDelay 3000

    # Start the service
    & $NssmExe start $ServiceName

    Write-OK "Service '$ServiceName' installed and started."
    Write-OK "Dashboard: http://127.0.0.1:7860"
}

function Uninstall-Service {
    Write-Status "Uninstalling $ServiceName service..."

    # Stop and remove NSSM service
    & $NssmExe stop $ServiceName 2>$null
    & $NssmExe remove $ServiceName confirm 2>$null

    # Stop PM2 processes
    Push-Location $DashboardDir
    & pm2 delete all 2>$null
    & pm2 save --force 2>$null
    Pop-Location

    Write-OK "Service '$ServiceName' uninstalled."
}

function Start-Service_ {
    Write-Status "Starting $ServiceName..."
    & $NssmExe start $ServiceName
    Write-OK "Service started."
}

function Stop-Service_ {
    Write-Status "Stopping $ServiceName..."
    & $NssmExe stop $ServiceName
    Write-OK "Service stopped."
}

function Restart-Service_ {
    Write-Status "Restarting $ServiceName..."
    & $NssmExe restart $ServiceName
    Write-OK "Service restarted."
}

function Get-ServiceStatus {
    Write-Status "Service status:"
    & $NssmExe status $ServiceName
    Write-Host ""
    Write-Status "PM2 processes:"
    Push-Location $DashboardDir
    & pm2 list
    Pop-Location
}

function Show-Logs {
    Push-Location $DashboardDir
    & pm2 logs dua-studio --lines 50 --nostream
    Pop-Location
}

# Main
Test-Prereqs

switch ($Action) {
    'install'   { Install-Service }
    'uninstall' { Uninstall-Service }
    'start'     { Start-Service_ }
    'stop'      { Stop-Service_ }
    'restart'   { Restart-Service_ }
    'status'    { Get-ServiceStatus }
    'logs'      { Show-Logs }
}
