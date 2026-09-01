# DETAILED AUDIT REPORT — All Pending Items
> Generated: 2026-09-02 | 30 Items Audited

---

## SPRINT 1: Testing Foundation

### 3.2 — Create `pyproject.toml`
**Status:** ❌ PENDING | **Effort:** 30 min

**What exists:** No `pyproject.toml`, `setup.py`, or `setup.cfg`

**What to do:**
- Create `H:\DuaVideoGenerator\pyproject.toml` with:
  ```toml
  [tool.pytest.ini_options]
  testpaths = ["tests"]
  timeout = 30
  
  [tool.ruff]
  line-length = 120
  target-version = "py311"
  
  [tool.ruff.lint]
  select = ["E", "F", "W", "I"]
  
  [tool.mypy]
  python_version = "3.11"
  warn_return_any = true
  warn_unused_configs = true
  ignore_missing_imports = true
  ```

**File:** New file at project root

---

### 3.1 — Create `conftest.py` with shared fixtures
**Status:** ❌ PENDING | **Effort:** 1 hr

**What exists:** No `conftest.py`. Each test file manually does:
- `sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))`
- Manual `setup_method`/`teardown_method` with tmp dirs

**What to do:**
- Create `H:\DuaVideoGenerator\tests\conftest.py` with:
  ```python
  import sys
  import os
  import pytest
  import shutil
  
  sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
  
  from core.project_info import PROJECT
  
  @pytest.fixture
  def project():
      return PROJECT
  
  @pytest.fixture
  def tmp_dir(tmp_path):
      return tmp_path
  
  @pytest.fixture
  def sample_image():
      from PIL import Image
      return Image.new('RGB', (1080, 1920), (20, 25, 35))
  ```

**File:** New file at `tests/conftest.py`

---

### 3.5 — Add `pytest.mark.slow` to E2E tests
**Status:** ❌ PENDING | **Effort:** 15 min

**What exists:** `tests/test_e2e_render.py` exists, no slow marker

**What to do:**
- Add `@pytest.mark.slow` decorator to E2E test class/functions
- This allows running `pytest -m "not slow"` to skip E2E in fast runs

**File:** `tests/test_e2e_render.py`

---

### 3.9 — Add tests for `project_info.py`
**Status:** ❌ PENDING | **Effort:** 30 min

**What exists:** No test file for `project_info.py`

**What to do:**
- Create `H:\DuaVideoGenerator\tests\test_project_info.py` with:
  - `test_default_dimensions` — PROJECT.VIDEO_WIDTH=1080, VIDEO_HEIGHT=1920
  - `test_fps` — PROJECT.FPS=45
  - `test_directories_exist` — all dirs (output, temp, assets, data, fonts, logs) exist
  - `test_abs_path_resolves` — relative path joins to PROJECT_ROOT
  - `test_absolute_path_passthrough` — absolute path stays absolute
  - `test_get_summary_contains_fields` — summary string has all key values
  - `test_singleton_consistency` — id(PROJECT) == id(ProjectInfo())

**File:** New file at `tests/test_project_info.py`

---

### 3.10 — Add tests for `easing.py`
**Status:** ❌ PENDING | **Effort:** 30 min

**What exists:** No test file for `easing.py`

**What to do:**
- Create `H:\DuaVideoGenerator\tests\test_easing.py` with:
  - `test_clamp01_boundary` — p=0→0, p=1→1, p=-0.5→0, p=1.5→1
  - `test_all_curves_at_zero` — every curve returns 0.0 at p=0
  - `test_all_curves_at_one` — every curve returns 1.0 at p=1 (except ease_out_back)
  - `test_ease_out_midpoint` — ease_out(0.5) ≈ 0.875
  - `test_ease_in_midpoint` — ease_in(0.5) ≈ 0.125
  - `test_ease_in_out_midpoint` — ease_in_out(0.5) == 0.5
  - `test_ease_out_back_overshoot` — ease_out_back(0.75) > 1.0
  - `test_monotonicity` — all curves are non-decreasing
  - `test_apply_valid_name` — apply("ease_in", 0.5) ≈ 0.125
  - `test_apply_unknown_defaults` — apply("nonexistent", 0.5) → ease_out(0.5)
  - `test_all_registered_curves` — CURVES has 10 keys

**File:** New file at `tests/test_easing.py`

---

## SPRINT 2: Core Module Tests

### 3.6 — Add tests for `effects_engine.py`
**Status:** ❌ PENDING | **Effort:** 2 hrs

**What exists:** No test file for `effects_engine.py` (819 lines, 26+ methods)

