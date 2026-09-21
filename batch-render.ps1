# DuaVideoGenerator 2.0 - Batch Render Script
# Renders both Editorial and Luminous channels to MP4

Write-Host "🎬 DuaVideoGenerator - Batch Render Starting..." -ForegroundColor Cyan

# Navigate to project
cd "H:\DUAGENERATOR 2.0\remotion"

# Create output directory
New-Item -ItemType Directory -Force -Path "out\videos" | Out-Null
Write-Host "✓ Output directory ready: ./out/videos" -ForegroundColor Green

# Copy props files to project root
Copy-Item -Path "editorial-props.json" -Force -ErrorAction SilentlyContinue
Copy-Item -Path "luminous-props.json" -Force -ErrorAction SilentlyContinue

Write-Host "`n📹 RENDERING EDITORIAL CHANNEL..." -ForegroundColor Cyan
Write-Host "Command: npx remotion render src/index.ts sayyidul-istighfar out/videos/editorial.mp4 --props=./editorial-props.json`n" -ForegroundColor Gray

# Render Editorial
npx remotion render src/index.ts sayyidul-istighfar `
  "out/videos/editorial.mp4" `
  --props="./editorial-props.json" `
  --concurrency=4

if ($LASTEXITCODE -eq 0) {
    Write-Host "✅ Editorial render: SUCCESS" -ForegroundColor Green
} else {
    Write-Host "❌ Editorial render: FAILED (exit code: $LASTEXITCODE)" -ForegroundColor Red
}

Write-Host "`n📹 RENDERING LUMINOUS CHANNEL..." -ForegroundColor Cyan
Write-Host "Command: npx remotion render src/index.ts rabbi-zidni-probe-lum out/videos/luminous.mp4 --props=./luminous-props.json`n" -ForegroundColor Gray

# Render Luminous
npx remotion render src/index.ts rabbi-zidni-probe-lum `
  "out/videos/luminous.mp4" `
  --props="./luminous-props.json" `
  --concurrency=4

if ($LASTEXITCODE -eq 0) {
    Write-Host "✅ Luminous render: SUCCESS" -ForegroundColor Green
} else {
    Write-Host "❌ Luminous render: FAILED (exit code: $LASTEXITCODE)" -ForegroundColor Red
}

# List output files
Write-Host "`n📂 Output Files:" -ForegroundColor Cyan
Get-ChildItem "out/videos/" -File | ForEach-Object {
    $size = [math]::Round($_.Length / 1MB, 2)
    Write-Host "  ✓ $($_.Name) ($size MB)" -ForegroundColor Green
}

Write-Host "`n✅ Batch render complete!" -ForegroundColor Cyan
