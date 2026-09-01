# Changelog

All notable changes to DuaVideoGenerator will be documented in this file.

Format based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

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