**What to do:**
- Create `H:\DuaVideoGenerator\tests\test_effects_engine.py` with:
  - `test_init_default_dims` — 1080x1920
  - `test_init_custom_dims` — custom size
  - `test_effects_registry_has_6` — Tier 1 effects
  - `test_apply_effect_known` — dispatches correctly
  - `test_apply_effect_unknown_fallback` — unknown → default_fade
  - `test_neon_glow_output_same_size`
  - `test_metallic_gold_channels_valid`
  - `test_typewriter_frame_zero_empty`
  - `test_bounce_clamp_negative_y`
  - `test_wave_wrap_no_index_error`
  - `test_glitch_deterministic`
  - `test_apply_to_frames_empty_list`
  - `test_apply_to_frames_none_effect`
  - `test_apply_plan_empty_frames`
  - `test_apply_plan_mismatch_returns_unchanged`
  - `test_fx_vignette_strength_zero`
  - `test_fx_grain_strength_zero`
  - `test_fx_bloom_glow_high_threshold`
  - `test_fx_breathing_amp_zero`
  - `test_fx_rtl_reveal_fraction_one`
  - `test_fx_glitch_v2_strength_zero`
  - `test_fx_word_pulse_strength_zero`

**File:** New file at `tests/test_effects_engine.py`

---

### 3.7 — Add tests for `revamp_engine.py`
**Status:** ❌ PENDING | **Effort:** 1 hr

**What exists:** No test file for `revamp_engine.py` (47 lines, simple module)

**What to do:**
- Create `H:\DuaVideoGenerator\tests\test_revamp_engine.py` with:
  - `test_init_populates_effects` — len(effects) == 15
  - `test_init_populates_colors` — len(color_schemes) == 5
  - `test_get_available_effects_returns_copy` — mutation isolation
  - `test_get_available_effects_contents` — all 15 names present
  - `test_get_available_colors` — ["cyan","gold","green","purple","red"]
  - `test_color_schemes_structure` — each has primary/secondary/background tuples
  - `test_instance_decoupled_from_module` — AVAILABLE_EFFECTS mutation doesn't affect instance
  - `test_multiple_instances_independent`

**File:** New file at `tests/test_revamp_engine.py`

---

### 3.8 — Add tests for `video_analyzer.py`
**Status:** ❌ PENDING | **Effort:** 1 hr

**What exists:** No test file for `video_analyzer.py`

**What to do:**
- Create `H:\DuaVideoGenerator\tests\test_video_analyzer.py` with:
  - `test_init_creates_directories`
  - `test_get_video_files_sorted`
  - `test_get_video_files_ignores_non_video`
  - `test_get_video_files_empty_dir`
  - `test_analyze_video_nonexistent` — returns None
  - `test_analyze_video_corrupt` — returns None
  - `test_extract_frames_capped_at_30`
  - `test_analyze_colors_returns_structure`
  - `test_analyze_colors_fallback_on_error`
  - `test_create_master_patterns_empty`
  - `test_save_style_creates_json`
  - `test_scan_all_samples_no_videos`

**File:** New file at `tests/test_video_analyzer.py`

---

### 3.11 — Add tests for `backup.py`
**Status:** ❌ PENDING | **Effort:** 1 hr

**What exists:** No test file for `scripts/backup.py`

**What to do:**
- Create `H:\DuaVideoGenerator\tests\test_backup.py` with:
  - `test_compute_checksum_valid_file`
  - `test_compute_checksum_nonexistent` — returns None
  - `test_create_backup_happy_path` — creates dir + manifest
  - `test_create_backup_partial_files`
  - `test_list_backups_empty`
  - `test_rotate_backups_under_limit`
  - `test_rotate_backups_over_limit`
  - `test_rotate_backups_missing_dir`

**File:** New file at `tests/test_backup.py`

---

### 3.12 — Add tests for `restore.py`
**Status:** ❌ PENDING | **Effort:** 1 hr

**What exists:** No test file for `scripts/restore.py`

**What to do:**
- Create `H:\DuaVideoGenerator\tests\test_restore.py` with:
  - `test_auto_backup_creates_dir`
  - `test_restore_backup_latest`
  - `test_restore_backup_by_name`
  - `test_restore_backup_force_mode`
  - `test_restore_backup_cancellation`
  - `test_restore_backup_missing_dir`
  - `test_restore_backup_nonexistent_name`
  - `test_auto_backup_before_restore`

**File:** New file at `tests/test_restore.py`

---

## SPRINT 3: CI/CD + Linting

