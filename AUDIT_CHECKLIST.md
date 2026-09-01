# AUDIT CHECKLIST — Quick Reference
**Updated:** September 1, 2026

---

## PHASE 1: CRITICAL (Week 1)
- [ ] 1.1 Replace `eval()` → `json.loads()` (test_security.py:167)
- [ ] 1.2 Add visibility API pause polling (app.js:1467)
- [ ] 1.3 Add blob URL cleanup (app.js:666-712)
- [ ] 1.4 Add `timeout-minutes: 25` CI jobs (ci.yml)
- [ ] 1.5 Add restore confirmation prompt (restore.py)
- [ ] 1.6 Add pre-restore auto-backup (restore.py)
- [ ] 1.7 Fix security_audit.py paths + exit codes
- [ ] 1.8 Fix security_audit.py path traversal
- [ ] 1.9 Fix test_video_002.py docs mismatch

## PHASE 2: HIGH-PRIORITY (Week 2)
### Backend
- [ ] 2.1 Extract shared utils.js
- [ ] 2.2 Update all routes to use utils
- [ ] 2.3 Cache config reads
- [ ] 2.4 Convert duaStatus() to async
- [ ] 2.5 Sanitize YouTube logs
- [ ] 2.6 Cache YouTube auth status
- [ ] 2.7 Add backup checksums
- [ ] 2.8 Add backup rotation

### Frontend
- [ ] 2.9 Add ARIA roles + labels
- [ ] 2.10 Add focus trapping modals
- [ ] 2.11 Add prefers-reduced-motion
- [ ] 2.12 Add :focus-visible outlines
- [ ] 2.13 Touch-friendly cards
- [ ] 2.14 Remove dead CSS
- [ ] 2.15 Add noscript fallback

### CI/CD
- [ ] 2.16 Enable pytest-cov
- [ ] 2.17 Add concurrency group
- [ ] 2.18 Add upper version bounds
- [ ] 2.19 Generate requirements-lock.txt
- [ ] 2.20 Switch opencv-python-headless
- [ ] 2.21 Add bandit + pytest-timeout

## PHASE 3: ARCHITECTURE (Week 3-4)
### Testing
- [ ] 3.1 Create conftest.py
- [ ] 3.2 Create pyproject.toml
- [ ] 3.3 Add ruff lint CI
- [ ] 3.4 Add mypy strict CI
- [ ] 3.5 Add pytest.mark.slow
- [ ] 3.6 Tests: effects_engine
- [ ] 3.7 Tests: revamp_engine
- [ ] 3.8 Tests: video_analyzer
- [ ] 3.9 Tests: project_info
- [ ] 3.10 Tests: easing
- [ ] 3.11 Tests: backup.py
- [ ] 3.12 Tests: restore.py

### Python Core
- [ ] 3.13 Refactor duplicate pipeline (DRY)
- [ ] 3.14 Add CLI argparse
- [ ] 3.15 Streaming frame writer (fix RAM)
- [ ] 3.16 Vectorize wave effect
- [ ] 3.17 Sync revamp_engine with _FX
- [ ] 3.18 Add asyncio event-loop safety
- [ ] 3.19 Atomic write for save_key
- [ ] 3.20 Update stale comment

## PHASE 4: NEW CAPABILITIES (Month 2)
- [ ] 4.1 SSE endpoint for progress
- [ ] 4.2 Replace polling with EventSource
- [ ] 4.3 Render job persistence
- [ ] 4.4 Cache VFX pack (mtime)
- [ ] 4.5 Preview caching
- [ ] 4.6 VFX concurrency limit
- [ ] 4.7 Configurable effect weights
- [ ] 4.8 Encrypted API key storage
- [ ] 4.9 JSON/SARIF audit output
- [ ] 4.10 Add pip-audit CI
- [ ] 4.11 Encrypted backup secrets
- [ ] 4.12 Dry-run video generation
- [ ] 4.13 Voice preview (3s)
- [ ] 4.14 Soft-delete with undo
- [ ] 4.15 Configurable prosody
- [ ] 4.16 Cross-fade audio clips

## PHASE 5: POLISH (Month 3)
- [ ] 5.1 Dependabot config
- [ ] 5.2 Pre-commit hooks
- [ ] 5.3 Windows/macOS CI matrix
- [ ] 5.4 Mock TTS offline testing
- [ ] 5.5 Upload E2E artifacts
- [ ] 5.6 Notification on failure
- [ ] 5.7 Wrap app.js in IIFE
- [ ] 5.8 Consolidate escHtml utilities
- [ ] 5.9 Remove dead code
- [ ] 5.10 Add __all__ to Python modules
- [ ] 5.11 Config schema versioning
- [ ] 5.12 Update CHANGELOG.md
- [ ] 5.13 Update API docs
- [ ] 5.14 Add dashboard README
- [ ] 5.15 Add JSDoc/docstrings

---

**Progress: 0/69 items completed**
