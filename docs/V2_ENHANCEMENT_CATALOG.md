# V2.0 Enhancement Catalog — new features, tools, security, structure

Brainstorm for DuaVideoGenerator 2.0. Grouped by: new features · tools/add-ons · security · context hierarchy · logic · syntax · architecture · downloadable resources. Nothing here is committed to build yet — pick from each bucket for the roadmap.

---

## 1. New features (worth most for growth)

1. **A/B engine** — upload 2 titles or 2 thumbnails for the same video; after 48h auto-keep better CTR (needs YT thumbnail-A/B via API third-party only, so do title A/B natively + thumbnail rotation via `thumbnails.set`).
2. **Auto-scheduler + calendar** — pick daily slots; worker publishes when quota resets; respects daily caps; shows next-7-days plan.
3. **Trend radar** — nightly read of top-50 Shorts in niche categories + search suggest scraper → "topics queue" with dua suggestions.
4. **Retention diagnostics** — YouTube Analytics API (retention 24h), charts per video; auto-flag hooks <50% at 3s.
5. **Underperformer triage** — list + ranked "fix" buttons (new thumbnail, retitle, refresh description/tags, reshare to WhatsApp group via share-kit).
6. **Playlist automation** — from `playlist_plan_channel1.json` logic; auto-add new videos to right playlist; playlist description/SEO.
7. **Community desk** — reply template bank (Urdu), pinned comment builder, comment sentiment scan.
8. **Multi-language subs** — auto EN subs via existing srt → translated AR/UR/EN toggle in player (YT auto-dubs out of scope; do 3-language caption files).
9. **Clip remixer** — pick a long video → auto-cut highlight (silence/energy detection via audio_mixer) → new short.
10. **Content coverage map** — which categories have N videos each; recommend gaps (e.g. "0 raat duas for next Friday").
11. **Monetization hub** — aggregate studio "revenue/views/subs" into one page; warn on policy risks (use `YOUTUBE_COMPLIANCE.md` rules).
12. **Determinism locker** — seed per dua; re-render same dua pure; A/B style variants from same content.

## 2. Tools & add-ons (integrate, don't install)

1. **Remotion Lambda** — offload heavy renders to serverless GPU (pay-per-use) instead of local Chrome; keep local fallback.
2. **Puppeteer-backed HTML preview** — live 60fps preview scrub in-browser before render (replaces slow `thumb` calls only).
3. **ffprobe/`video_analyzer`** — capacity-aware encoder settings, HDR→SDR checks, loudness re-check after upload.
4. **Whisper (faster-whisper)** — local transcription to auto-verify TTS audio matches Arabic/Urdu text (QC for audio layer).
5. **Tesseract OCR** — sanity check rendered frames for text overflow/clipping (pixel-level QA).
6. **edge-tts voice lib + gender pools** — already used; add voice preview compare + "pick best voice per category" A/B trials.
7. **Search-suggest scraper** (Twitter/Reddit/YT autocomplete) — free trend input for roadmap 3.
8. **YouTube Analytics Data API** — retention/impressions source (read-only, cheap: `youtubeAnalytics.reports` batch).
9. **Clipboard image paste** — thumbnails/itn via browser paste → base64 → `thumbnails.set`.
10. **WaveSurfer already vendored** — keep for captions timeline editor.

## 3. Security (V2 baseline + upgrades)

1. ~~Password gate + optional TOTP 2FA~~ — **DECIDED: NOT NEEDED** (owner: portal chalta hai locally — single system, single user; login/2FA skip). Local token auth stays as-is.
2. **OS keyring** (Windows Credential Manager / `keytar`-style) for tokens & AI keys — *optional*, local-only so `.env` is acceptable.
3. **Encrypted DB** — SQLCipher for `v2.db`, *or* encrypt only secret rows (AES-GCM via existing `core/security.py`) — *optional* when local-only.
4. **Signed media URLs** — HMAC short-lived tokens for `/media/*`; auth on every endpoint — *optional* (loopback bind is main guard); low cost so keep if easy.
5. **HTTPS on LAN** — auto self-signed via `mkcert`; instruct browser trust (PWA needs HTTPS/localhost anyway).
6. **Hardened headers** — CSP (React makes this easy), HSTS, COOP/COEP on media; strip HTML server-side.
7. **Secret scanner in CI** — gitleaks on push; fail on leaked key patterns.
8. **Audit log** — every mutation (who/what/when, hash before/after) in SQLite `audit_log`.
9. **Backup rotation** — daily `v2.db` + config snapshot to `backups/`, keep N=7, checksummed.
10. **Sandboxed engines** — render/publish workers run with CPU/quota caps, disk limits, and process-group kill-scoped PIDs (avoid prod `taskkill /T /F` footgun).

## 4. Context hierarchy (data/content model)

1. **Content pillars** — top-level topics (Maut, Khof, Rizq, Ilm, Sabr, Family, Raat, Mausam) as first-class `pillar` entity; each dua/draft belongs to a pillar (reuse `playlist_plan` themes).
2. **Playbook per channel** — per-channel cadence, hashtag set, voice pref, privacy default, best-time window.
3. **Provenance chain** — source(dua) → revision(hash) → render(config + seed hash) → QC result → review → publish — stored per video (audit-able, re-render safe).
4. **Versioned content** — keeping versions of text+render config; never mutate a published dua silently.
5. **Taxonomy & glossary** — standardized Urdu/Arabic spelling glossary (e.g., "ki" vs "کی"), synonym map for dedupe.
6. **Tag/KW taxonomies** — CATEGORY_SEO becomes a DB table with per-pillar expansions + seasonal additions (Ramadan, Hajj, Friday).
7. **RBAC ready** — `users(roles)` + per-role scopes (editor/reviewer/owner) even if solo today.
8. **Content calendar as data** — `schedules` + `pillars` = "planned pipeline", not just exports.

