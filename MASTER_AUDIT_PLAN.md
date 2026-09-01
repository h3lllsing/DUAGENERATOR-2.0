# MASTER AUDIT PLAN — DuaVideoGenerator
**Generated:** September 1, 2026
**Status:** Ready for Execution

---

## PHASE 1: CRITICAL FIXES (Week 1)
**Impact: Critical | Effort: Low-Medium**

| # | Fix | File | Lines | Effort |
|---|-----|------|-------|--------|
| 1.1 | Replace `eval()` with `json.loads()` | `tests/test_security.py` | 167 | 5 min |
| 1.2 | Add visibility API — pause polling when tab hidden | `remotion/dashboard/public/app.js` | 1467 | 15 min |
| 1.3 | Add `URL.revokeObjectURL()` cleanup | `remotion/dashboard/public/app.js` | 666-712 | 10 min |
| 1.4 | Add `timeout-minutes: 25` to all CI jobs | `.github/workflows/ci.yml` | 10,51,87 | 5 min |
| 1.5 | Add confirmation prompt before restore | `scripts/restore.py` | 45-51 | 15 min |
| 1.6 | Add pre-restore auto-backup | `scripts/restore.py` | 45-51 | 15 min |
| 1.7 | Fix security_audit.py absolute paths + exit codes | `scripts/security_audit.py` | 10, all | 20 min |
| 1.8 | Fix security_audit.py path traversal check | `scripts/security_audit.py` | 11-20 | 10 min |
| 1.9 | Fix test_video_002.py documentation mismatch | `tests/test_video_002.py` | 2 | 5 min |

---

## PHASE 2: HIGH-PRIORITY FIXES (Week 2)
**Impact: High | Effort: Medium**

### 2A: Backend (Days 1-3)

| # | Fix | File | Effort |
|---|-----|------|--------|
| 2.1 | Extract shared `utils.js` (readBody, routeCatch, parseJson, exists, err) | New: `routes/utils.js` | 2 hrs |
| 2.2 | Update all routes to use shared utils | `render.js`, `youtube.js`, `vfx.js`, `config.js`, `duas.js` | 2 hrs |
| 2.3 | Cache config reads — read once per request | `routes/render.js:153-177` | 1 hr |
| 2.4 | Convert `duaStatus()` to async I/O | `routes/render.js:406-435` | 1 hr |
| 2.5 | Sanitize YouTube log output — mask sensitive fields | `routes/youtube.js:489` | 30 min |
| 2.6 | Cache YouTube auth status (30s TTL) | `routes/youtube.js:336` | 1 hr |
| 2.7 | Add backup integrity checksums (SHA-256) | `scripts/backup.py` | 1 hr |
| 2.8 | Add backup rotation (`--max-backups`) | `scripts/backup.py` | 1 hr |

### 2B: Frontend (Days 4-5)

| # | Fix | File | Effort |
|---|-----|------|--------|
| 2.9 | Add ARIA roles + aria-label to all buttons/modals | `remotion/dashboard/public/index.html` | 2 hrs |
| 2.10 | Add focus trapping for modal dialogs | `remotion/dashboard/public/app.js` | 1 hr |
| 2.11 | Add `@media (prefers-reduced-motion: reduce)` | `remotion/dashboard/public/style.css` | 30 min |
| 2.12 | Add `:focus-visible` outlines on interactive elements | `remotion/dashboard/public/style.css` | 30 min |
| 2.13 | Touch-friendly tap-to-reveal for mobile cards | `remotion/dashboard/public/style.css` | 1 hr |
| 2.14 | Remove dead CSS classes | `remotion/dashboard/public/style.css` | 15 min |
| 2.15 | Add `<noscript>` fallback | `remotion/dashboard/public/index.html` | 5 min |

### 2C: CI/CD (Day 5)

| # | Fix | File | Effort |
|---|-----|------|--------|
| 2.16 | Enable pytest-cov in CI | `.github/workflows/ci.yml` | 15 min |
| 2.17 | Add concurrency group to CI | `.github/workflows/ci.yml` | 5 min |
| 2.18 | Add upper version bounds to requirements.txt | `requirements.txt` | 30 min |
| 2.19 | Generate requirements-lock.txt | New: `requirements-lock.txt` | 30 min |
| 2.20 | Switch to opencv-python-headless | `requirements.txt` | 5 min |
| 2.21 | Add bandit + pytest-timeout to requirements | `requirements.txt` | 10 min |

---

## PHASE 3: ARCHITECTURE IMPROVEMENTS (Week 3-4)
**Impact: High | Effort: Medium-High**

### 3A: Testing Infrastructure (Days 1-3)

| # | Task | Effort |
|---|------|--------|
| 3.1 | Create `conftest.py` with shared fixtures | 1 hr |
| 3.2 | Create `pyproject.toml` (pytest, ruff, mypy config) | 30 min |
| 3.3 | Add `ruff` lint + format check to CI | 1 hr |
| 3.4 | Add `mypy` strict mode to CI | 1 hr |
| 3.5 | Add `pytest.mark.slow` to E2E tests | 15 min |
| 3.6 | Add tests for `effects_engine.py` | 2 hrs |
| 3.7 | Add tests for `revamp_engine.py` | 1 hr |
| 3.8 | Add tests for `video_analyzer.py` | 1 hr |
| 3.9 | Add tests for `project_info.py` | 30 min |
| 3.10 | Add tests for `easing.py` | 30 min |
| 3.11 | Add tests for `backup.py` | 1 hr |
| 3.12 | Add tests for `restore.py` | 1 hr |

