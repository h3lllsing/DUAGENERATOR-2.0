# 🚀 DuaVideoGenerator 2.0 - SETUP & EXECUTION GUIDE

## OPTION B + C: Batch Render + GitHub + CI/CD

### Prerequisites
- Node.js 18+ installed
- npm or yarn
- Git installed
- GitHub account
- PowerShell (Windows) or Bash

---

## **STEP 1: COPY PROPS FILES (5 min)**

### Windows PowerShell:
```powershell
# Navigate to project
cd "H:\DUAGENERATOR 2.0\remotion"

# Copy props files from this guide to your project root
# Option A: Manual - Copy these files to your project:

# File 1: editorial-props.json
@"
{
  "visualDirection": "editorial",
  "theme": "default"
}
"@ | Out-File -Encoding UTF8 -FilePath "editorial-props.json"

# File 2: luminous-props.json
@"
{
  "visualDirection": "luminous",
  "theme": "default"
}
"@ | Out-File -Encoding UTF8 -FilePath "luminous-props.json"

# Verify
Get-ChildItem *.json | Select Name, Length
```

---

## **STEP 2: BATCH RENDER BOTH CHANNELS (30 min)**

### Option A: Using PowerShell Script

```powershell
# Navigate to project
cd "H:\DUAGENERATOR 2.0\remotion"

# Create output directory
New-Item -ItemType Directory -Force -Path "out\videos" | Out-Null

# Render Editorial Channel
Write-Host "🎬 Rendering Editorial..." -ForegroundColor Cyan
npx remotion render src/index.ts sayyidul-istighfar `
  "out/videos/editorial.mp4" `
  --props="./editorial-props.json" `
  --concurrency=4

# Check if successful
if ($LASTEXITCODE -eq 0) {
    Write-Host "✅ Editorial: SUCCESS" -ForegroundColor Green
} else {
    Write-Host "❌ Editorial: FAILED" -ForegroundColor Red
}

# Render Luminous Channel
Write-Host "`n🎬 Rendering Luminous..." -ForegroundColor Cyan
npx remotion render src/index.ts rabbi-zidni-probe-lum `
  "out/videos/luminous.mp4" `
  --props="./luminous-props.json" `
  --concurrency=4

# Check if successful
if ($LASTEXITCODE -eq 0) {
    Write-Host "✅ Luminous: SUCCESS" -ForegroundColor Green
} else {
    Write-Host "❌ Luminous: FAILED" -ForegroundColor Red
}

# List output
Write-Host "`n📂 Generated Videos:" -ForegroundColor Cyan
Get-ChildItem "out/videos/" -File | ForEach-Object {
    $size = [math]::Round($_.Length / 1MB, 2)
    Write-Host "  ✓ $($_.Name) ($size MB)" -ForegroundColor Green
}
```

### Option B: Manual Commands

```powershell
cd "H:\DUAGENERATOR 2.0\remotion"
mkdir -p out/videos

# Editorial
npx remotion render src/index.ts sayyidul-istighfar out/videos/editorial.mp4 --props="./editorial-props.json"

# Luminous
npx remotion render src/index.ts rabbi-zidni-probe-lum out/videos/luminous.mp4 --props="./luminous-props.json"

# Verify
dir out/videos/
```

### Expected Output:
```
✅ editorial.mp4 (100-300 MB)
✅ luminous.mp4 (100-300 MB)
```

---

## **STEP 3: GITHUB SETUP (15 min)**

### 3A: Create GitHub Repository

1. Go to https://github.com/new
2. Create new repository:
   - **Name:** `duavideo-2.0`
   - **Description:** "DuaVideoGenerator - Remotion 4.0 video composer"
   - **Visibility:** Public (or Private)
   - **Initialize:** Leave unchecked (we'll push existing code)
   - **Create repository**

### 3B: Setup Git Remote (PowerShell)

```powershell
cd "H:\DUAGENERATOR 2.0\remotion"

