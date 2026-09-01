# DUA VIDEO GENERATOR — MASTER PORTAL LIST
> Complete inventory of every component, system, and capability
> Generated: 2026-09-01

---

## 1. SECURITY

| # | Component | File | Purpose |
|---|---|---|---|
| 1.1 | AES Encryption | `core/security.py` | Fernet AES-128-CBC vault encryption |
| 1.2 | Key Derivation | `core/security.py` | PBKDF2-HMAC-SHA256 (100K iterations) |
| 1.3 | Vault File | `security/vault.enc` | Encrypted secrets at rest |
| 1.4 | Salt File | `security/salt.bin` | Per-installation random salt |
| 1.5 | Key Storage | `security/keys/` | Encrypted API keys directory |
| 1.6 | Gitignore Rules | `.gitignore` | 70+ rules excluding secrets, outputs, temp |
| 1.7 | OAuth Credentials | `client_secret.json` | Google OAuth2 for YouTube API |
| 1.8 | YouTube Tokens | `data/yt_token_channel1.json` | OAuth refresh tokens |
| 1.9 | AI API Config | `data/ai_api_config.json` | API keys (gitignored) |
| 1.10 | Gemini Key | `data/gemini_api_key.txt` | Gemini API key (gitignored) |
| 1.11 | Dashboard Auth | `remotion/dashboard/auth.json` | Bearer auth (gitignored) |

---

## 2. BACKEND — Python Core

### 2.1 Project Infrastructure
| # | Component | File | Purpose |
|---|---|---|---|
| 2.1.1 | Config | `config.py` | Master config (227 lines) — FPS, durations, voices, themes, paths |
| 2.1.2 | Project Info | `core/project_info.py` | Singleton PROJECT with all paths/metadata |
| 2.1.3 | Logger | `core/logging_config.py` | Rotating file + console logging |
| 2.1.4 | Version | `core/__init__.py` | v0.10.0 |

### 2.2 Database
| # | Component | File | Purpose |
|---|---|---|---|
| 2.2.1 | Dua DB | `core/dua_database.py` | Load/query duas.json |
| 2.2.2 | Data Files | `data/duas.json` | 103 duas, 17 categories |
| 2.2.3 | Categories | `data/categories.json` | Category taxonomy |

### 2.3 Audio Engine
| # | Component | File | Purpose |
|---|---|---|---|
| 2.3.1 | TTS Engine | `core/tts_engine.py` | edge-tts wrapper, voice pools, word-boundary capture |
| 2.3.2 | Audio Mixer | `core/audio_mixer.py` | Sequential merge, duration policy, loudness normalization |
| 2.3.3 | Voice Pool | `config.py:63-69` | 6 Arabic + 6 Urdu voices (male/female) |
| 2.3.4 | Prosody | `tts_engine.py` | Arabic: rate -8%, pitch -2Hz; Urdu: rate -5%, pitch -1Hz |
| 2.3.5 | Word Boundaries | `tts_engine.py` | JSONL sidecar with 100ns-precision timing |

### 2.4 Video Engine
| # | Component | File | Purpose |
|---|---|---|---|
| 2.4.1 | Scene Engine | `core/scene_engine.py` | Procedural renderer (797 lines) — gradients, particles, text layout |
| 2.4.2 | Timeline Builder | `core/timeline_builder.py` | Multi-scene timeline from audio + VIDEO-002 |
| 2.4.3 | Video Builder | `core/video_builder.py` | Frames→MP4 via imageio + FFmpeg mux |
| 2.4.4 | Quality Checker | `core/quality_checker.py` | Resolution + duration + FPS validation |

### 2.5 Effects System
| # | Component | File | Purpose |
|---|---|---|---|
| 2.5.1 | Effects Engine | `core/effects_engine.py` | 6 legacy + 11 AI effects (817 lines) |
| 2.5.2 | Effect Director | `core/effect_director.py` | Content-aware effect scoring brain |
| 2.5.3 | Easing | `core/easing.py` | 10 professional motion curves |

### 2.6 Text Rendering
| # | Component | File | Purpose |
|---|---|---|---|
| 2.6.1 | Arabic Renderer | `core/arabic_renderer.py` | HarfBuzz + FreeType text shaping |
| 2.6.2 | Word Highlight | `core/word_highlight.py` | Karaoke word-by-word highlighting |

### 2.7 Intelligence
| # | Component | File | Purpose |
|---|---|---|---|
| 2.7.1 | Self Trainer | `core/self_trainer.py` | Feedback learning system |
| 2.7.2 | Video Analyzer | `core/video_analyzer.py` | Sample video style analysis |
| 2.7.3 | Revamp Engine | `core/revamp_engine.py` | Effect/color scheme registry |
| 2.7.4 | Metadata Gen | `core/metadata_generator.py` | YouTube title/desc/tags |

