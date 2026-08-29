# ============================================================
# DUA VIDEO GENERATOR - SYSTEM AUDIT
# Channel: Noor-e-Iman (@bushranasir1075)
# Date: 2026-08-29
# Type: Full-system audit + documentation (backend / dashboard / render)
# Status: ACTIVE reference — sab subsystems ka v9 facts + status
# ============================================================

> Source: 3 parallel explore audits (Python backend / Node dashboard /
> Remotion render) + security re-verification + test suite results.
> Ye document "manual search karna padega" ki jaga ek hi jagah system ka
> poori haqeeqat rakhta hai.

---

## 1. PROJECT OVERVIEW (CURRENT STATE)

Automated YouTube Shorts generator for Islamic Duas — Arabic karaoke +
Urdu translation + voice narration + Pexels photo/video backgrounds +
web dashboard. Khud render/upload nahi hota — hamesha user permission se.

| Fact | Value |
|---|---|
| Resolution | 1080×1920 (9:16 portrait, YouTube Shorts) |
| Backend FPS (scene_engine) | 80 |
| Remotion render FPS (manifest) | 24 |
| Codec | H.264 High @ level 4.1, yuv420p, +faststart |
| Audio | AAC 192k, 48 kHz stereo |
| Loudness target | -14 LUFS integrated / -1 dBTP / LRA 11 (2-pass LINEAR) |
| Dua database | 110 duas, 18 categories (`data/duas.json`) |
| Remotion compositions | 107 dua manifests (`remotion/src/data/*.json`) |
| Dashboard | http://127.0.0.1:7860, bearer auth |
| Remotion CRF | 18, jpeg-quality 100 |
| Pexels backgrounds | 854 approved assets, ~169 downloaded |
| Git | branch `main`, remote h3lllsing/DuaVideoGenerator |

> NOTE: Audit agents ne das whya "377 tracked files" aur "80fps scene engine /
> 24fps remotion" — do alag render paths hain (legacy scene_engine vs Remotion
> production path). Is amal ka production render Remotion (24fps) hai.

---

## 2. ARCHITECTURE — 3 SUBSYSTEMS

```
┌─────────────────────────────────────────────────────────────┐
│                     MAIN.PY (orchestrator)                  │
│  core/(tts, audio_mixer, video_builder, quality_checker,    │
│         scene_engine, arabic_renderer, easing, security...) │
│  data/duas.json · data/categories.json   -> legacy path     │
└─────────────────────────────────────────────────────────────┘
                          │
                          ▼ (Remotion production path)
┌─────────────────────────────────────────────────────────────┐
│                 DASHBOARD (Node http :7860)                 │
│  server.js -> routes/{render,youtube,duas,config}.js        │
│  spawn: prepare_dua.py -> make_manifest.py -> look-spec.js  │
│        -> remotion-cli render -> qc.py -> thumbnail         │
└─────────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────┐
│        REMOTION (React, 1080×1920 @24fps, 107 comps)        │
│  DuaVideo.tsx · Background.tsx · KaraokeText.tsx            │
│  GradeLayer.tsx · LookVariants.tsx · themes.ts · easing.ts  │
└─────────────────────────────────────────────────────────────┘
```

--- 

## 3. PYTHON BACKEND (`core/`) — AUDIT

### 3.1 Modules
| File | Purpose |
|---|---|
| `tts_engine.py` | Edge-TTS (ar-SA-HamedNeural, ur-PK-AsadNeural), word-boundary JSONL sidecars |
| `audio_mixer.py` | Merge Arabic+Urdu, VIDEO-002 duration policy, 2-pass LINEAR loudnorm |
| `video_builder.py` | Frames→MP4, CRF-15 slow re-encode mux, sharpening + color grade |
| `quality_checker.py` | OpenCV gate: duration 15–50s, exact 1080×1920, exact 80fps, ≤100MB |
| `scene_engine.py` | Legacy 80fps scene renderer, SAFE_RECT content-safety geometry |
| `arabic_renderer.py` | HarfBuzz+FreeType RTL text, GPOS harakat |
| `easing.py` | Easing curve registry (Apple bezier, back, expo...) |
| `dua_database.py` | Loads duas.json/categories.json, `DB` singleton |
| `asset_registry.py` | Pexels asset SHA-256/license gate + deterministic selection |
| `effects_engine.py` + `effect_director.py` | Legacy fx + AI "director" scene-aware plan |
| `security.py` | Fernet/AES-128-CBC vault, PBKDF2-SHA256, git-ignored vault |
| `timeline_builder.py` | Audio timing → visual timeline |
| `metadata_generator.py` | YouTube title/desc/tags/hashtags |