### 3B: Python Core (Days 4-7)

| # | Task | File | Effort |
|---|------|------|--------|
| 3.13 | Refactor duplicate pipeline logic (DRY) | `main.py` | 3 hrs |
| 3.14 | Add CLI argparse for headless runs | `main.py` | 2 hrs |
| 3.15 | Streaming/chunked frame writer (fix 13.5GB RAM) | `core/video_builder.py` | 3 hrs |
| 3.16 | Vectorize wave effect (eliminate per-row loop) | `core/effects_engine.py:240` | 1 hr |
| 3.17 | Sync `revamp_engine.py` with actual `_FX` effects | `core/revamp_engine.py` | 1 hr |
| 3.18 | Add asyncio event-loop safety in TTS | `core/tts_engine.py` | 1 hr |
| 3.19 | Atomic write for `save_key` | `core/security.py` | 30 min |
| 3.20 | Update stale "100,000 iterations" comment | `main.py:879` | 5 min |

---

## PHASE 4: NEW CAPABILITIES (Month 2)
**Impact: Medium-High | Effort: High**

### 4A: Real-Time Progress

| # | Task | Effort |
|---|------|--------|
| 4.1 | Add SSE endpoint for render progress | 3 hrs |
| 4.2 | Replace polling with EventSource in frontend | 2 hrs |
| 4.3 | Add render job persistence (survive restart) | 3 hrs |

### 4B: Enhanced VFX

| # | Task | Effort |
|---|------|--------|
| 4.4 | Cache VFX pack in memory (mtime-based invalidation) | 1 hr |
| 4.5 | Preview caching (fingerprint-based) | 1 hr |
| 4.6 | Concurrency limit for VFX preview renders | 1 hr |
| 4.7 | Configurable effect weights/scoring | 2 hrs |

### 4C: Security Enhancements

| # | Task | Effort |
|---|------|--------|
| 4.8 | Store API keys in encrypted file or OS keychain | 2 hrs |
| 4.9 | Add JSON/SARIF output to security audit | 2 hrs |
| 4.10 | Add `pip-audit` to CI pipeline | 1 hr |
| 4.11 | Add encrypted backup for secrets | 2 hrs |

### 4D: User Experience

| # | Task | Effort |
|---|------|--------|
| 4.12 | Add dry-run mode for video generation | 2 hrs |
| 4.13 | Add voice preview (3s sample) | 2 hrs |
| 4.14 | Add soft-delete with undo | 2 hrs |
| 4.15 | Add configurable prosody (rate/pitch) per voice | 1 hr |
| 4.16 | Add cross-fade between audio clips | 2 hrs |

---

## PHASE 5: POLISH & DEPLOYMENT (Month 3)
**Impact: Medium | Effort: Medium**

### 5A: CI/CD Maturity

| # | Task | Effort |
|---|------|--------|
| 5.1 | Add Dependabot config | 30 min |
| 5.2 | Add pre-commit hooks (`.pre-commit-config.yaml`) | 1 hr |
| 5.3 | Add Windows/macOS to CI matrix | 1 hr |
| 5.4 | Mock TTS for offline testing | 2 hrs |
| 5.5 | Upload E2E artifacts on failure | 30 min |
| 5.6 | Add notification step (Slack/email) on failure | 1 hr |

### 5B: Code Quality

| # | Task | Effort |
|---|------|--------|
| 5.7 | Wrap app.js in IIFE (avoid globals) | 2 hrs |
| 5.8 | Consolidate escHtml/ytEsc/vfxEsc into one utility | 30 min |
| 5.9 | Remove dead code (revamp_engine if unused) | 1 hr |
| 5.10 | Add `__all__` to Python modules | 30 min |
| 5.11 | Add config schema versioning | 1 hr |

### 5C: Documentation

| # | Task | Effort |
|---|------|--------|
| 5.12 | Update CHANGELOG.md with all changes | 1 hr |
| 5.13 | Update API docs (docs/API.md) | 1 hr |
| 5.14 | Add README.md for dashboard | 1 hr |
| 5.15 | Add inline JSDoc/docstrings for public APIs | 2 hrs |

---

## EXECUTION ORDER SUMMARY

```
Week 1:  Phase 1 (Critical Fixes)              — 9 items, ~2 hrs
Week 2:  Phase 2 (High-Priority Fixes)         — 21 items, ~14 hrs
Week 3:  Phase 3A (Testing Infrastructure)     — 12 items, ~8 hrs
Week 4:  Phase 3B (Python Core)                — 8 items, ~12 hrs
Month 2: Phase 4 (New Capabilities)            — 16 items, ~25 hrs
Month 3: Phase 5 (Polish & Deployment)         — 15 items, ~10 hrs
```

**Total Estimated Effort:** ~71 hours

---

## COMMANDS TO RUN AFTER EACH PHASE

```powershell
# After Phase 1
cd H:\DuaVideoGenerator
python -m pytest tests/ -x -v

# After Phase 2
cd H:\DuaVideoGenerator\remotion\dashboard
node --check server.js
node --check routes/*.js
node --check custom-vfx.js

# After Phase 3
cd H:\DuaVideoGenerator
python -m pytest tests/ -v --cov=core --cov-report=term-missing
ruff check .
mypy core/ --ignore-missing-imports

# After Phase 4
cd H:\DuaVideoGenerator\remotion
npm run build

# Full validation
cd H:\DuaVideoGenerator
python -m pytest tests/ -v --cov=core
cd remotion && npm run build && npm test
```

---

*Plan generated by opencode audit system*
