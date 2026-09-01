# Changelog

All notable changes to Dua Video Generator.

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
