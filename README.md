# Dua Video Generator — V2.0 Workspace

> **V2 development copy.** Production portal runs at `H:\DuaVideoGenerator` (port 7860, pm2 `dua-studio`). This folder is the clean rebuild workspace (port 7870). See `AGENTS.md`, `V2_AUDIT_AND_PLAN.md`, `docs/V2_ARCHITECTURE.md`, `docs/V2_ONBOARDING.md`.
>
> **NOTE** — everything below this line describes the CURRENT PRODUCTION product (read-only, for understanding). The V2 rebuild target layout/stack is in `docs/V2_ARCHITECTURE.md`; full prod internals in `docs/PORTAL_REFERENCE.md`. V2 docs win if they conflict.

---

Automatic Islamic **Dua video generator** for YouTube Shorts. Arabic + Urdu dua with professional visuals, TTS voiceover, background media, and a full web dashboard for rendering, uploading to YouTube, and tracking channel analytics.

> Arabic duas from authentic Sunni sources (Bukhari, Muslim, Tirmidhi, Abu Dawud, etc.) with Urdu translations.

---

## What It Does

This project turns a dua text into a complete, monetization-focused YouTube Short:

```
Dua text (Arabic+Urdu)  →  TTS voiceover (Arabic + Urdu)  →  1080x1920 portrait
video with animated karaoke-style word highlighting →  designer backgrounds
→  master audio (loudness-normalized) →  YouTube upload + analytics
```

Key capabilities:

- **Automated video generation** — Arabic karaoke, phase-change clock-wipe reveal, corner/cinematic FX, particle atmosphere, intro + end card with CTA.
- **Premium TTS** — edge-tts neural voices (Arabic `ar-*` + Urdu `ur-*`), word-timing sidecars for frame-accurate on-screen highlighting, studio mastering (noise floor, warmth, compressors, loudnorm to -14 LUFS).
- **Background media** — procedural cinematic grade plus optional **Pexels-generated photo backgrounds** (`remotion/scripts/download_backgrounds.py`) with per-category matching (mosque, nature, food, travel, etc.). Supports static, Ken Burns zoom, and video-background modes.
- **Additive render queue** — select multiple dua cards, click "Render Selected", add more later — queue appends and keeps running server-side even if browser is closed.
- **YouTube integration** — full OAuth flow, **Live vs Dry-Run mode**, upload, auto MP4 cleanup after success, per-video stats (views/likes/comments) + channel stats (subscribers/views), quota tracking, per-channel duplicate prevention.
- **Web dashboard** — browser portal (port 7860) to pick a dua, render, preview, and upload. YouTube stats table, channel management, re-upload queue. Card selection UI with checkboxes on Not Started cards.
- **AI dua import** — OpenAI-compatible endpoint (e.g. aihubmix) to auto-generate new authentic Sunni duas with **duplicate prevention** on ID / Arabic / Urdu (fuzzy 90%). Custom API base URL + keys + models configurable from the dashboard.
- **Security** — dashboard bearer-token auth, YouTube OAuth tokens excluded from the repo, background media excluded from the repo.

---

## Project Structure

```
DuaVideoGenerator/
  main.py                   - Python pipeline orchestrator (entry point)
  config.py                 - Settings (FPS, voices, durations, themes, backgrounds)
  regen_manifests.py        - Rebuild all Remotion manifests at current FPS
  core/                     - Python engine
    asset_registry.py       - Approved background manifest + category selector
    tts_engine.py           - TTS (edge-tts) with retries + routing
    audio_mixer.py          - Audio merge + loudnorm mastering (async FFmpeg)
    effect_director.py      - Deterministic palette/effect selection
    effects_engine.py       - Visual effects with buffer reuse
    scene_engine.py         - Procedural scene/palette/motion builder + aurora gradient
    timeline_builder.py     - Scene timeline assembly + highlight/gradient params
    revamp_engine.py        - Visual revamp layout builder
    dua_database.py         - Dua data access layer
    word_highlight.py       - Word highlight box styles (classic, glow, pulse, box)
    master_config.py        - Single source of truth for all config (Ultra Pack)
    security.py             - Auth / token handling
    logging_config.py       - Centralized logging setup
    ...more helpers
  data/duas.json            - Dua database (100+ entries)
  assets/backgrounds/       - Background manifest (media downloaded separately)
  remotion/                 - Video composition (React / Remotion)
    src/                    - TSX components (Background, DuaVideo, themes, FX)
    scripts/                - Python helpers (render, upload, TTS, stats, ai_import, youtube_sync)
    dashboard/              - Web portal (Node server.js + public/)
      routes/
        render.js           - Render + additive queue system
        status_store.js     - Per-channel upload tracking + sync
        batch.js            - Python pipeline batch integration
        youtube.js          - YouTube upload + per-channel duplicate prevention
        vfx.js              - VFX management
        utils.js            - Shared helpers
  scripts/                  - Utility scripts (cleanup_temp, etc.)
  tests/                    - Test suite (audio, render, video, security)
```

