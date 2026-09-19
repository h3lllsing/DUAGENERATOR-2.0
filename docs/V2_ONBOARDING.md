# V2 Onboarding — read this first (new agent)

This folder = the V2.0 rebuild of the Dua Video Studio portal. Production still runs at `H:\DuaVideoGenerator` (port 7860, pm2 `dua-studio`) and must stay untouched.

## Read order (≈45 min, REQUIRED before any V2 coding)

1. `AGENTS.md` (this workspace rules + owner decisions)
2. `docs/PORTAL_REFERENCE.md` — **FULL current production system reference** (schemas, API, 29 CLI scripts, Remotion props contract, SEO engine, configs, bugs, porting checklist). Read this so you NEVER build from zero or lose prod behavior.
3. `docs/V2_GOALS.md` — **targets, KPI, phases outcomes, definition-of-done** (kaam kya achieve karna hai).
4. `docs/V2_DECISIONS.md` — owner decisions log (never re-ask what's already decided).
5. `V2_AUDIT_AND_PLAN.md` (full audit findings + roadmap + open questions)
6. `docs/V2_ARCHITECTURE.md` (chosen stack, DB schema, API, workers)
7. `docs/V2_ENHANCEMENT_CATALOG.md` (features/tools/security/architecture ideas + free-only policy)
8. `docs/V2_PHASE1_BRIEF.md` (current milestone tasks)
9. Reference only (do not edit): prod `H:\DuaVideoGenerator\remotion\src`, `remotion\scripts\metadata.py`, `core\` TTS/audio/QC modules

## Key gotchas when working here

- **Never** run `git push` from this folder until an origin is re-added (it was removed to shield prod). Ask owner for the new repo.
- **Never** touch `H:\DuaVideoGenerator`. Read-only reference.
- **Port 7860 is taken** by prod. Use 7870 for V2 dev; configure Vite + Fastify accordingly.
- YouTube quota resets **midnight PT = 12:00 noon PKT**. Test uploads only in dry-run or after confirming quota. Always ask owner before live writes.
- Python CLI scripts must run with correct cwd (e.g. Remotion CLI from `remotion/`), and Remotion props must be wrapped `{"data": {...}}` (see prod `make_thumbs.py`).
- Non-ASCII (Urdu/Arabic): set `PYTHONUTF8=1` or wrap stdout; use Read tool for files, grep tool for searches (`rg` not installed).
- Keep docs/AGENTS/CHANGELOG updated each milestone. Commits = conventional style.

## Legacy / historical docs (cloned from prod — DO NOT follow as current plan)

These shipped in the git clone and are STALE or historical. Current truth = V2 docs above + `docs/PORTAL_REFERENCE.md`. Read them ONLY for background, never for task requirements:

- `MASTER_PLAN.md`, `OPTIMIZATION_PLAN.md`, `PENDING_EXECUTION_PLAN.md`, `PROJECT_CHECKLIST.md`, `FIXES_PLAN.md` — pre-V2 prod roadmaps (some marked ALL PHASES COMPLETE, some obsolete).
- `AUDIT_*`, `FULL_AUDIT.md`, `DETAILED_AUDIT_REPORT.md`, `MASTER_AUDIT_PLAN.md`, `BEFORE_AFTER_EFFECTS.md`, `docs/SYSTEM_AUDIT.md` — historical prod audits (superseded by `V2_AUDIT_AND_PLAN.md`).
- `docs/API.md`, `docs/EFFECTS_RESEARCH.md`, `docs/FREE_RESOURCES.md`, `LIST.md`, `MD/`, `remotion/NOTES.md` (dev log), `share_kit/INDEX.md` (generated data), `remotion/dashboard/README.md` — reference/dev notes; may describe the OLD pipeline.
- `CONTRIBUTING.md`, `SECURITY.md`, `.github/` templates — keep (still valid project conventions).

If a legacy doc contradicts a V2 doc, **the V2 doc wins**.

## Environment setup (one-time)

Required: Node ≥ 18 (npm workspaces), Python 3.11+ (edge-tts), ffmpeg on PATH.

Verified working on this machine: system Node **v24.16.0** (`C:\Program Files\nodejs`) with **better-sqlite3 ^13.0.0** (prebuilt binary for Node 24 — no Visual Studio/node-gyp needed). Run installs from the repo root (npm workspaces).

```powershell
cd "H:\DUAGENERATOR 2.0"
npm install
py -m venv .venv ; .venv\Scripts\Activate.ps1
pip install -r requirements.txt
cd remotion ; npm install ; cd ..
node scripts/verify_v2.js   # requires server running (see below)
```

Native module trap: `better-sqlite3` is ABI-bound to the Node version that built it. A Node 22 build (ABI 127) fails on Node 24 (ABI 137) with `NODE_MODULE_VERSION` errors and `npm rebuild` needs VS Build Tools C++ (not installed). The repo is pinned to Node 24 + better-sqlite3 ^13 — do NOT downgrade better-sqlite3 to ^11 or switch to a portable Node 22; reinstall instead.

Portal launch (canonical, matches prod 7860): Fastify serves the built SPA on **7870**.
```powershell
cd "H:\DUAGENERATOR 2.0"
npm --prefix apps/web run build     # builds apps/web/dist once
npm --prefix apps/server run dev    # serves UI + /api on http://127.0.0.1:7870
```
Dev UI with HMR: run the server with `PORT=7871`, then `npm --prefix apps/web run dev` (Vite@7870 proxies `/api` → `127.0.0.1:7871`). Never bind both at 7870 at once.

## Phase 3 Growth Engine (migration 003)

Schema tables: `schedules` (+`note`/`job_id`/`created_at`/`updated_at`), `playlists`, `playlist_members`, `topics`; settings `analytics_threshold_views` (100), `publish_interval_sec` (15).

- **Scheduler**: `apps/web/growth/scheduler` — create schedule per video; publish worker (`src/workers/publish-worker.ts`) runs `runPublishCheck()` every `publish_interval_sec`, honoring the channel daily cap (10) with PT-day rollover (midnight PT = noon PKT). Uploads become `jobs state=queued` type `upload` (render worker handles queue; no live YouTube mutation here).
- **Quota**: `src/growth/quota.ts` — `consumeQuota`/`uploadsRemaining`; reset handled lazily on `quota_date` mismatch.
- **Analytics**: manual/dev-safe only (no YouTube API reads). Feed `data/analytics_manual.json`, then `node scripts/import_analytics.js` or POST `/api/v1/analytics/import` — or POST `/api/v1/analytics/sample` for dev-only fabricated rows. Dashboard flags underperformers below `analytics_threshold_views` with 1-click action hints.
- **Playlists**: `node scripts/import_playlists.js` ports `H:\DuaVideoGenerator\data\playlist_plan_channel1.json` (9 playlists / 87 members; 2 slugs not in V2 duas: `dua-khiyanat-se-bachne-ki-dua`, `dua-ilm-aur-pakiza-rizq-ki-dua`). Mark members added/skipped in UI; get a copy-paste URL manifest per playlist.
- **Topics**: trend radar suggestions from duo source/category/keywords via POST `/api/v1/topics/suggest`, then triage to progress/done/ignored.
- **Share kit**: GET `/api/v1/share/:youtubeId` or `/api/v1/videos/:id/share` → formatted WhatsApp/post text with hashtags (empty watch URL if video has no youtube yid yet).

Launch order after Phase 3 changes: kill :7870, `npm --prefix apps/web run build`, relaunch server from repo root (so `process.cwd()/data` = `H:\DUAGENERATOR 2.0\data`, `apps/web/dist` found). Migration 003 applies automatically on boot.

## Definitions (same names as prod)

- `duas.json` → dua library (Arabic+Urdu; EN now required for every dua)
- `upload_state_channel1.json` / `shorts_state_channel1.json` → legacy ledgers (imports into SQLite)
- `en_review.json` → approved/rejected EN subtitles
- `CATEGORY_SEO` / `HASHTAG_POOL` (metadata.py) → tags & hashtags engine to reuse
- Channel1 id `UC76kpCCao-WKwgZ5tiUMl4Q`; 20/21 shorts intentionally PRIVATE; do not flip without owner