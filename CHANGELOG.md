# Changelog

All notable changes to DuaVideoGenerator will be documented in this file.

Format based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

---

## [0.13.0] - 2026-09-20

### Added
- **Thumbnail Pipeline**: `remotion/scripts/make_thumbs.py` (Remotion `still` renders, 87 thumbs in `remotion/out/thumbs/`) + `remotion/scripts/upload_thumbs.py` (YouTube `thumbnails.set`, dry-run / `--only` / state-tracked)
- **Share Kit**: `remotion/scripts/generate_share_kit.py` — WhatsApp-ready dua texts (title+ref, Arabic, Urdu, watch link, subscribe link, hashtags) → `share_kit/` (87 files + `INDEX.md`)
- **Playlist Plan**: `remotion/scripts/plan_playlists.py` — 9 thematic playlists covering all 87 videos → `data/playlist_plan_channel1.json`
- **SEO Batch**: `remotion/scripts/seo_batch.py` — bulk `videos.update` (tags + description refresh) with dry-run / `--only`
- **Shorts Captions**: `remotion/scripts/make_upload_captions.py` + `remotion/scripts/attach_captions.py` — EN `.vtt` captions per short (15/21 attached, 2 quota-blocked, 4 pending EN review)
- **Shorts Pipeline**: `remotion/scripts/make_shorts.py`, `make_srt.py`, `upload_shorts.py`, `update_metadata.py`, `verified_en.py` (21 shorts uploaded)
- **Privacy Rollout Helper**: `remotion/scripts/fix_short_privacy.py` (`--limit N` for gradual public rollout)
- **AI Import EN/UR/AR Enforcement**: `ai_import.py` + `ai_format_dua.py` prompts now require Arabic + Urdu + English (title/urdu + titleEn/english/explanation) in every dua; incomplete duas are skipped

### Fixed
- **Thumbnail Props**: Remotion `thumbnail-card` requires `data`-wrapped props — `{"data": {...}}`; unwrapped props silently used composition defaults (identical 1225 KB thumbs, hash `B5206BE1DE8804241CB86AC1F22C18B6`)

### Locked
- Portal locked on 2026-09-20 (no code changes / no new features). Pending ops (quota-gated, YouTube daily reset = midnight PT = **12:00 noon PKT**): `attach_captions.py --only sakht_musibat_mein_sabr_ki_dua,samundari_sarkash_hawaon_se_panah` → `upload_thumbs.py` (87) → `seo_batch.py` (87) → next day: playlists create/add (~4500 units).

---

## [0.12.0] - 2026-09-05

### Added
- **Additive Render Queue**: `POST /api/render-selected` — select multiple cards, append to running queue, server-side persistence survives browser close
- **Card Selection UI**: Gold checkboxes on Not Started cards only, selection toolbar with Render Selected button
- **Queue Counter**: Job bar shows remaining + done count across multiple batch additions
- **YouTube Sync**: `POST /api/youtube/sync` — backfill upload status from ledgers or YouTube API
- **Per-Channel Upload Tracking**: `status_store.js` — `uploaded_channels` map per dua, duplicate prevention per channel
- **Word Highlight Box**: `HIGHLIGHT_BOX_STYLES` (classic, glow, pulse, box) in `core/word_highlight.py`
- **Aurora Gradient**: `_build_aurora_gradient()` in `core/scene_engine.py` + `gradient_kind` param
- **Batch JS Routes**: `routes/batch.js` — Python pipeline batch integration
- **Status Store**: `routes/status_store.js` — atomic writes, ledger sync, YouTube API sync
- **YouTube Sync Script**: `remotion/scripts/youtube_sync.py` — list channel videos, match to DB
- **Cancel Cleanup**: Partial `.mp4` and `.bt709.mp4` files cleaned on cancel/fail
- **Stale Flag Reset**: Cancel endpoint resets flags when nothing running
- **Graceful Cancel**: Cancel button visible for single renders (not just batch)