### 2.8 Hardware
| # | Component | File | Purpose |
|---|---|---|---|
| 2.8.1 | Hardware Detect | `core/hardware.py` | CPU/GPU detection, OpenCL blur |
| 2.8.2 | Asset Registry | `core/asset_registry.py` | Background manifest + checksum |

### 2.9 Orchestrator
| # | Component | File | Purpose |
|---|---|---|---|
| 2.9.1 | Main Pipeline | `main.py` | End-to-end orchestrator (888 lines) |
| 2.9.2 | Pipeline Class | `main.py:DuaVideoPipeline` | 5-step generation pipeline |
| 2.9.3 | Interactive Menu | `main.py` | CLI menu with 7 options |
| 2.9.4 | Temp Cleanup | `main.py` | atexit + signal handlers |

---

## 3. FRONTEND — GUI

| # | Component | File | Purpose |
|---|---|---|---|
| 3.1 | Main GUI | `frontend/wife_app.py` | CustomTkinter app (821 lines) |
| 3.2 | Effect Preview | `frontend/effect_preview.py` | Cached preview MP4s |
| 3.3 | Launcher | `run_frontend.py` | GUI startup script |

### GUI Features
- Category sidebar with search
- Dua list with preview
- Effect/color selector
- Generation with progress tracking
- Add/Edit/Delete duas
- Context menus + keyboard shortcuts
- Atomic file persistence with backup

---

## 4. VFX — Visual Effects

### 4.1 Legacy Effects (frame-level)
| # | Effect | Description |
|---|---|---|
| 4.1.1 | `neon_glow` | Pulsing neon glow with blur + brightness |
| 4.1.2 | `metallic_gold` | Gold gradient overlay with shimmer |
| 4.1.3 | `typewriter` | Character-by-character reveal |
| 4.1.4 | `bounce` | Text bounces in from top |
| 4.1.5 | `wave` | Row-by-row wave distortion |
| 4.1.6 | `glitch` | RGB channel separation |

### 4.2 AI Director Effects (numpy/opencv)
| # | Effect | Description |
|---|---|---|
| 4.2.1 | `bloom_glow` | Tinted bloom from bright regions |
| 4.2.2 | `gold_shimmer` | Animated gold band sweep |
| 4.2.3 | `breathing` | Subtle brightness oscillation |
| 4.2.4 | `vignette` | Radial darkening mask |
| 4.2.5 | `grain` | Film grain overlay |
| 4.2.6 | `rtl_reveal` | Right-to-left progressive reveal |
| 4.2.7 | `glitch_v2` | Slice displacement + RGB split |
| 4.2.8 | `word_pulse` | Gaussian word-sync flash |
| 4.2.9 | `aurora` | Animated soft light-leak washes |
| 4.2.10 | `title_hook` | Ken Burns zoom + golden bloom |
| 4.2.11 | `summary_card` | Glass-style outro card |

### 4.3 Scene Transitions
| # | Transition | Description |
|---|---|---|
| 4.3.1 | `fade` | Cross-fade between scenes |

### 4.4 Particle Systems
| # | Particle | Description |
|---|---|---|
| 4.4.1 | Dust | Floating particles |
| 4.4.2 | Bokeh | Out-of-focus light circles |
| 4.4.3 | Corner Decorations | Animated corner elements |

---

## 5. STYLING — Themes & Colors

### 5.1 Themes
| # | Theme | Colors |
|---|---|---|
| 5.1.1 | `dark` | Purple gradient + gold accent |
| 5.1.2 | `light` | White gradient + blue accent |
| 5.1.3 | `islamic` | Green gradient + gold accent |
| 5.1.4 | `minimal` | Black gradient + white accent |

### 5.2 Palettes
| # | Palette | Type |
|---|---|---|
| 5.2.1 | `midnight` | Dark (premium) |
| 5.2.2 | `twilight` | Dark (premium) |
| 5.2.3 | `emerald` | Dark (premium) |
| 5.2.4 | `navy` | Dark (premium) |
| 5.2.5 | `mist` | Light |
| 5.2.6 | `sand` | Light |