---

## Quick Start

### 1. Install dependencies
```bash
pip install -r requirements.txt          # Python 3.12
cd remotion && npm install               # Node + Remotion
```

### 2. Start the dashboard
```bash
cd remotion && node dashboard/server.js
```
Open **http://127.0.0.1:7860** in your browser.

### 3. Render / upload
- Pick a dua from the list → **Render**.
- YouTube → **Auth** (OAuth) → choose **Dry-Run** or **Live** mode → **Upload**.
- **Uploaded** tab shows live stats (subscribers, views, likes, comments).

### Command line
```bash
python main.py        # interactive menu
python regen_manifests.py   # rebuild all Remotion manifests at current FPS
```

---

## Background Media (Free / Monetization-Safe)

Photo + video backgrounds are fetched from **Pexels** (free license, safe for monetization) and are **not committed** to the repo to keep it small. Regenerate them at any time:

```bash
python remotion/scripts/download_backgrounds.py --key YOUR_PEXELS_KEY          # images
python remotion/scripts/download_backgrounds.py --key YOUR_PEXELS_KEY --videos # + videos
python remotion/scripts/download_backgrounds.py --key KEY --category prayer
```

This writes approved assets into `assets/backgrounds/` and registers them (with SHA-256 checksums) in `manifest.json`. Selection is deterministic per dua via its category.

---

## YouTube Setup

1. Create OAuth 2.0 credentials (Desktop app) at https://console.cloud.google.com
2. Download `client_secret.json` to the project root.
3. Dashboard → YouTube → Auth → paste credentials → authorize in the browser.
4. Paste the generated token (it lives in `data/yt_token_*.json`, git-ignored).

Scopes used: `youtube.upload` + `youtube.readonly` (for stats).

---

## Configuration Highlights (`config.py`)

| Setting | Default | What it does |
|---------|---------|--------------|
| `VIDEO_FPS` | 80 | Frames per second for render |
| `VIDEO_MAX_DURATION` | 50 | Max video length (s) |
| `TTS_ONLINE` | True | Use edge-tts (needs internet) |
| `BACKGROUNDS_DIR` | assets/backgrounds | Where background manifest + media live |
| `LOG_LEVEL` | INFO | Logging verbosity |

Background theme selection is category-driven with deterministic rotation per dua id (see `remotion/scripts/make_manifest.py` → `resolve_theme`).

---

## Testing

```bash
python -m pytest tests/ -v
```
Covers audio mixing, Arabic rendering, effects, video builder, E2E render, security, and more.

---

## MCP Servers (AI Integration)

This project is configured with MCP (Model Context Protocol) servers for enhanced AI-assisted development.

### Installed MCP Servers

| Server | Type | Purpose |
|--------|------|---------|
| **Filesystem** | Local | File read/write access |
| **GitHub** | Remote | GitHub API - repos, PRs, issues |

### Config Files

| File | Location |
|------|----------|
| Global Config | `~/.config/opencode/opencode.json` |
| Project Config | `./opencode.json` |

### Usage

```
"main.py padho" → Filesystem MCP se file padhega
"Mere repos list karo" → GitHub MCP se repos dikhayega
"Naya PR banao" → GitHub MCP se PR banayega
```

---

## Notes

- **Secrets** (`dashboard/auth.json`, `data/ai_api_config.json`, YouTube OAuth tokens) and **downloaded background media** are git-ignored — never commit them.
- Uploads run in **Live** mode only when explicitly chosen; a confirmation dialog guards accidental publishing.
- Rendered MP4 files are removed from disk after a successful YouTube upload to save space.
