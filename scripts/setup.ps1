# ============================================================
# DuaVideoGenerator - Setup Script
# Run this script to set up the development environment
# ============================================================

Write-Output "=========================================="
Write-Output "  DuaVideoGenerator - Setup Script"
Write-Output "=========================================="
Write-Output ""

# Check Python
Write-Output "1. Checking Python..."
try {
    $pythonVersion = python --version 2>&1
    Write-Output "   ✅ $pythonVersion"
} catch {
    Write-Output "   ❌ Python not found. Install Python 3.10+"
    exit 1
}

# Check Node.js
Write-Output "2. Checking Node.js..."
try {
    $nodeVersion = node --version 2>&1
    Write-Output "   ✅ $nodeVersion"
} catch {
    Write-Output "   ❌ Node.js not found. Install Node.js 18+"
    exit 1
}

# Install Python dependencies
Write-Output "3. Installing Python dependencies..."
pip install -r requirements.txt --quiet
if ($?) {
    Write-Output "   ✅ Python dependencies installed"
} else {
    Write-Output "   ⚠️ Some dependencies may have failed"
}

# Install Node.js dependencies
Write-Output "4. Installing Node.js dependencies..."
Push-Location "remotion"
npm install --silent 2>&1 | Out-Null
if ($?) {
    Write-Output "   ✅ Node.js dependencies installed"
} else {
    Write-Output "   ⚠️ Some dependencies may have failed"
}
Pop-Location

# Create directories
Write-Output "5. Creating directories..."
$dirs = @("output", "temp", "logs", "samples", "backups")
foreach ($dir in $dirs) {
    if (!(Test-Path $dir)) {
        New-Item -ItemType Directory -Force -Path $dir | Out-Null
    }
}
Write-Output "   ✅ Directories created"

# Check environment variables
Write-Output "6. Checking environment variables..."
$token = [Environment]::GetEnvironmentVariable("GITHUB_TOKEN", "User")
if ($token) {
    Write-Output "   ✅ GITHUB_TOKEN is set"
} else {
    Write-Output "   ⚠️ GITHUB_TOKEN not set (optional)"
}

# Summary
Write-Output ""
Write-Output "=========================================="
Write-Output "  Setup Complete!"
Write-Output "=========================================="
Write-Output ""
Write-Output "Next steps:"
Write-Output "  1. Run: python main.py"
Write-Output "  2. Or: python run_frontend.py"
Write-Output ""
