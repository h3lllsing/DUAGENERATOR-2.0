# Changelog

All notable changes to Dua Video Generator.

## [0.11.0] - 2026-09-01

### Fixed
- eval() replaced with json.dumps() in test_security.py
- setInterval never cleared on visibility change (duplicate polling)
- Duplicate import sys in restore.py
- readBody reverted to local (send dependency)
- _pollTimers declaration order fixed
- duaStatus reverted to sync (async was too slow)

### Added
- SSE endpoint GET /api/status/stream for real-time progress
- EventSource frontend (instant updates vs 3s polling)
- Shared routes/utils.js (err, parseJson, cleanStr, routeCatch, exists)
- Config cache with 5s TTL
- Backup checksums (SHA-256)
- Backup rotation (keep 10 max)
- ARIA roles + labels for accessibility
- Focus trapping for modals
- prefers-reduced-motion support
- :focus-visible outlines
- Touch-friendly cards (44px min)
- noscript fallback
- CLI argparse (--dua, --theme, --effect, --batch, --list, --dry-run)
- Vectorized wave effect (numpy advanced indexing)
- Revamp engine synced with actual effects
- Atomic write for save_key (os.replace)
- Soft-delete with undo (POST /api/undo-delete-dua)
- VFX pack mtime-based cache
- Dependabot config
- Pre-commit hooks
- Windows/macOS CI matrix
- E2E artifact upload on failure
- pip-audit in CI

### Changed
- All routes use shared utils (eliminated ~100 lines duplication)
- Backup script enhanced with checksums + rotation
- CI/CD: pytest-cov, pytest-timeout, concurrency group
- requirements.txt: upper version bounds, opencv-python-headless

## [0.10.0] - 2026-09-01

### Fixed
- FPS alignment to 45 across all modules
- Font path corrected to Amiri-Bold.ttf
- Event loop leak in tts_engine.py (asyncio.run)
- Gold shimmer effect vectorized with numpy
- Wave effect optimized with np.roll
- Bounce effect off-screen clipping
- Frame corruption handling in effects engine
- Path traversal guards on /video/* and /thumb/* routes
- XSS vulnerability in dashboard log rendering
- Rate limit applied to all POST /api/* endpoints
- Auth token HTML injection (JSON.stringify)
- PBKDF2 iterations increased to 600K
- Security headers (X-Content-Type-Options, X-Frame-Options, etc.)
- Singleton lazy initialization for dua_database
- Duration calculation fix in video_analyzer
- TTS text sanitization (HTML tag stripping)
- Upload log rotation at 1MB
- CI/CD: TypeScript check strict mode, Bandit security scan, npm audit

### Added
- Health check endpoint GET /api/health
- Backup/restore scripts (scripts/backup.py, scripts/restore.py)
- Documentation: CHANGELOG.md, API.md, CONTENT_POLICY.md, YOUTUBE_COMPLIANCE.md
- DISK_SPACE_MIN_MB and MAX_FILE_SIZE_MB config options
- scikit-learn dependency

### Changed
- scene_engine layout loop reduced from 40 to 15 attempts
- revamp_engine constants extracted to module level
- Quality checker uses config-driven validation
- .gitignore updated with *.log entries