### 5.3 Category Moods
| # | Category | Tint | Bold | Sweep |
|---|---|---|---|---|
| 5.3.1 | `prayer` | Gold (212,175,55) | 0.55 | Yes |
| 5.3.2 | `morning` | Yellow (255,210,90) | 0.50 | Yes |
| 5.3.3 | `evening` | Blue (150,170,255) | 0.45 | No |
| 5.3.4 | `general` | Gold (212,175,55) | 0.70 | Yes |
| 5.3.5 | `sleep` | Blue (140,165,255) | 0.35 | No |
| 5.3.6 | `bathroom` | Cyan (150,200,230) | 0.35 | No |
| 5.3.7 | `food` | Orange (235,190,120) | 0.40 | Yes |
| 5.3.8 | `travel` | Green (120,200,170) | 0.45 | Yes |

### 5.4 Fonts
| # | Font | File | Usage |
|---|---|---|---|
| 5.4.1 | NotoNaskhArabic Regular | `assets/fonts/NotoNaskhArabic-Regular.ttf` | Arabic + Urdu text |
| 5.4.2 | Amiri Bold | `assets/fonts/Amiri-Bold.ttf` | Bold Arabic text |

### 5.5 Text Sizes
| Element | Size |
|---|---|
| Title | 36px |
| Arabic | 48px |
| Urdu | 42px |
| Label | 32px |
| Info | 28px |
| Watermark | 20px |
| Emoji | 50px |

---

## 6. TOOLS — Utility Scripts

| # | Tool | File | Purpose |
|---|---|---|---|
| 6.1 | Bulk Build | `scripts/bulk_build.py` | Batch TTS + manifest factory |
| 6.2 | Cleanup | `scripts/cleanup_temp.py` | Temp artifact cleanup |
| 6.3 | Import Loader | `scripts/import_pack_loader.py` | Import pack validation |
| 6.4 | Service Setup | `scripts/service/setup.bat` | NSSM service install |
| 6.5 | Service Manager | `scripts/service/service_manager.ps1` | Windows service manager |
| 6.6 | Manifest Regen | `regen_manifests.py` | Regenerate Remotion manifests |
| 6.7 | Test Runner | `run_tests.py` | pytest subprocess runner |
| 6.8 | E2E Test | `test_60fps_render.py` | Quick render test |

---

## 7. SYSTEM POLICIES

### 7.1 Quality Gates
| # | Policy | Value | Location |
|---|---|---|---|
| 7.1.1 | VIDEO-002 Duration | 15-50 seconds | `config.py`, `audio_mixer.py` |
| 7.1.2 | Exact FPS | 45 FPS | `config.py`, `quality_checker.py` |
| 7.1.3 | Exact Resolution | 1080x1920 | `config.py`, `quality_checker.py` |
| 7.1.4 | Max File Size | 100MB | `config.py`, `quality_checker.py` |
| 7.1.5 | Min Disk Space | 500MB | `config.py`, `main.py` |

### 7.2 Audio Standards
| # | Policy | Value | Location |
|---|---|---|---|
| 7.2.1 | Sample Rate | 48kHz | `audio_mixer.py` |
| 7.2.2 | Loudness Target | -14 LUFS | `audio_mixer.py` |
| 7.2.3 | True Peak | -1.0 dBTP | `audio_mixer.py` |
| 7.2.4 | Intermediate | PCM/WAV lossless | `audio_mixer.py` |
| 7.2.5 | Final Audio | AAC 192k | `video_builder.py` |

### 7.3 Video Standards
| # | Policy | Value | Location |
|---|---|---|---|
| 7.3.1 | Codec | libx264 | `config.py` |
| 7.3.2 | Profile | High | `config.py` |
| 7.3.3 | Level | 4.1 | `config.py` |
| 7.3.4 | CRF | 15 | `config.py` |
| 7.3.5 | GOP | 30 frames | `config.py` |
| 7.3.6 | Pixel Format | yuv420p | `config.py` |
| 7.3.7 | Mux Flags | +faststart | `config.py` |

### 7.4 Safety Policies
| # | Policy | Description | Location |
|---|---|---|---|
| 7.4.1 | SAFE_RECT | Text never enters decorative zones | `scene_engine.py` |
| 7.4.2 | Atomic Writes | Temp + fsync + os.replace | `security.py`, `self_trainer.py` |
| 7.4.3 | Vault Protection | Refuses overwrite without auth | `security.py` |
| 7.4.4 | Signal Cleanup | SIGINT/SIGTERM handlers | `main.py` |
| 7.4.5 | Crash Cleanup | atexit temp file removal | `main.py` |
| 7.4.6 | License Check | Only CC0/CC-BY/CC-BY-SA assets | `asset_registry.py` |
| 7.4.7 | Word Highlight Safety | Missing events disable, never block | `word_highlight.py` |

---

## 8. COMPONENTS — Reusable Modules

