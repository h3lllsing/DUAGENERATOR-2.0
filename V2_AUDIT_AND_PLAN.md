# V2.0 — Portal Audit & Roadmap

Audit date: 2026-09-20. Covers the full Dua Video Studio dashboard (Node server + vanilla JS frontend), the Python/Remotion pipeline, data model, security and operations. Final section = V2.0 architecture + phased roadmap.

> **STATUS 2026-09-20: ALL §7 OPEN DECISIONS RESOLVED by the owner** — React+TS+Vite+Tailwind, Fastify+better-sqlite3, SQLite single-file, localhost/LAN (mobile-first PWA), single user (solo), all 4 phases. **`docs/V2_DECISIONS.md` is authoritative.** Where this proposal still says "password/2FA" (§3.7, §4 auth line, §5 Phase-1) that is **superseded** — owner decided NO password/2FA (local-only, token auth). Sections §3–§5 below are the ORIGINAL proposal; follow `docs/V2_ARCHITECTURE.md`, `docs/V2_GOALS.md`, `docs/V2_PHASE1_BRIEF.md` for the current plan.

---

## 1. Executive Summary

**Current state**: a single-user, localhost-only tool that works end-to-end and has been validated in production (136 videos live on channel1). It has genuinely strong foundations: layered duplicate prevention, QC gate, quota guardrails, watchdog timeouts, atomic writes, and a forward-only status model.

**V2.0 goal**: turn a good single-user local tool into a multi-device, mobile-first **content operations platform** — scheduler, analytics/insights, thumbnail & caption studio, approval workflows, multi-channel playbooks, notifications, and one reliable render path. Keep every strength, fix the known races, and modernize the stack where it pays off.

---

## 2. Audit — Current State

### 2.1 Architecture
```
Browser (index.html + app.js, vanilla JS)
   └─ EventSource (SSE) ──► /api/status/stream
Node raw `http` server (NOT Express) @ 127.0.0.1:7860
   ├─ bearer token OR HttpOnly SameSite cookie, POST rate-limit 30req/2s/IP
   ├─ origin whitelist (localhost only) + security headers
   ├─ routes/duas.js      CRUD + trash + AI import/fill/format
   ├─ routes/render.js    single render + additive queue + SSE + TTS + thumbs + history (1123 ln)
   ├─ routes/youtube.js   auth/upload/ledger/quota/stats/sync (902 ln)
   ├─ routes/batch.js     Python batch_render.py passthrough
   ├─ routes/vfx.js       VFX preset import + Remotion still previews
   ├─ routes/review.js    EN subtitle approve/reject gate
   ├─ status_store.js     dua_status.json (forward-only statuses)
External: Remotion CLI (+Chrome headless), ffmpeg, Azure/edge TTS, YouTube Data API
```

Two independent video pipelines exist:
1. **Remotion path (current)**: dashboard render.js → `make_manifest.py` → Remotion CLI → BT.709 tag → `qc.py` → thumbs → srt → metadata. `remotion/src` components (`DuaVideo.tsx`, `ThumbCard.tsx`, `themes.ts`, VFX system) with per-dua manifests in `remotion/src/data/*.json`.
2. **Legacy Python path**: `main.py` + `core/scene_engine.py` + `core/video_builder.py` (PIL/moviepy FX) — used for the pre-Remotion era; still holds a lot of TTS/audio/metadata/shared logic.

### 2.2 Frontend findings
- Single-file `app.js` (2443 lines), module-level globals, inline `onclick` handlers, no framework/bundler, **no tests**.
- Features present: status-section card grid, additive queue bar + progress ring, hover popup, selection toolbar, modals (edit, voice preview w/ waveform, AI import, VFX Studio, Batch Manager, EN Review, Settings, History), YouTube manager panel (channel select, privacy, live/dry-run, 1–6 picker, uploads table w/ re-upload + title/tags update).
- Escaping consistent (`escHtml`); dark theme tokens; responsive grid 5→1; mobile hamburger drawer; reduced-motion + focus-visible.
- Gaps: no CSP (inline handlers), Google Fonts external dependency, hardcoded UI copy mixes Urdu/Roman Urdu, custom modals instead of `<dialog>`, no keyboard nav/shortcuts, single status typo (app.js:538), no empty/error states polish grid.

### 2.3 Backend findings
- ~45 endpoints; route-chain dispatch; consistent `{ok:false,error}` contract; 1MB body cap; atomic `.tmp`+rename writes everywhere.
- **Dual render/queue systems** (JS queue + Python batch) — can run concurrently and thrash Chrome/CPU.
- Bugs (priority):
  1. **Queue restore never auto-starts** after restart (render.js:56-68 populates queue, nothing calls `processQueue()`).
  2. **`render-selected` append stalls when a single job is running** (render.js:1039-1042 gate).
  3. **queue_state.json write is non-atomic** (render.js:27-36).
  4. Three copies of the atomic-write pattern; two `readConfigCached` implementations (config.js:15, render.js:184).
  5. Three-way "upload truth" divergence risk: `dua_status.json` ↔ ledgers ↔ YouTube, only backward-synced.
  6. AI import = fire-and-forget script with "last stdout line" JSON parse (fragile) (duas.js:456).
  7. `thumbs-all` serial Chrome, no cancel; `open-folder` spawns explorer.exe on authed request.
  8. `taskkill /T /F` for cancel = process-group force kill (PID reuse risk).
  9. Crash handler logs but doesn't exit (server.js:243).

