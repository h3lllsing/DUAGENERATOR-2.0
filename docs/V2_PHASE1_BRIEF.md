# V2 Phase 1 — Foundation (current milestone)

Target: a running V2 skeleton that supersedes the prod dashboard's worst bugs and sets the storage/realtime base. Acceptance = `apps/web` + `apps/server` boot on **7870**, SQLite migrated from legacy JSON, one render queue that auto-resumes, authenticated everything.

## Tasks

### A. Scaffold
- [ ] `apps/web`: Vite + React + TS + Tailwind; PWA manifest + SW (later); `npm run dev` on 7870 (proxy `/api` + `/ws` → server).
- [ ] `apps/server`: Fastify + `@fastify/websocket` + `better-sqlite3`; `v2.db` under gitignored `data/`; port 7870.
- [ ] vitest setup both apps; prettier/eslint; `npm scripts` at root (workspaces).

### B. Data layer
- [ ] `db/migrations/001_init.sql` + repo modules (duas, videos, channels, ledger, review, jobs, analytics, settings, schedules) per `docs/V2_ARCHITECTURE.md` §2.
- [ ] `scripts/import_legacy.js`: `duas.json` + `upload_state_channel1.json` + `shorts_state_channel1.json` + `en_review.json` → DB (idempotent, backs up JSON first).
- [ ] Schema CHECK constraints mirror prod rules (duplicate prevention: exact/fuzzy + Arabic Jaccard — port from prod `duas.js`/`youtube.js`).

### C. Render jobs (fixes prod queue bugs by design)
- [ ] `jobs` table = source of truth; single `render-worker` loop; boot auto-resume of `pending/running` jobs.
- [ ] `POST /api/v1/videos/{id}/render` + additive queue; WS events `job`/`queue`.
- [ ] Worker shells `remotion/scripts/prepare_dua.py` (TTS + merge) → `make_manifest.py` → Remotion CLI (cwd=`remotion/`, wrapped `{"data":...}` props) → BT.709 → `qc.py` (one retry) → thumb + srt + metadata (reuse prod scripts). No parallel renders.

### D. Auth & security (V2 baseline)
- [ ] Bearer token **only** (NO password/2FA — owner decision, local-only; see `docs/V2_DECISIONS.md`); auth on **all** endpoints incl `/media/*`; CSP; HTML stripping; CSRF/origin allowlist; rate-limit `/api`.
- [ ] Secrets only via env/`data/` (gitignored); `timingSafeEqual`.

### E. Upload skeleton
- [ ] `channels` + quota ledger + `publish-worker` (sequential, daily caps, dry-run flag, watchdog). No live writes without owner confirmation.

### F. QA
- [ ] Unit: repos + jobs state machine; integration: boot → import → render job path (dry-run render off), API auth negative tests.
- [ ] `scripts/verify_v2.js` smoke test (health, auth, import counts, queue resume).

## Out of scope now (later phases)
Thumbnail/caption/SEO editors, scheduler/calendar, analytics UI, playlists/share-kit in UI, multi-user, PWA polish, cloud deploy. See `V2_AUDIT_AND_PLAN.md` §5.