## 5. Logic (decision engines / state machines)

1. **Quota planner** — model: budget-per-channel per-day vs planned ops; reorder tasks to fit 10k reset; DRY-RUN preview before any run (extends prod quota model to a scheduler).
2. **Render job FSM** — `queued→prep→render→qc→pass|retry(1)→done|failed`; persisted, auto-resume on boot.
3. **Publish FSM** — `approved→scheduled→uploading→live|retry` with backoff + watchdog.
4. **Semantic dedupe** — replace char-position fuzzy + Arabic Jaccard with embedding similarity (sentence-transformers, offline) for the diva duplicate check.
5. **Feature flags** — middleware toggles (dry-run, banners) without deploys.
6. **Validation chain** — schema (ajv/zod) at API edge, content-level (Arabic diacritics, Urdu word-limit 75, ref format), gate before QC.
7. **Self-healing ops** — retry-with-capped-backoff, stale-job sweeper, orphan temp cleaner, crash→resume.

## 6. Syntax / code quality

1. **Strict TS** everywhere (`noImplicitAny`, `exactOptionalPropertyTypes`); shared `packages/contracts` with zod schemas → **typed API client codegen** (openapi-typescript).
2. **Monorepo workspaces** (`apps/web`, `apps/server`, `packages/contracts`, `packages/ui`) with npm workspaces.
3. **Python side** — pyright/mypy for `core/` CLI tools; pydantic models for generate/output; keep ruff.
4. **Conventional commits + commitlint + changelog via `standard-version`**; PR template already present.
5. **Named errors / result objects** for cross-language jobs (JSON `{ok,error,code}`), no ad-hoc parse of stdout.
6. **Design tokens** — Tailwind theme mapped from current style.css tokens; dark/light.
7. **i18n ready** — label strings centralized (Urdu/Roman-Urdu/English) so UI copy isn't hardcoded per modal.

## 7. Architecture structure (target pattern)

- **Hexagonal-ish**: DB repo layer ↔ services (quota, youtube, seo, share) ↔ transport (API/WS) — workers are services too.
- **Single render path** (Remotion), Python as sidecar CLI via structured JSON argv/stdout (`make_manifest`, TTS, QC, srt).
- **Event bus in-process** (small emitter) → WS fan-out; long jobs never hold requests.
- **Data flow**: ducks design → `videos` row → worker artifacts stored by slug hash → `analytics_cache` updated by nightly worker.
- **Deployment**: pm2 for prod; V2 dev local; optional Remotion-Lambda in Phase 4.

## 8. Downloadable resources (installable/free — explicitly useful)

**Fonts (Arabic/Urdu rendering)** — Amiri, Scheherazade New, Noto Naskh Arabic, Noto Nastaliq Urdu, IBM Plex Sans Arabic; install once into `remotion/public/fonts/` (Google Fonts CDN currently — self-host for offline determinism).
**Media** — CC0 background packs: Pexels/Pixabay videos (existing `download_backgrounds.py`), Coverr, Mixkit; mosque/nature/travel per category.
**Audio** — Freesound CC0 ambience; 8D audio libs; no copyrighted nasheed.
**Tools to apt/install** — FFmpeg (have), ImageMagick (optional), Tesseract (OCR QA), `faster-whisper` (local STT), `sentence-transformers` (embeddings dedupe), `mkcert` (HTTPS).
**npm** — `@fastify/websocket`, `better-sqlite3`, `zod`, `vitest`, `esbuild/vite`, `tanstack-query`, `zustand`, `recharts`, `lucide-react`, `speakeasy` (2FA), `googleapis` (have), `keytar`/`keyring`.
**pip** — `edge-tts` (have), `fastapi`-free path (keep scripts), `cryptography` (have), `pydantic`, `opencv` (have).
**CI templates** — gitleaks job, npm+pip audit jobs (GitHub Actions, easy once V2 repo exists).
**Docs** — keep `YOUTUBE_COMPLIANCE.md`, `CONTENT_POLICY.md`; add `SECURITY_PLAYBOOK.md` + `BACKUP_RUNBOOK.md`.

---

## Suggested V2.0 scope slice (from catalog)

- **Phase 1**: foundation (SQLite, single render/publish FSM, auth-all, determinism) — from `V2_PHASE1_BRIEF.md`.
- **Phase 2 (Studio)**: thumbnail/caption/SEO editors + review-edit (feature 11, tools 10) + expiry of review gate.
- **Phase 3 (Growth)**: scheduler/calendar, trend radar, underperformer triage, playlist automation, analytics dashboard (features 2,3,5,6).
- **Phase 4 (Scale)**: Remotion Lambda, 2FA/keyring, HTTPS/LAN, PWA polish, semantic dedupe (security 2,5,6; feature 1; logic 4).

Owner picks which buckets go in each phase; defaults follow the suggested slice.