### 3.3 — Add `ruff` lint + format check to CI
**Status:** ❌ PENDING | **Effort:** 1 hr

**What exists:** CI has `bandit` and `pip-audit` but no `ruff`

**What to do:**
- Add to `.github/workflows/ci.yml`:
  ```yaml
  - name: Install ruff
    run: pip install ruff
  
  - name: Lint with ruff
    run: ruff check .
  
  - name: Format check with ruff
    run: ruff format --check .
  ```

**File:** `.github/workflows/ci.yml`

---

### 3.4 — Add `mypy` strict mode to CI
**Status:** ❌ PENDING | **Effort:** 1 hr

**What exists:** CI has no type checking

**What to do:**
- Add to `.github/workflows/ci.yml`:
  ```yaml
  - name: Install mypy
    run: pip install mypy
  
  - name: Type check with mypy
    run: mypy core/ --ignore-missing-imports
  ```

**File:** `.github/workflows/ci.yml`

---

### 2.19 — Generate `requirements-lock.txt`
**Status:** ❌ PENDING | **Effort:** 30 min

**What exists:** Only `requirements.txt` (no lock file)

**What to do:**
- Run `pip freeze > requirements-lock.txt` in CI or locally
- Commit the lock file

**File:** New file at `requirements-lock.txt`

---

## SPRINT 4: UX Features

### 4.13 — Add voice preview (3s sample)
**Status:** ❌ PENDING | **Effort:** 2 hrs

**What exists:** No preview function in `tts_engine.py`. Full generation only.

**What to do:**
1. Add `generate_voice_preview(text, language, output_path, voice=None, max_seconds=3)` to `core/tts_engine.py`
2. Truncate text to ~2-3 sentences for ~3s audio
3. Skip WordBoundary metadata (no timing_path)
4. Single attempt, shorter timeout
5. Add API endpoint `POST /api/voice-preview` in `routes/config.js`
6. Add preview button in dashboard settings panel

**Files:**
- `core/tts_engine.py` (add method)
- `remotion/dashboard/routes/config.js` (add endpoint)
- `remotion/dashboard/public/app.js` (add preview button handler)

---

### 4.16 — Add cross-fade between audio clips
**Status:** ❌ PENDING | **Effort:** 2 hrs

**What exists:** No audio cross-fade logic

**What to do:**
- Add cross-fade function using moviepy's `AudioFileClip`:
  ```python
  def crossfade_clips(clips, fade_duration=0.5):
      result = clips[0]
      for clip in clips[1:]:
          result = concatenate_audioclips([result, clip])
      return result
  ```
- Or use ffmpeg-based cross-fade for better performance

**File:** `core/audio_mixer.py` or new utility

---

## SPRINT 5: VFX Enhancements

### 4.5 — Preview caching (fingerprint-based)
**Status:** ❌ PENDING | **Effort:** 1 hr

**What exists:** Only mtime-based raw file cache. Fingerprint functions exist but only for import dedup.

**What to do:**
- Add in-memory cache mapping `fingerprint → preview_result` in `custom-vfx.js`
- Key: SHA-256 of VFX descriptor + pattern config
- Value: rendered preview data
- TTL: 5 minutes or file change invalidation

**File:** `remotion/dashboard/custom-vfx.js`

---

### 4.6 — Concurrency limit for VFX preview renders
**Status:** ❌ PENDING | **Effort:** 1 hr

**What exists:** No concurrency control. Entire file is synchronous.

**What to do:**
- Add a simple semaphore/queue for preview renders
- Max 2-3 concurrent preview renders
- Use a task queue pattern

**File:** `remotion/dashboard/custom-vfx.js`

---

### 4.7 — Configurable effect weights/scoring
**Status:** ❌ PENDING | **Effort:** 2 hrs

**What exists:** Hardcoded `SIM_LABEL=0.85` and `SIM_VEC=0.12` constants

**What to do:**
- Add config object at top of `custom-vfx.js`:
  ```javascript
  const VFX_SCORING = {
    labelWeight: 0.85,
    vectorThreshold: 0.12,
    algorithm: 'l1'  // or 'l2', 'cosine'
  };
  ```
- Add UI in settings to adjust weights

**File:** `remotion/dashboard/custom-vfx.js`

---

## SPRINT 6: Security + Persistence

### 4.11 — Add encrypted backup for secrets
**Status:** ❌ PENDING | **Effort:** 2 hrs

**What exists:** `backup.py` copies files as-is (no encryption)