### 3.2 Audio pipeline (contract)
- 48 kHz, stereo, `pcm_s16le` lossless intermediate (AUDIO-001).
- **2-pass LINEAR loudnorm**: pass1 measure → pass2 apply linear gain,
  targeting **-14 / -1.0 / LRA 11**. Normalize BEFORE hold-silence pad.
- Dynamic mode never used (keeps dual-mono TTS quality).

### 3.3 Key findings / tech debt
| Sev | Finding | Status |
|---|---|---|
| INFO | `categories.json` says `total_duas: 80` but file has **110** (stale count) | open |
| INFO | Stale "15-25s" comments vs config 15-50s (`timeline_builder` fallback 25) | open |
| INFO | `metadata_generator`/`config` cover only 8 categories vs actual 18 | open |
| INFO | `revamp_engine.py` = stub (legacy), `self_trainer`/`video_analyzer` legacy path | open |
| INFO | TTS docstring mentions Gemini routing but only edge-tts implemented | open |

---

## 4. DASHBOARD (`remotion/dashboard/`) — AUDIT

### 4.1 Architecture
- **Bare Node http server** (no Express), port **7860**, binds `127.0.0.1` only.
- Router factory pattern: `routes/{render,youtube,duas,config}.js`.
- PM2 (`ecosystem.config.js`), fork/1 instance, `--max-old-space-size=512`.
- Env: `PYTHON`, `CHROME_PATH`, `FFMPEG_PATH`.

### 4.2 API endpoints
| Method+Path | Purpose |
|---|---|
| POST `/api/render` | Render one dua (refuses unless `force`) |
| POST `/api/render-all` | Batch render all non-archived/non-rendered |
| POST `/api/cancel` | taskkill /T /F current + helper children |
| GET `/api/status` | Live job + queue + progress |
| POST `/api/voice-only` | TTS+merge+manifest only (no video) |
| POST `/api/tts-custom` | Custom Arabic/Urdu TTS→mp3 |
| POST `/api/thumbs-all` | Generate all missing thumbnails |
| GET `/api/history` | Last 200 render history entries |
| GET `/api/duas` · POST add/update/delete | Dua CRUD |
| GET/POST `/api/ai-config` · POST `/api/ai-import` | AI generation (aihubmix) |
| GET/POST `/api/config` | Channel/config/look settings |
| GET `/api/youtube/*` | status/settings/secret/auth/upload/cancel/uploaded/stats/re-upload |

### 4.3 Rendering pipeline (render.js)
```
prepare_dua.py (TTS+merge) -> make_manifest.py -> look-spec.js (--props)
  -> remotion-cli render <comp> out/<name> --crf=18 --jpeg-quality=100
  -> ffmpeg BT.709 tag -> qc.py (loudness) -> thumbnail still -> metadata
```
- Single-flight: 1 job + 1 queue, both must be idle to start.
- Cache key = md5(dua JSON + audio mtime/size + config + sfx).
- Spawn: shell-less (argv arrays), `windowsHide: true`.

### 4.4 Security posture
| Item | Status |
|---|---|
| Binds localhost only | ✅ |
| Bearer token on all `/api/*` | ✅ (but token injected into `window.AUTH_TOKEN`) |
| Origin check (localhost only) | ✅ |
| 1 MB body cap, path-traversal guards | ✅ |
| Path basename/allowlist on media | ✅ |
| Rate limit | ⚠️ only on render/tts-custom/render-all (30/2s) |
| Media `/video /audio /thumb` | ⚠️ unauthenticated by design (needed for `<video>`) |
| No HTTPS / no CSP | ⚠️ acceptable for localhost, risky if exposed |

---

## 5. REMOTION RENDER (`remotion/src/`) — AUDIT

