# Check production portal (H:\DuaVideoGenerator) health WITHOUT touching it.
# Usage:  powershell -ExecutionPolicy Bypass -File scripts\check_prod_portal.ps1
# Exits 0 if healthy. Read-only: never writes/modifies the prod folder or PM2 state.

$ErrorActionPreference = 'Continue'
$ok = $true

Write-Host "== Prod portal health check (read-only) =="

# 1. Port 7860 listening
$conn = Get-NetTCPConnection -LocalPort 7860 -State Listen -ErrorAction SilentlyContinue
if ($conn) {
    Write-Host ("[OK]   :7860 listening (PID " + ($conn.OwningProcess | Select-Object -First 1) + ")")
} else {
    Write-Host "[FAIL] :7860 NOT listening"
    $ok = $false
}

# 2. PM2 app dua-studio online
try {
    $tmpJ = Join-Path $env:TEMP "pm2_jlist.json"
    cmd /c "pm2 jlist > `"$tmpJ`" 2>nul"
    $stat = (& node -e "const t=require('fs').readFileSync(process.argv[1],'utf8');const j=JSON.parse(t);const a=j.find(x=>x.pm2_env&&x.pm2_env.name==='dua-studio');console.log(a?a.pm2_env.status:'MISSING')" $tmpJ)
    Remove-Item $tmpJ -ErrorAction SilentlyContinue
    if ($stat -eq "online") {
        Write-Host "[OK]   PM2 dua-studio = online"
    } else {
        Write-Host "[FAIL] PM2 dua-studio status = $stat"
        $ok = $false
    }
} catch {
    Write-Host "[FAIL] pm2 parse error: $($_.Exception.Message)"
    $ok = $false
}

# 3. Recent activity in prod out log (proves it is still producing)
$log = "H:\DuaVideoGenerator\remotion\dashboard\logs\pm2-out.log"
if (Test-Path $log) {
    $last = Get-Content $log -Tail 1 -ErrorAction SilentlyContinue
    $ageH = ((Get-Date) - (Get-Item $log).LastWriteTime).TotalHours
    Write-Host ("[OK]   out.log last write " + [Math]::Round($ageH, 1) + "h ago :: " + $last)
    if ($ageH -gt 24) { Write-Host "[WARN] out.log >24h stale" ; $ok = $false }
} else {
    Write-Host "[FAIL] prod pm2-out.log not found"
    $ok = $false
}

# 4. V2 must be untouched by prod and vice versa (sanity: V2 not listening on 7860)
$v2 = Get-NetTCPConnection -LocalPort 7870 -State Listen -ErrorAction SilentlyContinue
Write-Host ($(if ($v2) { "[OK]   V2 :7870 up (separate)" } else { "[WARN] V2 :7870 down (OK if dev stopped)" }))

Write-Host ""
if ($ok) { Write-Host "RESULT: prod portal HEALTHY"; exit 0 } else { Write-Host "RESULT: prod portal UNHEALTHY - run: cmd /c `"pm2 resurrect`""; exit 1 }