**What to do:**
- Use existing `SecurityManager` to encrypt sensitive files before backup
- Add `--encrypt` flag to `backup.py`
- Encrypt: `auth.json`, `security/vault.bin`, `yt_token_*.json`

**File:** `scripts/backup.py`

---

### 4.3 — Add render job persistence (survive restart)
**Status:** ❌ PENDING | **Effort:** 3 hrs

**What exists:** Job state is purely in-memory. Lost on restart.

**What to do:**
- Add `job-state.json` persistence (like `cacheStore`)
- `saveJobState()` on every step change
- `loadJobState()` on startup
- Handle interrupted jobs (mark as failed or re-queue)
- Save on shutdown in `renderShutdown()`

**File:** `remotion/dashboard/routes/render.js`

---

### 4.9 — Add JSON/SARIF output to security audit
**Status:** ❌ PENDING | **Effort:** 2 hrs

**What exists:** `security_audit.py` only prints to stdout

**What to do:**
- Add `--output-format json|sarif` flag
- JSON: structured findings array
- SARIF: GitHub-compatible security scanning format

**File:** `scripts/security_audit.py`

---

## SPRINT 7: Code Quality

### 5.7 — Wrap app.js in IIFE
**Status:** ❌ PENDING | **Effort:** 2 hrs

**What exists:** 183 global identifiers (128 functions + 55 variables)

**What to do:**
- Wrap entire file in `(function() { ... })();`
- Expose only necessary API via `window.Dashboard = { ... }`
- Keep event handlers global (onclick="...") or use addEventListener

**File:** `remotion/dashboard/public/app.js`

---

### 5.9 — Remove dead code (revamp_engine if unused)
**Status:** ❌ PENDING | **Effort:** 1 hr

**What exists:** `revamp_engine.py` exists but is only used for querying effect/color lists

**What to do:**
- Check if `revamp_engine.py` is imported anywhere outside tests
- If only used for lists, merge into `effects_engine.py`
- Remove dead code

**File:** `core/revamp_engine.py`

---

### 5.10 — Add `__all__` to Python modules
**Status:** ❌ PENDING | **Effort:** 30 min

**What exists:** No `__all__` in any core module

**What to do:**
- Add `__all__` to each core module:
  ```python
  __all__ = ['EffectsEngine', 'apply_effect']
  ```

**Files:** All `core/*.py` files

---

### 5.11 — Add config schema versioning
**Status:** ❌ PENDING | **Effort:** 1 hr

**What exists:** No schema version in config

**What to do:**
- Add `SCHEMA_VERSION = 1` to config
- Validate config files against schema on load
- Handle migration for version upgrades

**File:** `core/config.py`

---

### 5.14 — Add README for dashboard
**Status:** ❌ PENDING | **Effort:** 1 hr

**What exists:** No `remotion/dashboard/README.md`

**What to do:**
- Create README with:
  - Setup instructions
  - API endpoints
  - Development guide
  - Architecture overview

**File:** New file at `remotion/dashboard/README.md`

---

### 5.15 — Add JSDoc/docstrings for public APIs
**Status:** ❌ PENDING | **Effort:** 2 hrs

**What exists:** Minimal documentation

**What to do:**
- Add JSDoc to top 10 most-used JS functions
- Add docstrings to all Python public functions

**Files:** Various

---

## SUMMARY TABLE

| Sprint | Items | Total Effort | Priority |
|--------|-------|--------------|----------|
| 1: Testing Foundation | 5 | ~2.25 hrs | HIGH |
| 2: Core Module Tests | 5 | ~6 hrs | HIGH |
| 3: CI/CD + Linting | 3 | ~2.5 hrs | HIGH |
| 4: UX Features | 2 | ~4 hrs | MEDIUM |
| 5: VFX Enhancements | 3 | ~4 hrs | MEDIUM |
| 6: Security + Persistence | 3 | ~7 hrs | MEDIUM |
| 7: Code Quality | 6 | ~7.5 hrs | LOW |
| **TOTAL** | **30** | **~33.25 hrs** | |

---

## RECOMMENDED EXECUTION ORDER

1. **Sprint 1** → Foundation (2.25 hrs)
2. **Sprint 3** → CI/CD (2.5 hrs) — validates all future code
3. **Sprint 2** → Tests (6 hrs) — with CI running
4. **Sprint 4** → UX (4 hrs) — user-facing features
5. **Sprint 7** → Code Quality (7.5 hrs) — cleanup
6. **Sprint 5** → VFX (4 hrs) — enhancements
7. **Sprint 6** → Security (7 hrs) — hardest, do last

**Bhai, bol kahan se start karun?** 🚀