### 5.1 Compositions (Root.tsx)
- **107 dua comps** auto-loaded via `require.context('./data', /\.json$/)`.
- Each: fps 24, 1080×1920, `INTRO_FRAMES=66` (≈2.75s) + content + `END_FRAMES=74`.
- `StylePreview` (1280×720, dev) + `thumbnail-card` (1080×1920 still).

### 5.2 Layer stack (DuaVideo.tsx, bottom→top)
```
CameraMove (M1) wraps all:
  1. Background (animated scene + Pexels image/video + scrim + starfield)
  2. LookTint       3. MotifLayer     4. GeometricBackdrop
  5. BorderFx       6. ArtFx          7. SkyFx
  8. IntroCard [0..66]               9. content [66..66+content]: title, Arabic KaraokeText,
                                        Urdu KaraokeText (clock-wipe), Ornament, sweep
 10. Progress bar                    11. EndCard [66+content-14 .. +74]
Audio: narration (merged) @66, whoosh @urduStart-8, riser (ramped), tick @end
GradeLayer (M7) topmost grade film + CSS grade filter
```

### 5.3 M-series premium effects (all DONE)
| FX | File | Values |
|---|---|---|
| **M1 Camera drift** | `LookVariants.tsx` | `BASE_DRIFT=0.030` (~3% push-in), `NOISE_AMP_PX=5` Perlin micro-wander; named zoomin/panx/kenburns/driftbreathe |
| **M2 Kinetic karaoke** | `KaraokeText.tsx` | Perlin float (±2.6px), `popwave` spec spring {0.5,200,14}, glide 1+0.07 pop, typewriter caret |
| **M3 Starfield depth** | `Background.tsx` | 3 parallax planes (46/38/26 stars, speed 0.05/0.16/0.34), twinkle + near-plane breeze ±6px |
| **M4 Gold shimmer** | `Background.tsx` | `GOLD_SHADOW=#5d4510 GOLD_BASE=#dcb93f GOLD_SPEC=#fff6d4 GOLD_DEEP=#7c5c18`; 4.0s specular sweep (17-stop metallic grad) |
| **M5 Geometric** | `LookVariants.tsx` | MotifSvg: tasbih/kaaba/rehal/star8/dodecagram/rosette/strapwork; GeometricBackdrop lattice opacity 0.06 rotate |
| **M6 Easing kit** | `easing.ts` | 10 curves: easeOut(Cubic alias)/Quart/Quint/Expo, easeIn, easeInOut, easeOutBack, **apple**(0.16,1,0.3,1), **material**(0.4,0,0.2,1) |
| **M7 Grade breathing** | `GradeLayer.tsx` | `breath=base+amp*sin(t*0.11)`; tint amp 0.07, bloom amp 0.08 (mood 0.07/0.08) |

### 5.4 Karaoke & readability
- Active word = latest started (`floor(start*fps)<=frame`), exactly 1/frame.
- **Stroke**: `strokePx = max(2.5, fontSize*0.065)` → ~5.2px @80px font (4–6px spec band), `WebkitTextStroke` + **`paintOrder:'stroke fill'`**.
- Arabic `fitFontSize` (base 104/min 58), Urdu (base 50/min 32); `dir="rtl"`.

### 5.5 Themes
- 11 themes: dark/mosque/sunset/manuscript/emerald/ocean/desert/royal/ramadan/eid/qadr.
- Category→theme rotation (make_manifest.py `CATEGORY_THEME`, `CATEGORY_ROTATIONS`);
  general rotation `(manuscript,dark,royal,emerald)` seeded by id hash.
- Style-preset resolution order: `masterpiece > lookSpec.preset > stylePreset > autoPresetFor(id)` (15 AUTO_PRESETS).

### 5.6 Dead code / notes
- `package.json` `"render"` script is a hard-coded generic placeholder (not real dua).
- `hashDir()` duplicated in static/unknown branches of CameraMove.
- Legacy flat look fields kept for backward compat (intentional).

---

## 6. SECURITY VERIFICATION (2026-08-29 re-check)