# Configure Git
git config --global user.name "Your Name"
git config --global user.email "your.email@example.com"

# Add remote (replace YOUR-USERNAME and REPO-NAME)
git remote add origin https://github.com/YOUR-USERNAME/duavideo-2.0.git
git branch -M main

# Verify remote added
git remote -v
# Should output:
# origin  https://github.com/YOUR-USERNAME/duavideo-2.0.git (fetch)
# origin  https://github.com/YOUR-USERNAME/duavideo-2.0.git (push)
```

### 3C: Add .gitignore + Commit

```powershell
# Copy .gitignore to your project (see file provided)
# Then:

git add .
git commit -m "🎬 Initial commit: DuaVideoGenerator 2.0 with V2 calligraphy system

- Editorial channel: V2 fonts (Katibeh, Gulzar)
- Luminous channel: Karaoke system with word timings
- Props injection: Windows-safe BOM-free JSON
- TypeScript: 100% type-safe (tsc=0)
- Batch render: Both channels verified working"

# Push to GitHub
git push -u origin main
```

### Expected Output:
```
✅ main branch created at GitHub
✅ All code pushed
✅ Repository live at https://github.com/YOUR-USERNAME/duavideo-2.0
```

---

## **STEP 4: GitHub Actions CI/CD (15 min)**

### 4A: Create Workflow Directory

```powershell
cd "H:\DUAGENERATOR 2.0\remotion"

# Create .github/workflows/ directory
New-Item -ItemType Directory -Force -Path ".github\workflows" | Out-Null
```

### 4B: Add Workflow File

Copy the `github-actions-workflow.yml` file provided to:
```
.github/workflows/render.yml
```

Full content:
```yaml
name: Render Videos & Upload Artifacts

on:
  push:
    branches:
      - main
      - develop
  pull_request:
    branches:
      - main
  workflow_dispatch:

jobs:
  render:
    runs-on: ubuntu-latest
    
    steps:
      - name: 📥 Checkout code
        uses: actions/checkout@v4
      
      - name: 🔧 Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: 18.x
          cache: 'npm'
      
      - name: 📦 Install dependencies
        run: npm install
      
      - name: ✔️ TypeScript check
        run: npx tsc --noEmit
      
      - name: 📂 Create output directory
        run: mkdir -p out/videos
      
      - name: 🎬 Render Editorial Channel
        run: |
          npx remotion render src/index.ts sayyidul-istighfar \
            out/videos/editorial.mp4 \
            --props='{"visualDirection":"editorial","theme":"default"}' \
            --concurrency=4
      
      - name: 🎬 Render Luminous Channel
        run: |
          npx remotion render src/index.ts rabbi-zidni-probe-lum \
            out/videos/luminous.mp4 \
            --props='{"visualDirection":"luminous","theme":"default"}' \
            --concurrency=4
      
      - name: 📤 Upload artifacts
        uses: actions/upload-artifact@v4
        with:
          name: rendered-videos
          path: out/videos/
          retention-days: 30
```

### 4C: Commit & Push Workflow

```powershell
# From project root
git add .github/
git commit -m "✅ Add GitHub Actions CI/CD pipeline

- Auto-render on push (Editorial + Luminous)
- TypeScript type-check
- Artifact upload for 30 days"

git push origin main
```

### 4D: Verify Workflow (GitHub UI)

1. Go to https://github.com/YOUR-USERNAME/duavideo-2.0
2. Click **Actions** tab
3. Should see "Render Videos & Upload Artifacts" workflow
4. Click it → **Run workflow** → **Run workflow** button
5. Watch it execute:
   - npm install ✅
   - tsc check ✅
   - Editorial render ✅
   - Luminous render ✅
   - Upload artifacts ✅

---

## **STEP 5: VERIFY EVERYTHING (5 min)**

### Local Verification

```powershell
cd "H:\DUAGENERATOR 2.0\remotion"