| # | Component | Type | Key Methods |
|---|---|---|---|
| 8.1 | `DuaVideoPipeline` | Orchestrator | `generate_video()`, `interactive_menu()` |
| 8.2 | `TTSEngine` | Static | `generate_audio()`, `parse_word_boundaries()` |
| 8.3 | `AudioMixer` | Static | `merge_audio_sequential()`, `normalize_loudness()` |
| 8.4 | `VideoBuilder` | Instance | `build_video()`, `_mux_direct()` |
| 8.5 | `SceneRenderer` | Instance | `render()`, `compute_layout()` |
| 8.6 | `TimelineBuilder` | Instance | `build()` |
| 8.7 | `EffectsEngine` | Instance | `apply_effect()`, `apply_plan()` |
| 8.8 | `EffectDirector` | Instance | `plan()` |
| 8.9 | `ArabicRenderer` | Instance | `render_line()`, `measure_width()` |
| 8.10 | `QualityChecker` | Instance | `check_video()` |
| 8.11 | `MetadataGenerator` | Instance | `generate()` |
| 8.12 | `SelfTrainer` | Instance | `save_feedback()`, `get_recommendation()` |
| 8.13 | `VideoAnalyzer` | Instance | `scan_all_samples()` |
| 8.14 | `SecurityManager` | Instance | `encrypt()`, `decrypt()`, `load_vault()` |
| 8.15 | `AssetRegistry` | Instance | `select_background()` |
| 8.16 | `DuaDatabase` | Singleton | `get_all_duas()`, `get_dua_by_id()` |
| 8.17 | `ProjectInfo` | Singleton | `PROJECT` |
| 8.18 | Easing | Module | `apply(name, p)` |
| 8.19 | Hardware | Module | `detect_gpu()`, `gaussian_blur()` |

---

## 9. DATA — Files & Configs

### 9.1 Core Data
| # | File | Purpose |
|---|---|---|
| 9.1.1 | `config.py` | Master configuration |
| 9.1.2 | `data/duas.json` | Dua database |
| 9.1.3 | `data/categories.json` | Category taxonomy |
| 9.1.4 | `data/learned_styles/` | AI learning data |

### 9.2 Remotion Data
| # | File | Purpose |
|---|---|---|
| 9.2.1 | `data/master-schema.json` | Manifest schema |
| 9.2.2 | `data/vfx-schema.json` | VFX schema |
| 9.2.3 | `data/custom_vfx.json` | Custom VFX definitions |
| 9.2.4 | `remotion/src/data/` | Per-dua manifests |

### 9.3 Assets
| # | File | Purpose |
|---|---|---|
| 9.3.1 | `assets/fonts/` | Arabic/Urdu fonts |
| 9.3.2 | `assets/backgrounds/` | 300+ Pexels images |
| 9.3.3 | `remotion/public/` | ~50 MP4s, ~50 MP3s, 3 fonts, 3 SFX |

---

## 10. TESTING

| # | Test File | Coverage |
|---|---|---|
| 10.1 | `test_arabic_renderer.py` | Arabic text shaping |
| 10.2 | `test_asset_registry.py` | Background assets |
| 10.3 | `test_audio_001.py` | Audio processing |
| 10.4 | `test_e2e_render.py` | Full pipeline |
| 10.5 | `test_effect_director.py` | Effect planning |
| 10.6 | `test_hardware.py` | CPU/GPU detection |
| 10.7 | `test_metadata_generator.py` | YouTube metadata |
| 10.8 | `test_scene_engine.py` | Scene rendering |
| 10.9 | `test_security.py` | Encryption |
| 10.10 | `test_timeline_builder.py` | Timeline |
| 10.11 | `test_video_002.py` | Duration policy |
| 10.12 | `test_video_builder.py` | Video assembly |
| 10.13 | `test_word_highlight.py` | Word highlighting |

---

## 11. AUDIO — Full Stack

| # | Component | Details |
|---|---|---|
| 11.1 | TTS Provider | edge-tts (Microsoft) |
| 11.2 | Arabic Voices | HamedNeural, HamdanNeural, LaithNeural, SalehNeural, ZariyahNeural |
| 11.3 | Urdu Voices | AsadNeural, SalmanNeural, UzmaNeural |
| 11.4 | Voice Selection | Deterministic gender rotation via dua_id hash |
| 11.5 | Word Boundary | JSONL sidecar, 100ns precision |
| 11.6 | Audio Format | 48kHz PCM/WAV intermediate |
| 11.7 | Final Format | AAC 192k |
| 11.8 | Loudness | Two-pass LINEAR loudnorm -14 LUFS |
| 11.9 | Duration Policy | 15-50s, speech never cut |