Sab sensitive files **git-ignored** hain (none tracked):
```
data/ai_api_config.json          (git-ignored)  live aihubmix keys on disk
data/gemini_api_key.txt          (git-ignored)  Google key on disk
data/yt_token_channel*.json      (git-ignored)  OAuth refresh tokens
client_secret.json               (git-ignored)  Google OAuth client secret
security/  (vault.enc, salt.bin, keys/*.enc)    (git-ignored)
remotion/dashboard/auth.json     (git-ignored)  dashboard bearer token
remotion/src/data/ai_api_config.json  (git-ignored)  AB PLACEHOLDER sk-TEST123
```
- `remotion/src/data/ai_api_config.json` = **test placeholder** (`sk-TEST123`),
  deliberately excluded from composition loading — safe.
- Ke eps **tracked** state files (non-sensitive, operational only):
  `data/quota_state_channel1.json` (date→units), `data/upload_state_channel1.json`
  (dua_id→upload status), `data/duas.backup.json`, `data/duas.pre_pillar1.backup.json`.
- **Git hygiene: ✅ clean** — koi live key commit nahi hua (secret-scan silent).

> RECOMMENDATION: agar repo future me public clone hoga, `data/duas.backup.json`
> aur state files bhi `.gitignore` ho sakti hain (dua data public hai, lekin
> state operational hai). Decision user par.

---

## 7. TEST SUITE STATUS (2026-08-29)

| Suite | Result |
|---|---|
| All `tests/` except e2e | **400 passed** (233.90s), warnings only (moviepy numpy deprecation, teardown logging) |
| Fast subset | 87 passed |
| `test_asset_registry.py` | **fixed** (was red) → renamed `test_real_manifest_parses_and_selects_real_asset`, asserts 854 assets resolve; 28 passed |
| `test_e2e_render.py` | E2E only — real edge-tts network + render, NOT run (render permission required; slow) |
| `npx tsc --noEmit` (Remotion) | clean (0 errors) |

> MASTER_PLAN §6 ka purana red-test note ab RESOLVED hai.

---

## 8. this-session VISUAL/QUALITY POLISH (committed in 60431dd)

| Area | Change |
|---|---|
| M1 camera | `BASE_DRIFT 0.024→0.030`, `NOISE_AMP_PX 4→5` |
| M4 gold | `GOLD_SHADOW #6e5212→#5d4510`, `GOLD_BASE #d4af37→#dcb93f`, `GOLD_SPEC #fff3c4→#fff6d4`, `GOLD_DEEP #8a6a1f→#7c5c18` |
| M7 breathing | tint amp ±0.04→±0.07, bloom amp ±0.05→±0.08 |
| Audio | verified dual-mono SPEECH (L/R corr 1.000), stereo 2ch contract preserved |
| New dua | `maghfirat_aur_rahmat_ki_comprehensive_dua` added |
| Commit | `60431dd` feat(premium): M1-M7 kit + red-test fix + dua (15 files, +838/-63) |

---

## 9. OPEN ITEMS / BACKLOG

| # | Item | Kind |
|---|---|---|
| 1 | **Bulk re-render + final visual verify** (M1-M7 + polish) | LAST, needs render permission |
| 2 | `categories.json` count sync (80 vs 110) | low-pri doc fix |
| 3 | Stale 15-25s comments + fallback constants | low-pri cleanup |
| 4 | metadata_generator category coverage (8 vs 18) | medium feature |
| 5 | AI import (aihubmix) — quota exhausted, external key needed | blocked |
| 6 | `out/` untracked — add to .gitignore? | decision |
| 7 | Rate-limit on other mutating endpoints | security hardening |
| 8 | State/backup json files git-ignore (if public) | security hygiene |

---

## 10. VERIFY / RUN PIPELINE (reference)
```
# prepare audio+manifest
python remotion/scripts/prepare_dua.py <dua_id> --force
python remotion/scripts/make_manifest.py <dua_id>
# render
node remotion/node_modules/@remotion/cli/remotion-cli.js render \
  "<comp-id>" "out/<name>_final.mp4" \
  "--browser-executable=C:\Program Files\Google\Chrome\Application\chrome.exe" \
  --crf=18 --jpeg-quality=100 --log=error
# tests (skip slow e2e)
python -m pytest tests/ --ignore=tests/test_e2e_render.py
```

## 11. QUALITY GATES (RFC)
- Loudness: -14 LUFS ±1; Peak < -1 dBFS (no clip)
- Text readable: black stroke 4-6px, contrast >4.5:1
- Resolution 1080×1920, bitrate 8-12 Mbps, bg natural (photo/video) matched to category
