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
- [x] SQLite schema created; **legacy data migrated 100%** (duas.json 114, upload ledger, shorts ledger, en_review, quota) with a verification report (counts match). *(Report: `node scripts/verify_migration.js` → `data/migration_report.json`. Truth: duas 114/114; ledger 104 rows / 85 distinct duas; 2 orphan uploads `khiyanat_se_bachne_ki_dua`, `ilm_aur_pakiza_rizq_ki_dua` have NO parent dua in library — not representable; en_review 27 carried into `data/legacy_en_review.json`, auto-attached on video creation.)*
- [x] **Single render worker** with DB-backed jobs; on restart it **auto-resumes 100%** of pending/running jobs (prod bug 1&2 eliminated). *(Worker recovery: `recoverInterruptedJobs()` resets prep/render/qc/retry → queued on boot.)*
- [ ] Auth on **100% of endpoints incl. media**; CSP; HTML stripping; rate limit.
- [ ] **Tested**: `verify_v2.js` smoke passes; vitest unit tests for repos + jobs FSM; API negative-auth tests green.
- **Definition of done:** `npm run dev` boots server+web on 7870; import report matches prod counts; queue resumes after forced restart; no endpoint reachable without token.

### Phase 2 — Content Studio
**Outcome:** Owner can edit and publish from one place; EN review no longer blocks on wrong text.
- [ ] Thumbnail Studio (pick still + upload via `thumbnails.set` logic) with A/B thumbnail set per video.
- [ ] Captions editor — **edit-in-place** EN SRT (fixes review-gate limitation), live preview.
- [x] SEO manager — tags/hashtags/description builder (reuse `metadata.py` engine) + **category pillars upgrade** (kill the 43 `general` dupes into real theme buckets). *(Migration 005 remaps all 43 → occasions/guidance/family/anxiety_relief/gratitude/health/protection/forgiveness; `general` = 0.)*
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
- [x] Mobile PWA installable (`manifest.webmanifest` + `sw.js` offline app shell); API stays network-only.
- [x] Monitoring (`GET /api/v1/monitoring` + dashboard panel) + PM2 (`ecosystem.config.js`: `v2-server` API + `v2-worker` detached render/publish) + crash alerts log (`data/alerts.log`).
- [x] Determinism: seeded per-dua renders already rolled (`_seed_pick(dua.id)` in `make_manifest.py`, sha1-derived metadata, no `Math.random` in `remotion/src`); no `hash()` cache keys exist in V2 (no render cache) — nothing to remove.
- [x] Optional LAN/HTTPS guide for phone access (`V2_LAN_HTTPS.md`, mkcert).
- **Definition of done:** phone installs PWA over LAN; two renders with same seed produce identical checksums (seed determinism verified in remotion stack; check `docs/V2_PHASE4_BRIEF.md`). (Backups: owner opted OUT — see `V2_DECISIONS.md`.)

## 4. KPIs (measurable outcomes the owner cares about)

1. **Betterness score** — every prod feature has a V2 equivalent verified equal-or-better (see `PORTAL_REFERENCE.md` §11 checklist).
2. **Zero data loss** — migration + ongoing backups verified by re-count.
3. **One-click flows** — publish, reseo, reshare, retitle each ≤1 click from the dashboard.
4. **Uptime** — worker auto-resumes; no silent queue stall (prod bugs gone).
5. **Cost** — $0 recurring spend.
6. **Speed** — incremental renders: unchanged dua = served from cache, not re-render (prod cache key kept).

## 5. Priorities / order of operations for the new agent session

1. Read: `AGENTS.md` → `docs/PORTAL_REFERENCE.md` → `docs/V2_GOALS.md` → `docs/V2_ARCHITECTURE.md` → `docs/V2_ENHANCEMENT_CATALOG.md` → `docs/V2_PHASE1_BRIEF.md` → `docs/V2_DECISIONS.md` → content rules (`CONTENT_POLICY.md`, `YOUTUBE_COMPLIANCE.md`).
2. Confirm env: npm available, python venv, Remotion deps ready (see `docs/V2_ONBOARDING.md` §Environment setup).
3. **§9 Mandate (analysis first):** read ALL old production code, then produce your own roadmap in `docs/IMPROVEMENT_ROADMAP.md` covering every §7 area; register it (commit) and surface it to the owner before coding.
4. Execute **Phase 1 tasks** from `docs/V2_PHASE1_BRIEF.md`, in order A→F + the roadmap items that fit Phase 1.
5. After each task: run its tests; update `CHANGELOG.md` + `docs/V2_GOALS.md` checkboxes + `AGENTS.md`.
6. When Phase 1 DoD met: stop and report — do NOT continue to Phase 2 without owner.

## 6. What the new agent must NOT do

