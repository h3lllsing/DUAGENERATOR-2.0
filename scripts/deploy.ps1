# ============================================================
# DuaVideoGenerator - Deploy Script
# Deploy to GitHub
# ============================================================

param(
    [string]$Message = "Auto deploy"
)

Write-Output "=========================================="
Write-Output "  DuaVideoGenerator - Deploy Script"
Write-Output "=========================================="
Write-Output ""

# Check git status
Write-Output "1. Checking git status..."
$changes = git status --short
if ($changes) {
    Write-Output "   ⚠️ You have uncommitted changes:"
    $changes
    Write-Output ""
    $confirm = Read-Host "Continue with deploy? (y/n)"
    if ($confirm -ne "y") {
        Write-Output "Deploy cancelled."
        exit 0
    }
}

# Add all changes
Write-Output "2. Adding changes..."
git add .
Write-Output "   ✅ Changes added"

# Commit
Write-Output "3. Committing..."
git commit -m $Message
if ($?) {
    Write-Output "   ✅ Committed: $Message"
} else {
    Write-Output "   ❌ Commit failed"
    exit 1
}

# Push
Write-Output "4. Pushing to GitHub..."
git push origin main
if ($?) {
    Write-Output "   ✅ Pushed successfully"
} else {
    Write-Output "   ❌ Push failed"
    exit 1
}

# Summary
Write-Output ""
Write-Output "=========================================="
Write-Output "  Deploy Complete!"
Write-Output "=========================================="
Write-Output ""
Write-Output "Changes pushed to: https://github.com/h3lllsing/DuaVideoGenerator"
Write-Output ""
