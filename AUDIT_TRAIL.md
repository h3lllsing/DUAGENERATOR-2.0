# DUA VIDEO GENERATOR — COMPLETE AUDIT TRAIL
> Kya use ho raha hai, kyun use ho raha hai, kaise kaam karta hai
> Generated: 2026-09-01

---

## TABLE OF CONTENTS

1. [Tech Stack Overview](#1-tech-stack-overview)
2. [Python Dependencies](#2-python-dependencies)
3. [Node.js Dependencies](#3-nodejs-dependencies)
4. [Architecture Decisions](#4-architecture-decisions)
5. [Data Flow](#5-data-flow)
6. [External Services](#6-external-services)
7. [File Formats](#7-file-formats)
8. [Protocols](#8-protocols)
9. [Design Patterns](#9-design-patterns)
10. [Performance Choices](#10-performance-choices)
11. [Security Architecture](#11-security-architecture)
12. [Build Tools](#12-build-tools)
13. [Deployment](#13-deployment)

---

## 1. TECH STACK OVERVIEW

```
┌─────────────────────────────────────────────────────────────┐
│                    DUA VIDEO GENERATOR                       │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐        │
│  │   PYTHON    │  │   NODE.JS   │  │   REACT     │        │
│  │  Backend    │  │  Dashboard  │  │  Remotion   │        │
│  │             │  │  Server     │  │  Renderer   │        │
│  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘        │
│         │                │                │                 │
│         ▼                ▼                ▼                 │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐        │
│  │  Pillow     │  │  HTTP       │  │  Chrome     │        │
│  │  numpy      │  │  fs         │  │  Headless   │        │
│  │  OpenCV     │  │  crypto     │  │  GPU/ANGLE  │        │
│  │  imageio    │  │  child_proc │  │  Skia       │        │
│  │  MoviePy    │  │  PM2        │  │  React 18   │        │
│  └─────────────┘  └─────────────┘  └─────────────┘        │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │                    FFmpeg                            │   │
│  │  libx264 + AAC + loudnorm + sharpen + color grade   │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │                   edge-tts                           │   │
│  │  Microsoft Neural TTS (Arabic + Urdu)               │   │
│  │  WebSocket → bing.com/speech.platform               │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │              HarfBuzz + FreeType                     │   │
│  │  Arabic/Urdu text shaping + glyph rasterization     │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## 2. PYTHON DEPENDENCIES

### 2.1 edge-tts >=7.2.0
- **Kya hai:** Microsoft Edge Neural TTS engine
- **Kyun use ho raha hai:** Free, no API key chahiye, 100+ neural voices, Arabic aur Urdu dono support
- **Kaise kaam karta hai:** WebSocket connect karta hai `wss://speech.platform.bing.com` se, text bhejta hai, MP3 audio + WordBoundary JSONL sidecar milta hai
- **Kya replace kar sakta hai:** pyttsx3 (robotic), gTTS (limited), Azure Cognitive Services (paid)
- **File:** `core/tts_engine.py`

### 2.2 uharfbuzz >=0.42.0
- **Kya hai:** HarfBuzz text shaping library (Python binding)
- **Kyun use ho raha hai:** Arabic/Urdu text ka proper rendering — arabic_reshaper harakat (diacritics) drop kar deta hai, PIL mein GPOS nahi hai
- **Kaise kaam karta hai:** Logical Arabic text ko contextual glyph forms mein shape karta hai (ligatures, mark positioning, RTL reordering)
- **Kya replace kar sakta hai:** FreeType2 (sirf rasterizer), raqm (system DLL chahiye)
- **File:** `core/arabic_renderer.py`

### 2.3 freetype-py >=2.4.0
- **Kya hai:** FreeType font rasterizer
- **Kyun use ho raha hai:** HarfBuzz ke baad shaped glyphs ko bitmaps mein render karna hai
- **Kaise kaam karta hai:** `FT_LOAD_RENDER` se har glyph ka numpy bitmap banata hai for compositing
- **Kya replace kar sakta hai:** PIL `ImageFont.truetype` (glyph-level control nahi)
- **File:** `core/arabic_renderer.py`

### 2.4 Pillow >=10.0.0
- **Kya hai:** Image creation, manipulation, compositing
- **Kyun use ho raha hai:** Core image library — frames banana, gradients, text drawing, alpha compositing, filters
- **Kaise kaam karta hai:** Har frame PIL.Image RGBA surface hoti hai, uspe gradients/particles/text compose hote hain
- **Kya replace kar sakta hai:** OpenCV (heavier), Wand (ImageMagick)
- **Files:** `core/scene_engine.py`, `core/effects_engine.py`, `core/arabic_renderer.py`

### 2.5 numpy >=1.24.0
- **Kya hai:** Numerical arrays + vectorized operations
- **Kyun use ho raha hai:** Sab pixel manipulation ka foundation — gradients, effects math, vignette masks, particle positions
- **Kaise kaam karta hai:** PIL images ko numpy arrays mein convert karke vectorized operations apply karte hain (10-100x faster than Python loops)
- **Kya replace kar sakta hai:** Pure Python loops (bahut slow)
- **Files:** `core/scene_engine.py`, `core/effects_engine.py`, `core/arabic_renderer.py`

### 2.6 MoviePy >=2.0.0
- **Kya hai:** Video/audio clip manipulation
- **Kyun use ho raha hai:** Sirf audio operations ke liye — `AudioFileClip` duration measure karne, `concatenate_audioclips` merge karne, `write_audiofile` WAV write karne
- **Kaise kaam karta hai:** Arabic + Urdu audio ko sequentially merge karta hai, silence pad karta hai, 48kHz WAV output
- **Kyun nahi video ke liye:** MoviePy ka video writer FFmpeg control nahi deta (CRF/preset/profile nahi milta)
- **File:** `core/audio_mixer.py`

### 2.7 imageio >=2.31.0
- **Kya hai:** Fast frame-to-video writing via FFmpeg backend
- **Kyun use ho raha hai:** MoviePy se better FFmpeg control — CRF, preset, codec, pix_fmt directly set kar sakte hain
- **Kaise kaam karta hai:** Two-pass approach:
  - Pass 1: imageio writes ultrafast intermediate (CRF 10)
  - Pass 2: FFmpeg re-encodes with quality settings (CRF 15)
- **Kya replace kar sakta hai:** MoviePy `write_videofaster` (less control), OpenCV `VideoWriter` (limited codecs)
- **File:** `core/video_builder.py`

### 2.8 imageio-ffmpeg >=0.4.0
- **Kya hai:** Bundles FFmpeg binary for imageio
- **Kyun use ho raha hai:** Portable FFmpeg — system install nahi chahiye
- **Kaise kaam karta hai:** `imageio_ffmpeg.get_ffmpeg_exe()` returns bundled FFmpeg path
- **File:** `core/video_builder.py`, `core/audio_mixer.py`

### 2.9 opencv-python >=4.8.0
- **Kya hai:** Video analysis + image processing
- **Kyun use ho raha hai:** Quality checking (VideoCapture se FPS/resolution/duration), video analysis (frame extraction, color analysis), effects (CV2 operations)
- **Kaise kaam karta hai:**
  - `cv2.VideoCapture` — video properties read karta hai QC ke liye
  - `cv2.resize`, `cv2.GaussianBlur`, `cv2.multiply` — effects mein use hota hai
  - `cv2.CUDADeviceInfo` — GPU detection ke liye
- **File:** `core/quality_checker.py`, `core/video_analyzer.py`, `core/effects_engine.py`

### 2.10 scikit-learn >=1.3.0
- **Kya hai:** Machine learning — KMeans clustering
- **Kyun use ho raha hai:** Sample videos se dominant colors extract karna
- **Kaise kaam karta hai:** 5 clusters se primary/secondary/background colors nikalta hai reference videos se
- **Kya replace kar sakta hai:** Manual numpy k-means
- **File:** `core/video_analyzer.py`

### 2.11 cryptography >=41.0.0
- **Kya hai:** AES-128-CBC encryption via Fernet
- **Kyun use ho raha hai:** Security — vault data, API keys, credentials encrypt karta hai
- **Kaise kaam karta hai:**
  - `Fernet` — symmetric encryption (encrypt/decrypt)
  - `PBKDF2HMAC` — password se key derive karta hai (100k iterations)
  - Salt stored in `security/salt.bin`
- **File:** `core/security.py`

### 2.12 arabic-reshaper + python-bidi (SUPERSEDED)
- **Kya hai:** Legacy Arabic text shaping
- **Kyun nahi use ho raha:** arabic_reshaper harakat drop karta hai, bidi breaks multi-line text
- **Kya replace kiya:** HarfBuzz (uharfbuzz) ne replace kiya
- **Status:** Abhi requirements.txt mein hai but code mein use nahi ho raha

---

## 3. NODE.JS DEPENDENCIES

### 3.1 remotion 4.0.370
- **Kya hai:** React-based video rendering framework
- **Kyun use ho raha hai:** Modern declarative video — React components as video scenes, GPU-accelerated Chrome rendering
- **Kaise kaam karta hai:**
  - React components describe WHAT (not HOW)
  - Chrome headless renders frames
  - FFmpeg muxes to MP4
- **Alternatives:** FFmpeg + PIL (Python path), After Effects, Motion Canvas
- **File:** `remotion/src/DuaVideo.tsx`

### 3.2 @remotion/cli 4.0.370
- **Kya hai:** CLI for Remotion studio and rendering
- **Kyun use ho raha hai:** `npm run render` se video render karta hai
- **File:** `remotion/package.json`

### 3.3 @remotion/fonts 4.0.30
- **Kya hai:** Font loading for Remotion
- **Kyun use ho raha hai:** Arabic/Urdu fonts ko Chrome renderer mein properly load karna
- **File:** `remotion/src/fonts.ts`

### 3.4 @remotion/layout-utils 4.0.370
- **Kya hai:** Text measurement
- **Kyun use ho raha hai:** `measureText()` se Arabic/Urdu text ka auto-fit font size calculate karna
- **File:** `remotion/src/DuaVideo.tsx`

### 3.5 @remotion/transitions 4.0.370
- **Kya hai:** Scene transitions
- **Kyun use ho raha hai:** Arabic se Urdu scene pe smooth transitions
- **File:** Remotion compositions

### 3.6 @remotion/noise 4.0.370
- **Kya hai:** Perlin/simplex noise
- **Kyun use ho raha hai:** Procedural textures — aurora, grain, particles
- **File:** VFX layers

### 3.7 @remotion/lottie + lottie-web 5.12.2
- **Kya hai:** Lottie animation support
- **Kyun use ho raha hai:** After Effects animations render karna as lightweight SVG/Canvas
- **File:** Look variants

### 3.8 react 18.3.1 + react-dom 18.3.1
- **Kya hai:** UI library
- **Kyun use ho raha hai:** Remotion ka foundation — component model for video
- **File:** All `.tsx` files

### 3.9 typescript ^5.5.4
- **Kya hai:** Type-safe JavaScript
- **Kyun use ho raha hai:** Complex video composition mein type safety
- **File:** All `.tsx`/`.ts` files

---

## 4. ARCHITECTURE DECISIONS

### 4.1 Python for Backend — Kyun?
```
✅ Rich ecosystem: Pillow, numpy, OpenCV — sab Python-native
✅ Rapid iteration: TTS, audio, frames — procedural code mein fast
✅ HarfBuzz integration: uharfbuzz + freetype-py — system DLLs nahi chahiye
✅ FFmpeg control: imageio-ffmpeg se portable FFmpeg milta hai
✅ Video analysis: scikit-learn KMeans, OpenCV frame analysis
```

### 4.2 Node.js for Dashboard — Kyun?
```
✅ Zero dependencies: sirf built-ins (http, fs, crypto) — Express nahi chahiye
✅ Process management: child_process se Python processes spawn karta hai
✅ Remotion integration: same runtime as renderer
✅ PM2 + NSSM: Windows service management
✅ Static file serving: HTML/CSS/JS dashboard efficiently serve karta hai
```

### 4.3 React/Remotion for Video — Kyun?
```
✅ Declarative: components describe WHAT, not HOW
✅ GPU-accelerated: Chrome's Skia with ANGLE/D3D11
✅ Karaoke text: spring physics + per-word timing
✅ Look system: 15 style presets with deterministic selection
✅ VFX architecture: layered effect system with plugin extensibility
```

### 4.4 Dual Renderer — Kyun?
```
Python Engine (core/):
  → Frame-by-frame via Pillow → imageio → FFmpeg
  → Batch processing, CLI, original pipeline
  → More control, faster iteration

Remotion Engine (remotion/):
  → React components → Chrome headless → FFmpeg
  → Premium visual quality, karaoke sync
  → Dashboard integration
```

---

## 5. DATA FLOW

### 5.1 Main Pipeline (Python)
```
INPUT                    PROCESSING                      OUTPUT
─────                    ──────────                      ──────

duas.json ──────► TTSEngine.generate_audio()
  (Arabic + Urdu         │
   text)                 ├─► edge-tts API
                         │   WebSocket → bing.com
                         │   │
                         │   ▼
                         │   MP3 + JSONL sidecars
                         │   (word boundaries)
                         │
                         ├─► AudioMixer.merge_audio_sequential()
                         │   ├─ concatenate: Arabic + 0.3s gap + Urdu
                         │   ├─ pad_to_duration (VIDEO-002: 15-50s)
                         │   └─ normalize_loudness (-14 LUFS, 2-pass)
                         │
                         ├─► TimelineBuilder.build()
                         │   └─ scenes: Arabic → Gap → Urdu → Hold
                         │
                         ├─► SceneRenderer.render()
                         │   ├─ gradient backgrounds (numpy)
                         │   ├─ HarfBuzz text shaping (ArabicRenderer)
                         │   ├─ word highlighting (WordHighlight)
                         │   └─ [PIL.Image frames]
                         │
                         ├─► EffectDirector.plan()
                         │   └─ per-frame effect stack (AI brain)
                         │
                         ├─► EffectsEngine.apply_plan()
                         │   └─ vignette, grain, bloom, shimmer, etc.
                         │
                         ├─► VideoBuilder.build_video()
                         │   ├─ imageio: frames → temp MP4 (ultrafast)
                         │   └─ FFmpeg: re-encode + audio mux (quality)
                         │
                         └─► QualityChecker.check_video()
                               └─ resolution + duration + FPS gate
                                     │
                                     ▼
                               output/{category}/{title}.mp4
```

### 5.2 Remotion Pipeline
```
Python Output ──► prepare_dua.py ──► make_manifest.py
                      │                    │
                      ▼                    ▼
                  TTS + Audio         manifest.json
                      │                    │
                      └────────┬───────────┘
                               │
                               ▼
                        batch_render.py
                               │
                               ▼
                        Chrome headless
                        React components
                        (DuaVideo.tsx)
                               │
                               ▼
                        out/{id}.mp4
                        (premium quality)
```

---

## 6. EXTERNAL SERVICES

| Service | Protocol | Purpose | Auth |
|---|---|---|---|
| **Microsoft Edge TTS** | WebSocket (wss://speech.platform.bing.com) | Neural TTS for Arabic/Urdu | Free, no key |
| **YouTube Data API v3** | HTTPS | Upload + stats | OAuth2 |
| **Pexels API** | HTTPS | Stock backgrounds | API key |
| **Chrome/Chromium** | DevTools Protocol | Remotion renderer | Local process |

---

## 7. FILE FORMATS

| Format | Purpose | Kyun? |
|---|---|---|
| **JSON** | Dua database, config, metadata | Human-readable, Python/JS native |
| **JSONL** | WordBoundary timing sidecars | Line-delimited for streaming |
| **MP3** | Intermediate TTS audio | Small files for temp storage |
| **WAV (PCM 16-bit, 48kHz)** | Intermediate merged audio | Lossless — speech quality preserved |
| **MP4 (H.264/AAC)** | Final video output | YouTube-compatible, web-streamable |
| **TTF** | Font files | TrueType for Arabic/Urdu |
| **.enc** | Encrypted vault/keys | Fernet-encrypted at rest |
| **PNG** | Static assets | Lossless for fonts/decorations |

---

## 8. PROTOCOLS

| Protocol | Where | Purpose |
|---|---|---|
| **HTTP/1.1** | Dashboard server | localhost:7860 — UI + API |
| **WebSocket** | edge-tts | Real-time TTS + WordBoundary streaming |
| **OAuth2** | YouTube API | Token-based auth for uploads |
| **Bearer Token** | Dashboard API | `Authorization: Bearer <token>` |
| **CORS** | Dashboard API | Blocks cross-origin except localhost |
| **Rate Limiting** | Dashboard API | 30 requests/2s on mutations |
| **EBU R128** | FFmpeg loudnorm | -14 LUFS / -1.0 dBTP |
| **DevTools Protocol** | Chrome headless | Remotion frame rendering |

---

## 9. DESIGN PATTERNS

| Pattern | Where | Purpose |
|---|---|---|
| **Pipeline** | `main.py:DuaVideoPipeline` | Sequential stages: TTS → Audio → Frames → Video → QC |
| **Strategy** | `effects_engine.py` | Pluggable effect functions selected by name at runtime |
| **Director** | `effect_director.py` | Content-analysis brain decides effect stacks |
| **Factory** | `scene_engine.py` | Deterministically creates Scene objects from content + seed |
| **Observer** | `word_highlight.py` | WordBoundary events drive visual highlights |
| **Template Method** | `main.py` | Shared pipeline structure with customizable entry points |
| **State** | `security.py` | Vault state machine (6 states) |
| **Cache** | `arabic_renderer.py` | HarfBuzz/FreeType faces loaded once, reused |
| **Deterministic Seeding** | Throughout | `dua_id` → hash → `random.Random(seed)` — same dua = same video |
| **Two-Pass** | `audio_mixer.py` | Pass 1: measure; Pass 2: apply linear gain |
| **Atomic Write** | `security.py`, `self_trainer.py` | temp → fsync → os.replace() |
| **Fallback Cascade** | `scene_engine.py` | wrap → shrink → reduce spacing → alternate layout |

---

## 10. PERFORMANCE CHOICES

### 10.1 imageio over MoviePy for Video
```
MoviePy:
  - write_videofaster() — less FFmpeg control
  - No CRF/preset/profile/level settings
  - Good for simple video tasks

imageio:
  - Direct FFmpeg parameter control
  - Two-pass: ultrafast intermediate → quality mux
  - Fine-grained codec settings
  - Better for production pipelines
```

### 10.2 edge-tts over Other TTS
```
edge-tts:
  ✅ Free — no API key, no billing
  ✅ Neural voices — natural sounding
  ✅ WordBoundary metadata — karaoke sync
  ✅ 100+ voices — multiple Arabic/Urdu variants
  ✅ Voice rotation — deterministic per-dua selection

Alternatives:
  ❌ pyttsx3 — robotic quality
  ❌ gTTS — limited voices
  ❌ Azure Cognitive Services — paid
  ❌ Amazon Polly — paid
```

### 10.3 FFmpeg for Everything
```
Why FFmpeg:
  ✅ Industry standard — YouTube-optimized encoding
  ✅ Loudness normalization — EBU R128 loudnorm
  ✅ Post-processing — sharpen, color grade, pixel format
  ✅ Portable — bundled via imageio-ffmpeg
  ✅ GPU support — Remotion uses Chrome's Skia with ANGLE

What FFmpeg Does:
  1. Video encoding: libx264 (H.264)
  2. Audio encoding: AAC
  3. Loudness: -14 LUFS / -1.0 dBTP
  4. Post-processing: unsharp mask, saturation, contrast
  5. Muxing: video + audio → MP4
  6. Flags: +faststart (moov atom front)
```

### 10.4 ANGLE GPU Renderer (Remotion)
```
remotion.config.ts:
  Config.setChromiumOpenGlRenderer('angle')

Why ANGLE:
  ✅ Forces D3D11 hardware GPU path on Windows
  ✅ Faster than software rendering (swangle)
  ✅ Chrome's Skia uses GPU acceleration
```

---

## 11. SECURITY ARCHITECTURE

### 11.1 Encryption
```
Algorithm:    AES-128-CBC (Fernet)
Key Derivation: PBKDF2-HMAC-SHA256 (100,000 iterations)
Salt:         Random 16-byte per-installation
Storage:      security/salt.bin + security/vault.enc
```

### 11.2 Vault State Machine
```
    ┌──────────┐
    │ missing  │──── create ────►┌─────┐
    └──────────┘                │ new │
                                └─────┘
                                    │
                    ┌───────────────┼───────────────┐
                    ▼               ▼               ▼
              ┌──────────┐   ┌──────────┐   ┌──────────┐
              │ legacy   │   │  wrong   │   │ corrupt  │
              │          │   │ password │   │          │
              └──────────┘   └──────────┘   └──────────┘
                    │               │               │
                    ▼               ▼               ▼
              migrate()      retry()         rebuild()
```

### 11.3 Security Measures
- **Atomic writes:** temp → fsync → os.replace() — crash-safe
- **Secure delete:** Overwrite with random data before removal
- **Dashboard auth:** Bearer token (48-char hex)
- **CORS:** Blocks cross-origin except localhost
- **Rate limiting:** 30 requests/2s on mutations
- **Gitignore:** 70+ rules excluding secrets, outputs, temp

---

## 12. BUILD TOOLS

| Tool | Purpose |
|---|---|
| **FFmpeg** (bundled) | Video/audio encoding, loudness, post-processing |
| **imageio-ffmpeg** | Portable FFmpeg binary |
| **npm** | Node.js package manager |
| **pip** | Python package manager |
| **pytest** | Python test runner |
| **PM2** | Node.js process manager |
| **NSSM** | Windows service wrapper |
| **PowerShell** | Windows automation |
| **Batch (.bat)** | Quick-launch scripts |
| **GitHub Actions** | CI/CD (pytest + syntax check) |

---

## 13. DEPLOYMENT

### 13.1 Windows Service
```
NSSM ──► PM2 ──► Node.js Dashboard Server (port 7860)
                  │
                  ├── Remotion CLI ──► Chrome headless ──► Video render
                  ├── Python pipeline ──► FFmpeg ──► Video render
                  └── YouTube upload ──► OAuth2 ──► YouTube API
```

### 13.2 Process Management
```
PM2 ecosystem.config.js:
  - name: "dua-dashboard"
  - script: "server.js"
  - instances: 1
  - autorestart: true
  - watch: false
  - max_memory_restart: "500M"
```

### 13.3 CI/CD
```
.github/workflows/ci.yml:
  - Python 3.11 + 3.12
  - pytest (full test suite)
  - Syntax check
  - Remotion TypeScript check
```

---

## 14. KEY CONSTANTS

| Constant | Value | Kyun? |
|---|---|---|
| `VIDEO_WIDTH` | 1080 | YouTube Shorts vertical |
| `VIDEO_HEIGHT` | 1920 | YouTube Shorts vertical |
| `VIDEO_FPS` | 45 | Smooth playback (not 30, not 60) |
| `VIDEO_MIN_DURATION` | 15s | YouTube Shorts minimum |
| `VIDEO_MAX_DURATION` | 50s | Comfortable max |
| `AUDIO_SAMPLE_RATE` | 48000 Hz | Lossless quality |
| `AUDIO_BITRATE` | 192k | AAC final output |
| `LOUDNESS_TARGET` | -14 LUFS | YouTube/TikTok standard |
| `TRUE_PEAK_TARGET` | -1.0 dBTP | Broadcast standard |
| `FFMPEG_CRF` | 15 | Near-lossless quality |
| `SAFE_RECT` | (60,110,1020,1810) | Text never exceeds this |

---

## 15. SUMMARY

### Tech Stack
- **Backend:** Python 3.11+ (Pillow, numpy, OpenCV, imageio, edge-tts, HarfBuzz)
- **Frontend:** CustomTkinter GUI + Express.js Dashboard
- **Video Rendering:** Dual engine (Python Pillow + React/Remotion)
- **Audio:** edge-tts (Microsoft Neural) + FFmpeg loudnorm
- **Text:** HarfBuzz + FreeType (Arabic/Urdu shaping)
- **Encoding:** FFmpeg (libx264 + AAC)
- **Security:** AES-128-CBC (Fernet) + PBKDF2
- **Deployment:** PM2 + NSSM (Windows service)

### Key Decisions
1. **Python** for backend — rich ecosystem, rapid iteration
2. **Node.js** for dashboard — zero deps, Remotion integration
3. **React/Remotion** for premium rendering — declarative, GPU-accelerated
4. **edge-tts** for TTS — free, neural quality, WordBoundary metadata
5. **HarfBuzz** for Arabic — proper shaping without system DLLs
6. **FFmpeg** for everything — industry standard, YouTube-optimized
7. **Two-pass video** — ultrafast intermediate → quality mux
8. **Deterministic seeding** — same dua = same video (consistency)

---

*End of Audit Trail — Complete tech stack documentation*
