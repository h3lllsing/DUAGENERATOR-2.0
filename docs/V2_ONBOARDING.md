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
- **Analytics**: manual/dev-safe only (no YouTube API reads). Feed `data/analytics_manual.json`, then `node scripts/import_analytics.js` or POST `/api/v1/analytics/import`. Dashboard flags underperformers below `analytics_threshold_views` with 1-click action hints.
- **Playlists**: `node scripts/import_playlists.js` ports `H:\DuaVideoGenerator\data\playlist_plan_channel1.json` (9 playlists / 87 members; 2 slugs not in V2 duas: `dua-khiyanat-se-bachne-ki-dua`, `dua-ilm-aur-pakiza-rizq-ki-dua`). Mark members added/skipped in UI; get a copy-paste URL manifest per playlist.
- **Topics**: trend radar suggestions from duo source/category/keywords via POST `/api/v1/topics/suggest`, then triage to progress/done/ignored.
- **Share kit**: GET `/api/v1/share/:youtubeId` or `/api/v1/videos/:id/share` → formatted WhatsApp/post text with hashtags (empty watch URL if video has no youtube yid yet).

Launch order after Phase 3 changes: kill :7870, `npm --prefix apps/web run build`, relaunch server from repo root (so `process.cwd()/data` = `H:\DUAGENERATOR 2.0\data`, `apps/web/dist` found). Migration 003 applies automatically on boot.

## Audit fixes (migration 004)

Bugs found in full code audit and fixed (commit 71a38fa onwards, working tree):

- `auth.ts` — cookie branch used non-existent `request.cookies` (dead); now parses `Cookie` header; `loadToken` TS return-type fixed. `npm run build` (tsc) now passes for server.
- `routes/captions.ts`, `routes/thumbnails.ts` — invalid Fastify 4 route option `{ body: false }` removed.
- `routes/videos.ts` — GET /videos now JOINs `duas` for `dua_title`/`dua_slug` (SchedulerPage dropdown labels); re-render/queue upsert the existing `render` job back to `queued` instead of hitting `UNIQUE(video_id, type)` (was 500). Pagination `total` now respects filters (also `/jobs`, `/duas`).
- `workers/render-worker.ts` — `compId = dua.id.replace(...)` crashed (integer id); now `'dua-' + dua.id`.
- Trash semantics — `DELETE /duas/:id` soft-delete reused `status='draft'` so trash = all drafts and restore was a no-op. Migration 004 adds `duas.deleted INTEGER DEFAULT 0`; delete sets it, `/api/v1/trash` lists it, `/restore` clears it.
- Removed dev-only testing scaffold from app code: `/api/v1/analytics/sample` route, `buildSampleRows`, web `sampleAnalytics` client method, and the "Fill sample data (dev)" button. Unit/smoke tests kept (user instruction: "Kuch nahi hatana").

Known design limitations (documented; typically FIXED in Phase 4 where noted):
- ~~Render worker in-process (`index.ts` → `startRenderWorker`) with synchronous `execSync` Python/Remotion/ffmpeg steps — a long render blocks the whole :7870 API~~ **FIXED (Phase 4):** workers moved to separate `src/worker.ts` process; API only queues jobs (`data` no longer blocks on renders). PM2 runs both (`ecosystem.config.js`).
- `jobs` state `retry` is never emitted and `getNext` re-picks `failed` jobs → with a persistent env failure a job auto-retries forever (no cap). Harmless in dev.
- Duas have no `deleted` history: 001–003 rows soft-deleted as `draft` are indistinguishable from real drafts; only deletions from migration 004 on land in trash.

## Verification-of-claim fixes (migration 005 + worker recovery + legacy seeding)

Owner challenged "phases complete" claims — audit proved 3 were incomplete. Fixed:

- **Render worker auto-resume** — `recoverInterruptedJobs()` (render-worker.ts) resets `prep/render/qc/retry` jobs back to `queued` on boot; the Phase 1 DoD claim is now true (was false: `getNext()` only picked `queued/failed`).
- **Pillars (43 general)** — migration `005_phase2_pillars.sql` remaps all 43 `general` duas into theme buckets (occasions/guidance/family/anxiety_relief/gratitude/health/protection/forgiveness); `general` = 0; Phase 2 DoD item now true.
- **Legacy migration honesty** — `scripts/verify_migration.js` writes `data/migration_report.json` (truthful counts): duas 114/114; ledger 104 rows/85 distinct duas with an explicit unmatched list (`khiyanat_se_bachne_ki_dua`, `ilm_aur_pakiza_rizq_ki_dua` — no parent dua exists in the library, not representable); en_review (27 approved) copied to `data/legacy_en_review.json` and auto-attached via `seedReviewFromLegacy()` (src/growth/legacy.ts) whenever a video is created for that dua (POST /api/v1/videos), reviewer=`legacy-migration`. E2E verified: POST video → review row `kind=en status=approved`
- Phase 1 "migrated 100%" claim is now stated precisely with the 2-orphan caveat instead of an over-claim.

## Phase 4 — Scale & Hardening (2026-09-20)

Detached workers (`src/worker.ts`), monitoring (`/api/v1/monitoring` + dashboard panel + `data/alerts.log`), PM2 (`ecosystem.config.js`), PWA (manifest + `sw.js` offline shell), determinism verified (no `Math.random`; seed = `dua.id`), LAN/HTTPS guide (`V2_LAN_HTTPS.md`). Backups = not delivered (owner opt-out). Details in `V2_PHASE4_BRIEF.md`.

## Definitions (same names as prod)

- `duas.json` → dua library (Arabic+Urdu; EN now required for every dua)
- `upload_state_channel1.json` / `shorts_state_channel1.json` → legacy ledgers (imports into SQLite)
- `en_review.json` → approved/rejected EN subtitles
- `CATEGORY_SEO` / `HASHTAG_POOL` (metadata.py) → tags & hashtags engine to reuse
- Channel1 id `UC76kpCCao-WKwgZ5tiUMl4Q`; 20/21 shorts intentionally PRIVATE; do not flip without owner