### Fixed
- **Loading Bar Stuck**: Auto-hides on page load when no active job; SSE handler calls `scheduleBarHide` on completion
- **Cancel Button Visibility**: Now shown whenever `j.running` or `queue.active` (was batch-only)
- **Syntax Error**: Ternary operator in queue display — extracted to `qPrefix` variable
- **Duplicate Check**: `render-selected` skips already-queued items with reason
- **Uploaded Card Selection**: Not Started cards only — uploaded/rendered excluded from selection

### Changed
- **Audio Mixer**: Async FFmpeg with thread pool + try/finally cleanup
- **Effects Engine**: Buffer reuse for particle rendering
- **master_config.py**: Added `HIGHLIGHT_BOX_STYLES`, `BACKGROUND_GRADIENT_KINDS`
- **App Version**: `v0.13.0` (cache-bust)

---

## [0.11.0] - 2026-09-02

### Added
- **Voice Preview**: AR/UR preview buttons in voice modal (3s TTS sample)
- **Audio Cross-Fade**: Smooth overlap between clips (merge_audio_crossfade)
- **VFX Preview Cache**: Fingerprint-based caching (5min TTL, 100 max entries)
- **VFX Concurrency Limit**: Max 2 simultaneous preview renders
- **Configurable Effect Weights**: GET/POST /api/vfx/weights (0-10 scale)
- **Encrypted API Keys**: Fernet encryption for ai_api_config.json
- **Security Audit JSON/SARIF**: --format {text,json,sarif} output
- **CI Failure Notifications**: PR comment on CI failure
- **Mock TTS Fixture**: Offline testing without network
- **Job Persistence**: Queue state saved/restored across restarts
- **__all__ Exports**: All 21 core Python modules
- **Config Schema Versioning**: CONFIG_SCHEMA_VERSION = 2
- **Dashboard README**: Architecture + API docs

### Changed
- **ruff Linting**: 790 auto-fixes across codebase
- **CI Pipeline**: Added ruff + mypy to syntax-check job
- **requirements-lock.txt**: Pinned dependency versions
- **Unified escHtml**: Consolidated ytEsc/vfxEsc wrappers
- **pytest Config**: pyproject.toml with ruff, mypy, pytest settings

### Testing
- **93 new tests** across 7 modules (sprint 1-2)
- E2E tests marked with @pytest.mark.slow
- Shared fixtures in conftest.py

---

## [0.10.0] - 2026-09-01

### Added
- MCP servers integration (Filesystem + GitHub)
- Phase 3 UI/UX improvements
- Toast animations + dismiss button
- CSS improvements

### Changed
- Updated dashboard styling
- Improved video rendering pipeline

### Fixed
- CSS circular references in :root block

---

## [0.9.0] - 2026-08-23

### Added
- Phase 2 UI/UX improvements
- Dashboard cache system
- Crash log handling

### Changed
- Improved video quality settings
- Updated FFmpeg presets

---

## [0.8.0] - 2026-08-20

### Added
- Phase 1.4 features
- Toast notifications
- Dismiss button functionality

### Fixed
- Video duration calculation
- Audio sync issues

---

## [0.7.0] - 2026-08-15

### Added
- YouTube integration
- OAuth flow
- Upload functionality

### Changed
- Improved TTS engine
- Better audio mixing

---

## [0.6.0] - 2026-08-10

### Added
- Web dashboard
- Real-time rendering
- Statistics tracking

---

## [0.5.0] - 2026-08-05

### Added
- AI dua import
- Duplicate prevention
- Custom API support

---

## [0.4.0] - 2026-08-01

### Added
- Background media support
- Pexels integration
- Category-based matching

---

## [0.3.0] - 2026-07-25

### Added
- Security features
- Token handling
- Dashboard authentication

---

## [0.2.0] - 2026-07-20

### Added
- Effects engine
- Scene rendering
- Timeline builder

---

## [0.1.0] - 2026-07-15

### Added
- Initial release
- Basic TTS
- Video generation
- Arabic text rendering