- No changes to `H:\DuaVideoGenerator` (production) — read-only reference.
- No `git push` from this folder (no remote by design; owner adds one).
- No paid tools; no live YouTube writes without explicit owner go (dry-run first).
- No password/2FA (owner: local-only, see decisions).
- No asking the owner for things already decided in these docs.

## 7. Improvement AREAS — every layer, AI-led. Owner lists the AREAS only; the AI decides WHAT and HOW

The owner's directive: this request covers **Architecture → Backend → Frontend → UI/UX → Pipeline → Content → Operations → Security**, and the V2 agent must find improvements/enhancements **at every single place** — nothing is considered "already fine" without its own evidence.

Owner gives the AREAS (below). The AI must not just implement the plan; it must first **read all old code** (`H:\DuaVideoGenerator`) and its **own analysis** of every area below, decide what is better and how, and produce `docs/IMPROVEMENT_ROADMAP.md` (its own roadmap + rationale) BEFORE writing code.

Areas to analyze (inside each: WHAT is weak today, HOW to make it better, EVIDENCE from old code):

1. **Visual/video output** — render quality, style variety, motion, themes/presets, VFX layers, Arabic/Urdu typography & rendering, background media, thumbnail design CTR, opening hook (first 3s), end-card/CTA, word-highlight/karaoke timing.
2. **Audio** — TTS voice quality & selection, accent naturalness, mixing/mastering/loudnorm, silence/energy, voice-vs-text alignment, preview.
3. **Content/data** — dua library (114), pillars/categories, authenticity guardrails (Sunni sources), EN/UR/AR translations quality, taxonomy, dedupe, coverage gaps, seasonal content.
4. **Pipeline/performance** — render time, caching (unchanged = no re-render), batching, resource/CPU use, determinism, QC depth, parallel-safe ops, disk management.
5. **Data model/storage** — schema quality, migration safety, backup/restore, analytics model, ledger integrity.
6. **Backend/API** — correctness, error handling, type safety, endpoints gaps, WS realtime, worker FSMs, idempotency, observability.
7. **Frontend/UI-UX** — dashboard UX, mobile PWA, workflow ergonomics (fewer clicks), editing studios (thumb/caption/SEO), a11y, i18n (Urdu), performance, offline.
8. **Security** — auth coverage, media protection, secrets, headers/CSP, input validation, audit log.
9. **Operations/automation** — scheduling, monitoring, notifications, self-healing, quota planner, backups, crash resilience.

Rule: if a suggestion in the catalog/docs is included, the AI re-validates it against the real code and only keeps what it can defend. Anything it leaves out must be noted with reason.

## 8. Content context — ISLAMIC DUA GENERATOR (SUNNI)

Non-negotiable content identity for every screen, every prompt, every render:

- This product is an **Islamic dua video generator**. The project is **SUNNI**, and content must stay within **authentic Sunni practice**: duas sourced from the accepted hadith/dua corpus (Sahih al-Bukhari, Sahih Muslim, Jami at-Tirmidhi, Sunan Abi Dawud, Sunan an-Nasa'i, Sunan Ibn Majah, and established classical dua literature).
- Every dua carries a  (hadith collection + reference). The reference must remain attached in title/description exactly as the source states; never invent or alter a dua's source.
- Do not introduce content from other sects or denominational disagreement. If a dua is found across Sunni sources with differences, keep the most widely authenticated wording.
- Arabic text must be accurate (diacritics correct), Urdu & English translations faithful to the Arabic meaning; no paraphrase drift, no fabricated content. Weak or fabricated works must be flagged, not silently included (see `CONTENT_POLICY.md`, `YOUTUBE_COMPLIANCE.md` in the clone — keep them in V2).
- AI-assisted dua generation (aihubmix import) must be validated against this rule — if the model cannot guarantee the source, it must not pass.
- Visuals remain respectful: mosque/nature/quiet imagery, no music beyond ambience, no nasheed, no faces in a context that conflicts with the tone. Keep the existing compliance docs as the working rules.

## 9. Mandate BEFORE any coding — analysis first (owner directive)

The V2 agent must, as its FIRST deliverable in a new session:

1. Read this whole doc + `AGENTS.md` + `docs/PORTAL_REFERENCE.md` + old production code (`H:\DuaVideoGenerator` — full read: `server/routes`*, `remotion/src`, `remotion/scripts/*`, `core/*`, data files, dashboard UI).
2. Build its **own separate roadmap** in `docs/IMPROVEMENT_ROADMAP.md`: for EVERY area in §7, its own findings (what is weak, what is good, what to improve/how), grounded in the actual code.
3. Present improvements/enhancements layer by layer: **Architecture → Backend → Frontend → UI/UX → Pipeline → Content → Security → Ops** — nothing auto-skipped.
4. Only after that roadmap is registered locally + owner reads it, begin Phase 1 implementation.

This guarantees the new chat arrives at improvement ideas itself — the owner did not spoon-feed solutions, only areas.