### 2.4 Security findings
- Strengths: token auth + timingSafeEqual, HttpOnly SameSite cookie, origin whitelist, POST rate limit, traversal guards, spawn arg arrays, security headers, secrets masked in API responses.
- Weaknesses:
  1. **All media/static endpoints are unauthenticated** (`/video/*`, `/thumb/*`, `/audio/*`, `/temp/*`, `/preview/*`, `/vfx-preview/*`) — any local tab can stream content (loopback bind is the only mitigation).
  2. **No CSP**; server never strips HTML from title/arabic/urdu (escapes live only in frontend).
  3. Secrets plaintext on disk (ai_api_config, client_secret, tokens, auth.json) — fine for personal local tool, not shareable.
  4. GET /api unlimited rate; `Set-Cookie` issued on plain GET /.

### 2.5 Pipeline / Python findings
- Determinism: `master_config.py` Master Randomizer seeds `random.Random(seed)` but helpers use the **global `random`**; `scene_engine.py` uses `hash()` (PYTHONHASHSEED-dependent) for cache keys; background pick `random_mode=True`. Renders are not fully reproducible unless a persisted `master_config.json` is reloaded.
- Doc drift: `tts_engine.py` comments claim Gemini routing — no such code; defaults `ar-SA-HamedNeural` / `ur-PK-AsadNeural`.
- Config sprawl: `config.py` vs `core/master_config.py` vs dashboard `config.json` + `remotion.config.ts`.
- `remotion/scripts/*` CLI tools are solid, single-purpose, and form the current ops layer (make_shorts, make_thumbs, upload_thumbs, seo_batch, attach_captions, plan_playlists, generate_share_kit).
- Tests exist mainly for legacy Python (21 files); no dashboard/frontend tests, no Remotion component tests.

### 2.6 Data model
- `duas.json` (list, dedupe: exact/fuzzy ≥90% + Arabic Jaccard ≥0.85 on upload), `en_review.json` (approve/reject gate for EN subtitles), `verified_en.json`, ledgers `upload_state_channel1.json` (87) + `shorts_state_channel1.json` (21), `dua_status.json` (forward-only), `quota_state_ch*.json`, trash (30-day cleanup).
- Strengths: forward-only statuses, per-channel `uploaded_channels`, reversible trash. Gaps: no single source of truth, no schema validation on read, manual edits can silently degrade dedupe.

### 2.7 Operations
- PM2 fork (1 instance, 512MB heap), autostart VBS, crash log rotation, 6h temp cleanup, daily cap 10 uploads + 9000 quota units, 10-min upload watchdog, 5-min auth watchdog, rate-limit cooldown.
- No scheduling/cadence, no disk-space view, no failure notifications, no analytics beyond basic view counts.

---

## 3. V2.0 Vision

Turn the dashboard into a **mobile-first content ops platform** for short-form Islamic content that the owner can run from a phone/browser, with the same rigor.

Design principles:
1. **One render path** — Remotion only; legacy Python FX retired to TTS/audio/metadata helpers.
2. **Real data store** — SQLite (single file, no server), JSON kept only as backup/export.
3. **Framework backend** — Express/Fastify (Node) keeps Remotion/ffmpeg orchestration; Python stays as the TTS/metadata/QC engine via script RPC (current pattern, formalized).
4. **Realtime** — WebSockets replace SSE for job/queue/upload progress.
5. **Workflow-first** — Draft → QC → EN review → approved → scheduled → published — explicit states the UI reflects.
6. **Growth tooling** — scheduler/calendar, analytics & insights, thumbnail studio, captions editor, SEO manager, playlists manager, share-kit generator, multi-channel playbooks, notifications.
7. **Security by default** — auth for ALL endpoints, CSP, password-gated (optional LAN/HTTPS deployment), secrets in env/OS keyring.

---

## 4. V2 Architecture (proposed)

