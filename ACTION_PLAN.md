# 🎯 ACTION PLAN - COPY & PASTE READY

## OPTION B + C: BATCH RENDER + GITHUB + CI/CD

Total time: **1 hour**

---

## 📋 QUICK CHECKLIST

### Copy-Paste Commands (Order Matters)

#### 1. CREATE PROPS FILES (2 min)
```powershell
cd "H:\DUAGENERATOR 2.0\remotion"

# Editorial props
@"
{
  "visualDirection": "editorial",
  "theme": "default"
}
"@ | Out-File -Encoding UTF8 -FilePath "editorial-props.json"

# Luminous props
@"
{
  "visualDirection": "luminous",
  "theme": "default"
}
"@ | Out-File -Encoding UTF8 -FilePath "luminous-props.json"

# Verify
dir *.json
```

**Expected:** Two JSON files in project root ✅

---

#### 2. BATCH RENDER (30 min)
```powershell
cd "H:\DUAGENERATOR 2.0\remotion"
mkdir -p out/videos

# EDITORIAL
Write-Host "🎬 Rendering Editorial..." -ForegroundColor Cyan
npx remotion render src/index.ts sayyidul-istighfar `
  "out/videos/editorial.mp4" `
  --props="./editorial-props.json" `
  --concurrency=4

# LUMINOUS
Write-Host "🎬 Rendering Luminous..." -ForegroundColor Cyan
npx remotion render src/index.ts rabbi-zidni-probe-lum `
  "out/videos/luminous.mp4" `
  --props="./luminous-props.json" `
  --concurrency=4

# Verify
dir out/videos/
```

**Expected:** Two MP4 files (100+ MB each) ✅

---

#### 3. GITHUB SETUP (10 min)

##### A. Create repository on GitHub.com
```
https://github.com/new
- Name: duavideo-2.0
- Visibility: Public
- Click "Create repository"
```

##### B. Add remote + commit
```powershell
cd "H:\DUAGENERATOR 2.0\remotion"

# Configure Git
git config --global user.name "Your Name"
git config --global user.email "your@email.com"

# Add GitHub remote
git remote add origin https://github.com/YOUR-USERNAME/duavideo-2.0.git
git branch -M main

# Create .gitignore (copy content below)
# Then commit + push
git add .
git commit -m "🎬 Initial commit: DuaVideoGenerator 2.0"
git push -u origin main
```

**Expected:** Code appears on GitHub ✅

**Minimal .gitignore:**
```
node_modules/
*.mp4
*.png
out/
dist/
.env
.DS_Store
```

---

#### 4. CI/CD PIPELINE (10 min)

##### A. Create workflow file
```powershell
cd "H:\DUAGENERATOR 2.0\remotion"

# Create directories
New-Item -ItemType Directory -Force -Path ".github\workflows" | Out-Null

# Create render.yml (copy content below)
```

##### B. Commit + push workflow
```powershell
git add .github/
git commit -m "✅ Add GitHub Actions CI/CD pipeline"
git push origin main
```

##### C. Test workflow (GitHub UI)
```
1. Go to: https://github.com/YOUR-USERNAME/duavideo-2.0
2. Click "Actions" tab
3. Click "Render Videos & Upload Artifacts"
4. Click "Run workflow" button
5. Watch it render...
```

**Expected:** Green checkmarks ✅

---

## 📄 FILES TO CREATE/COPY

### File 1: `.gitignore`
```
node_modules/
dist/
out/
*.mp4
*.png
.env
.env.local
.DS_Store
package-lock.json
yarn.lock
.vscode/
.idea/
cache/
```

### File 2: `.github/workflows/render.yml`
```yaml
name: Render Videos & Upload Artifacts

on:
  push:
    branches: [main, develop]
  workflow_dispatch:

jobs:
  render:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 18.x
          cache: 'npm'
      
      - run: npm install
      - run: npx tsc --noEmit
      - run: mkdir -p out/videos
      
      - name: Render Editorial
        run: |
          npx remotion render src/index.ts sayyidul-istighfar \
            out/videos/editorial.mp4 \
            --props='{"visualDirection":"editorial"}' \
            --concurrency=4
      
      - name: Render Luminous
        run: |
          npx remotion render src/index.ts rabbi-zidni-probe-lum \
            out/videos/luminous.mp4 \
            --props='{"visualDirection":"luminous"}' \
            --concurrency=4
      
      - uses: actions/upload-artifact@v4
        with:
          name: rendered-videos
          path: out/videos/
          retention-days: 30
```

---

## ⏱️ TIMING BREAKDOWN

| Step | Task | Time | Status |
|------|------|------|--------|
| 1 | Create props files | 2 min | ⏳ |
| 2 | Batch render Editorial | 15 min | ⏳ |
| 3 | Batch render Luminous | 15 min | ⏳ |
| 4 | GitHub setup | 10 min | ⏳ |
| 5 | Push code + workflow | 5 min | ⏳ |
| 6 | Run CI/CD pipeline | 5 min | ⏳ |
| **TOTAL** | | **52 min** | 🚀 |

---

## ✅ SUCCESS CRITERIA

After finishing, you should have:

```
✅ LOCAL:
  - out/videos/editorial.mp4 (created)
  - out/videos/luminous.mp4 (created)
  - .github/workflows/render.yml (created)
  - .gitignore (created)
  - Git remote configured

✅ GITHUB:
  - Repository live at github.com/YOUR-USERNAME/duavideo-2.0
  - All code pushed to main branch
  - GitHub Actions tab shows successful renders
  - Artifacts section has both MP4 files
  - Next push will auto-trigger renders

✅ AUTOMATION:
  - Every commit to main = auto-render
  - Videos generated in ~20 min (GitHub runner)
  - Downloadable as artifacts
  - No manual intervention needed
```

---

## 🚨 COMMON ISSUES & FIXES

### "Remote already exists"
```powershell
git remote rm origin
git remote add origin https://github.com/YOUR-USERNAME/duavideo-2.0.git
```

### "npm: command not found"
```powershell
# Install Node.js from nodejs.org or:
# In PowerShell as Admin:
# (Install Node.js first, then)
npm install -g npm
npm install
```

### "Composition not found"
```powershell
# Verify it exists:
npx remotion compositions src/index.ts

# Should show:
# sayyidul-istighfar
# rabbi-zidni-probe-lum
# ... and others
```

### "Out of disk space"
```powershell
# Delete old renders:
Remove-Item "out/videos/*.mp4"

# Or reduce concurrency:
npx remotion render ... --concurrency=1
```

### "GitHub Actions timeout"
- GitHub default: 6 hours max
- Remotion render typically: 5-20 minutes
- If you get timeout, check GitHub Actions logs

---

## 📞 QUESTIONS?

All answers in: **SETUP_GUIDE.md**

---

## 🎬 START NOW!

Copy the commands above and paste into PowerShell.

**1 hour → Both videos + GitHub + CI/CD ready.** 🚀

---

**Status:** Ready to execute
**Next:** Run STEP 1 command