---

## 12. VIDEO — Full Stack

| # | Component | Details |
|---|---|---|
| 12.1 | Resolution | 1080x1920 (9:16) |
| 12.2 | FPS | 45 |
| 12.3 | Codec | libx264 High Profile |
| 12.4 | CRF | 15 |
| 12.5 | Post-Processing | Sharpen + color grade |
| 12.6 | Mux Flags | +faststart |
| 12.7 | Intermediate | CRF 10 ultrafast |
| 12.8 | Final Mux | Re-encode with full quality |

---

## 13. AI/ML

| # | Component | Details |
|---|---|---|
| 13.1 | EffectDirector | Content-aware effect scoring (deterministic) |
| 13.2 | SelfTrainer | Feedback → preference tracking → recommendations |
| 13.3 | VideoAnalyzer | KMeans color extraction, text detection |
| 13.4 | Master Patterns | Aggregated style patterns from samples |
| 13.5 | Gemini API | Optional AI features (quota-dependent) |

---

## 14. INTEGRATIONS

| # | Integration | Details |
|---|---|---|
| 14.1 | edge-tts | Microsoft Edge TTS (online) |
| 14.2 | Gemini TTS | Optional alternative TTS |
| 14.3 | YouTube OAuth2 | Google API for uploads |
| 14.4 | YouTube Data API | Upload + stats |
| 14.5 | Pexels API | Stock backgrounds |
| 14.6 | FFmpeg | Bundled via imageio-ffmpeg |

---

## 15. PIPELINE — Workflow

### 15.1 Main Pipeline (5 Steps)
```
Step 1: TTS Generation (Arabic + Urdu + word-boundary timing)
Step 2: Audio Merge (sequential + gap + loudness + duration padding)
Step 3: Frame Generation (TimelineBuilder → SceneRenderer → Effects)
Step 4: Video Assembly (imageio → FFmpeg mux with post-processing)
Step 5: Quality Check + Metadata Generation
```

### 15.2 Remotion Pipeline
| # | Script | Purpose |
|---|---|---|
| 15.2.1 | `prepare_dua.py` | TTS + audio merge |
| 15.2.2 | `make_manifest.py` | Manifest generation |
| 15.2.3 | `batch_render.py` | Batch rendering |
| 15.2.4 | `qc.py` | Quality control |
| 15.2.5 | `upload.py` | YouTube upload |
| 15.2.6 | `download_backgrounds.py` | Pexels download |
| 15.2.7 | `metadata.py` | Metadata generation |
| 15.2.8 | `ai_import.py` | AI-powered import |

### 15.3 Dashboard
| # | Component | Details |
|---|---|---|
| 15.3.1 | Server | Express.js, port 7860 |
| 15.3.2 | Auth | Bearer token |
| 15.3.3 | Routes | duas, render, upload, stats |
| 15.3.4 | Process | PM2 managed |

---

## 16. REMOTION — React/TypeScript

### 16.1 Components
| # | File | Purpose |
|---|---|---|
| 16.1.1 | `DuaVideo.tsx` | Main video component |
| 16.1.2 | `Background.tsx` | Background rendering |
| 16.1.3 | `KaraokeText.tsx` | Karaoke text overlay |
| 16.1.4 | `ArtFx.tsx` | Artistic effects |
| 16.1.5 | `BorderFx.tsx` | Border decorations |
| 16.1.6 | `SkyFx.tsx` | Sky/atmosphere effects |
| 16.1.7 | `GradeLayer.tsx` | Color grading |
| 16.1.8 | `FrameStyles.tsx` | Frame styling |
| 16.1.9 | `LookVariants.tsx` | Look variants |
| 16.1.10 | `StylePreview.tsx` | Style preview |
| 16.1.11 | `ThumbCard.tsx` | Thumbnail card |

### 16.2 Config
| # | File | Purpose |
|---|---|---|
| 16.2.1 | `themes.ts` | Theme definitions |
| 16.2.2 | `stylePresets.ts` | Style presets |
| 16.2.3 | `easing.ts` | Easing functions |
| 16.2.4 | `fonts.ts` | Font loading |
| 16.2.5 | `types.ts` | TypeScript types |

---

## CRITICAL ISSUES

| # | Severity | Issue |
|---|---|---|
| C1 | CRITICAL | `client_secret.json` in repo — OAuth credentials exposed |
| C2 | HIGH | No `.env` pattern — secrets scattered |
| C3 | HIGH | `samples/` empty — VideoAnalyzer can't learn |
| C4 | LOW | `templates/` directory missing (referenced in config) |

---

*End of Master List — 16 categories, 100+ components*