```
PLATFORM TIER
  Mobile-first PWA (React or Vue + Vite + TS + Tailwind)
      Cards grid | Studio (thumb/srt/SEO) | Calendar | Analytics | Channels | Settings
      └─ typed API client + WebSocket realtime
API TIER  (Fastify/Express + better-sqlite3, modular routers)
  duas   | videos/lifecycle | render jobs | queue | sched | channels
  uploads | thumbnails | captions | seo | review | analytics | settings
  └─ auth (password + scoped API keys), CSP, rate-limit, CSRF, allowlist
WORKER TIER
  render-worker (Remotion CLI, single in-flight render, queue from SQLite)
  publish-worker (sequential uploader, quota ledger, watchdog)
  analytics-worker (scheduled YouTube read, cheap quota, trend/CTR cache)
  notify (web push / email)
DATA TIER
  SQLite (duas, videos, channels, ledgers, review, queue, jobs, analytics, settings)
  remotion/src (components, themes, vfx) unchanged
  out/ (renders), thumbs/, srt/, temp/ with capacity-aware cleanup
PYTHON SIDE (unchanged footprint)
  tts_engine, audio_mixer, metadata_generator, make_manifest, qc, srt, verified_en,
  ai_import, seo/upload helpers
```

Key migrations:
- Queue: SQLite-backed jobs table + single worker loop; restart auto-resume (fixes bug 1&2); atomic writes gone.
- Realtime: WS hub; all long ops stream job events.
- Uploads: **quota planner** — calendar-level plan across channels; enforce daily caps; expose used/remaining.
- Analytics: local cache refreshed nightly; CTR vs title/thumb heuristics; underperformer list with one-click actions (new thumb, retitle, reshare).
- Notifications: render complete / upload done / review needed / quota wpna / failure.

---

## 5. Phased Roadmap

### Phase 1 — Foundation (worst bugs first, no UX rebuild)
- Express/Fastify + SQLite migration (duas, ledgers, review into DB; export script for backup).
- Unify queue: single `render-worker`, auto-resume after restart, fix `render-selected` stall.
- Auth all endpoints incl. media; add CSP (move from inline handlers → addEventListener); password option.
- Add dashboard API + frontend unit tests (vitest), pipeline smoke tests.

### Phase 2 — Content Studio
- Thumbnail Studio: manual still pick + A/B set, reuse `upload_thumbs.py` engine.
- Captions editor: fix EN review from approve/reject-only → edit-in-place; websub ready check.
- SEO manager: tags/hashtags/description builder w/ live preview + suggestions (use `metadata.py` + CATEGORY_SEO); schedule `seo_batch.py`.
- Approval workflow: draft → QC result → EN review → approved → upload queue (hard gate replaces fly-by).

### Phase 3 — Growth Engine
- Scheduler/Calendar: auto-publish at chosen times, daily/weekly quotas per channel, `plan_playlists.py` integration.
- Analytics dashboard: views/likes/comments/CTR proxy + retention via YouTube API; per-dua performance; underperformers with recommended actions.
- Share-kit in UI (reuse `generate_share_kit.py`), playlists manager (auto from `playlist_plan_channel1.json`), A/B titles.
- Multi-channel playbooks + channel switcher (channel2 ready path to add).

### Phase 4 — Scale & Deploy
- Mobile PWA (installable, push notifications), tablet-friendly editor.
- Optional LAN/HTTPS deployment; OS keyring for secrets; backups/export/import.
- Monitoring: PM2 + request/queue gauges + crash alerts; disk space panel.
- Determinism pass: persisted master config reloads, remove `hash()` cache keys, optional seed per dua.

---

## 6. Recommended Quick Wins (pre-Phase-1, low risk)
1. Fix queue-restore auto-start (one call to `processQueue()` on boot).
2. Fix `render-selected` stall gate.
3. Atomic `queue_state.json`.
4. Merge duplicate atomic-write + `readConfigCached` helpers.
5. Gate media endpoints with token (cookie already available on same origin).
6. Kill dual render path foot-gun: native queue OR batch — enforce one.
7. Add CSP + strip HTML server-side (defense in depth).
8. Determinism: persist + reload master config; avoid global `random`/`hash()` in new code.

---

## 7. Open Decisions (need owner input)
1. **Frontend framework**: React + Tailwind (recommended, ecosystem) vs Vue vs Svelte vs keep-vanilla-with-bundler.
2. **Backend framework**: Fastify (recommended) vs Express vs NestJS (heavy).
3. **DB**: SQLite ok (recommended) vs Postgres (if going cloud multi-user).
4. **Deployment**: keep localhost vs LAN (phone access) vs cloud (HTTPS). PWA needs HTTPS or localhost.
5. **Multi-user**: solo only, or roles (editor/reviewer/admin)?
6. **Mobile priority**: phone-first UI or desktop-first with mobile support?
7. **Scope for V2.0 release**: all 4 phases, or Phase 1–2 first (foundation + studio) as V2.0 with growth in V2.1?

---

## 8. Attachments
- Dashboard audit findings (file:line) — see §2 above (source: full read of server/routes/public/UI + pipeline).
- Existing docs to reconcile into V2: `YOUTUBE_COMPLIANCE.md`, `CONTENT_POLICY.md`, `AUDIT_*`, `PROJECT_CHECKLIST.md`, `OPTIMIZATION_PLAN.md`, `README.md`.