# Check video files exist
dir out/videos/

# Check git status
git status

# Check remote
git remote -v
```

### Expected Output:
```
Mode                 LastWriteTime         Length Name
----                 -------------         ------ ----
-a---          12/19/2024   2:45 PM      245MB  editorial.mp4
-a---          12/19/2024   2:50 PM      180MB  luminous.mp4

On branch main
Your branch is up to date with 'origin/main'.

origin  https://github.com/YOUR-USERNAME/duavideo-2.0.git (fetch)
origin  https://github.com/YOUR-USERNAME/duavideo-2.0.git (push)
```

### GitHub Verification

1. **Repository:** https://github.com/YOUR-USERNAME/duavideo-2.0
   - ✅ Code visible
   - ✅ README shows
   - ✅ Commits listed

2. **Actions Tab:** All workflows passing
   - ✅ TypeScript check: pass
   - ✅ Editorial render: pass
   - ✅ Luminous render: pass
   - ✅ Artifacts: available (30 days)

3. **Releases (Optional):** Create release with videos
   - Go to **Releases**
   - **Create new release**
   - Tag: `v2.0.0`
   - Title: "DuaVideoGenerator 2.0 - Production Ready"
   - Upload both MP4 files
   - **Publish**

---

## **TROUBLESHOOTING**

### Issue: "node_modules not found"
```powershell
cd "H:\DUAGENERATOR 2.0\remotion"
npm install
npm audit fix --force  # If needed
```

### Issue: "tsc command not found"
```powershell
npm install -g typescript
npx tsc --version
```

### Issue: Render fails with "composition not found"
```powershell
# Verify composition exists:
npx remotion compositions src/index.ts

# If "sayyidul-istighfar" not shown, check:
# - Root.tsx line ~50: compositionIdFor(dua_id)
# - Dua manifest has correct dua_id
```

### Issue: Windows path errors in PowerShell
```powershell
# Use quotes or escape spaces:
npx remotion render src/index.ts sayyidul-istighfar `
  "out/videos/editorial.mp4" `
  --props="./editorial-props.json"
```

### Issue: GitHub Actions timeout (>6 hours)
```yaml
# In .github/workflows/render.yml, increase timeout:
jobs:
  render:
    timeout-minutes: 120  # Add this line
```

---

## **FINAL CHECKLIST**

- [ ] Props files created (editorial-props.json, luminous-props.json)
- [ ] Batch render executed successfully
  - [ ] editorial.mp4 created (100+ MB)
  - [ ] luminous.mp4 created (100+ MB)
- [ ] Git remote added: `git remote -v` shows origin
- [ ] Code committed and pushed to main branch
- [ ] .github/workflows/render.yml created and pushed
- [ ] GitHub Actions workflow executed successfully
- [ ] Artifacts available in GitHub Actions (Actions tab)
- [ ] Videos downloadable from artifacts

---

## **WHAT YOU NOW HAVE**

✅ **Local:**
- Both MP4 videos (editorial + luminous) in `out/videos/`
- Git repository configured with GitHub remote
- .gitignore protecting build artifacts

✅ **GitHub:**
- Repository at https://github.com/YOUR-USERNAME/duavideo-2.0
- All code backed up
- GitHub Actions CI/CD pipeline active

✅ **Automation:**
- Every push to `main` triggers automatic render
- Videos generated and uploaded as artifacts
- 30-day retention on artifacts
- Manual trigger available anytime

---

## **NEXT STEPS**

1. **Share videos:** Download MP4s from GitHub Actions artifacts
2. **Share repo:** Give GitHub link to team/public
3. **Monitor:** Check GitHub Actions tab for new renders
4. **Extend:** Add more duas to manifests, auto-renders them
5. **Deploy:** Setup GitHub Pages or cloud storage upload in Actions

---

**Ready? Start with STEP 1!** 🚀
