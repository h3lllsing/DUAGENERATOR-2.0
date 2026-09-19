# V2 Objectives, Targets & Outcomes — the WHAT and the WHY

Authoritative goals for the V2.0 rebuild. A **new chat / new AI agent** reads this FIRST (plus `AGENTS.md`, `PORTAL_REFERENCE.md`) and does NOT need to ask "kaam kya hai?" — it executes toward these targets. Build happens in a separate session; this repo is the single source of truth.

## 1. Mission

Rebuild the Dua Video Studio as **V2.0**: a faster, more reliable, mobile-first content operations platform that replaces the current localhost portal (`H:\DuaVideoGenerator`, port 7860) for the YouTube Shorts dua channel — without losing any existing capability or content, and without any paid service.

## 2. Non-negotiable principles (owner directives)

1. **Better than production, in every way** — speed, reliability, UX, security, maintainability. Anything not at least as good as prod = do not ship.
2. **Free/open-source only** — no paid services, SDKs, fonts, or media.
3. **Mobile-first** — usable from a phone (PWA-ready), though dev runs localhost.
4. **Data safety** — nothing lost in migration; secrets never commit; backups exist.
5. **Auto-instructed agent** — all decisions, specs, and targets below are complete so a fresh agent just executes.
6. **Change control** — record every owner decision in `docs/V2_DECISIONS.md`.

## 3. Targeted results by phase

### Phase 1 — Foundation (DO FIRST)
**Outcome:** A running skeleton on **port 7870** that can replace prod's core without regressions.
- [ ] React+TS+Vite+Tailwind app and Fastify+better-sqlite3 server boot; proxy `/api`+`/ws`.
- [ ] SQLite schema created; **legacy data migrated 100%** (duas.json 114, upload ledger, shorts ledger, en_review, quota) with a verification report (counts match).
- [ ] **Single render worker** with DB-backed jobs; on restart it **auto-resumes 100%** of pending/running jobs (prod bug 1&2 eliminated).
- [ ] Auth on **100% of endpoints incl. media**; CSP; HTML stripping; rate limit.
- [ ] **Tested**: `verify_v2.js` smoke passes; vitest unit tests for repos + jobs FSM; API negative-auth tests green.
- **Definition of done:** `npm run dev` boots server+web on 7870; import report matches prod counts; queue resumes after forced restart; no endpoint reachable without token.

### Phase 2 — Content Studio
**Outcome:** Owner can edit and publish from one place; EN review no longer blocks on wrong text.
- [ ] Thumbnail Studio (pick still + upload via `thumbnails.set` logic) with A/B thumbnail set per video.
- [ ] Captions editor — **edit-in-place** EN SRT (fixes review-gate limitation), live preview.
- [ ] SEO manager — tags/hashtags/description builder (reuse `metadata.py` engine) + **category pillars upgrade** (kill the 43 `general` dupes into real theme buckets).
- [ ] Approval workflow: draft → QC pass → EN review(edit) → approved → upload queue (hard gate).
- **Definition of done:** create a new dua end-to-end (add → draft → render → QC → review-edit → queue) without touching CLI once.

### Phase 3 — Growth Engine
**Outcome:** Time-based publishing and data-driven decisions instead of manual ops.
- [ ] Scheduler/calendar: schedule publish times; worker respects **daily cap (10 uploads) + quota ledger**; auto-queue after **midnight PT = 12:00 noon PKT** reset.
- [ ] Analytics dashboard: views/likes/comments/CTR-proxy/retention cache (nightly cheap reads); **underperformer list with 1-click actions** (new thumb, retitle, reseo, reshare via share-kit).
- [ ] Playlist automation from `playlist_plan_channel1.json`; share-kit generator in UI.
- [ ] Trend radar: keyword suggestions feed a "topics queue".
- **Definition of done:** owner schedules 7 videos once, system publishes them across days within caps, and analytics shows per-dua performance with recommended fixes.

### Phase 4 — Scale & Hardening
**Outcome:** Production-superior ops and deployability; deterministic output.
- [ ] Mobile PWA installable; offline-safe heavy screens.
- [ ] Backups (daily SQLite+config snapshot, retention 7, checksummed) + restore runbook.
- [ ] Monitoring (PM2 + job/queue gauges + crash alerts) + disk-space panel.
- [ ] Determinism: persisted master config reload, remove `hash()` cache keys, seeded per-dua renders.
- [ ] Optional LAN/HTTPS (mkcert) for phone access.
- **Definition of done:** phone installs PWA over LAN; `restore --latest` recovers a full day's DB; two renders with same seed produce identical checksums.

## 4. KPIs (measurable outcomes the owner cares about)

1. **Betterness score** — every prod feature has a V2 equivalent verified equal-or-better (see `PORTAL_REFERENCE.md` §11 checklist).
2. **Zero data loss** — migration + ongoing backups verified by re-count.
3. **One-click flows** — publish, reseo, reshare, retitle each ≤1 click from the dashboard.
4. **Uptime** — worker auto-resumes; no silent queue stall (prod bugs gone).
5. **Cost** — $0 recurring spend.
6. **Speed** — incremental renders: unchanged dua = served from cache, not re-render (prod cache key kept).

## 5. Priorities / order of operations for the new agent session

1. Read: `AGENTS.md` → `docs/PORTAL_REFERENCE.md` → `docs/V2_GOALS.md` → `docs/V2_ARCHITECTURE.md` → `docs/V2_ENHANCEMENT_CATALOG.md` → `docs/V2_PHASE1_BRIEF.md` → `docs/V2_DECISIONS.md`.
2. Confirm env: npm available, python venv, Remotion deps ready (see `docs/V2_ONBOARDING.md` §Environment setup).
3. Execute **Phase 1 tasks** from `docs/V2_PHASE1_BRIEF.md`, in order A→F.
4. After each task: run its tests; update `CHANGELOG.md` + `docs/V2_GOALS.md` checkboxes + `AGENTS.md`.
5. When Phase 1 DoD met: stop and report — do NOT continue to Phase 2 without owner.

## 6. What the new agent must NOT do

- No changes to `H:\DuaVideoGenerator` (production) — read-only reference.
- No `git push` from this folder (no remote by design; owner adds one).
- No paid tools; no live YouTube writes without explicit owner go (dry-run first).
- No password/2FA (owner: local-only, see decisions).
- No asking the owner for things already decided in these docs.