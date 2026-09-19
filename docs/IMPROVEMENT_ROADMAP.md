# IMPROVEMENT ROADMAP — DuaVideoGenerator V2.0
*Generated 2026-09-20 §9 mandate — analysis-first, code-evidence grounded, free-only, local-only.*

## 1. Visual/video output
- **Kamzor** (render.js:1039-1042) — `render-selected` append stalls jab tak koi single job run raha ho; `processQueue()` kabhi call nahi hota (Aud 2.2).  
- **Achha** — Remotion components (`DuaVideo.tsx`, `ThumbCard.tsx`, `themes.ts`, `vfx/validate.ts`) quality solid; reusable.  
- **Improve** — Single render worker design: `jobs` DB table main state store karo; har boot par `pending/running` jobs auto-resume karo; `render-selected` gate remove karo Sirf `processQueue()` ko chalo. Themes/VFX ko `themes.ts` men free-add karo bina paid resources key kiye.  
- **Constraints** — Free: Remotion CLI, open-source themes. Local: koi paid Lambda/render farm nahi.

## 2. Audio
- **Kamzor** (core/tts_engine.py, core/audio_mixer.py) — global `random` aur `hash()` cache keys determinism kharab (Aud 2.4); voice-pick logic criteria document nahi.  
- **Achha** — edge-tts already integrated; `master_config.py` Master Randomizer seed farokht.  
- **Improve** — per-dua seed lena: `random.Random(seed)` assign karo DB main; `qc.py` loudnorm pass shamil karo; voice selection criteria ko `master_config.py` men centralize karo.  
- **Constraints** — Free: faster-whisper local, edge-tts. Local: koi paid voice‑marketplace, paid TTS SDK nahi.

## 3. Content/data
- **Kamzor** (duas.json 114, audit 2.6) — duplicate prevention: exact/fuzzy 90% + Arabic Jaccard 0.85 lekin implementation render.js main adhuri; koi centralized DB unique check nahi (Aud 2.6).  
- **Achha** — source reference every dua ke sath (hadith collection + reference) rakha gaya hai; Content Policy clear guidelines.  
- **Improve** — SQLite `duas` table men unique constraint (slug + source); `review` table men edit-in-place (approve/reject bas nahi, balki text edit karo); provenance chain DB men (source → revision hash → render config → QC → review → publish).  
- **Constraints** — Free: SQL constraints, DB migrations. Local: koi external AI generation service nahi (V2 men free-only).

## 4. Pipeline/performance
- **Kamzor** (render.js dual paths, Aud 2.3.1) — JS queue + Python batch concurrent chillate hain; resource-thrash; koi auto-resume after restart nahi (Aud 1.1–1.3).  
- **Achha** — `remotion/scripts/*` CLI tools (make_manifest.py, qc.py, make_shorts.py) single-purpose, solid.  
- **Improve** — Single render worker: `jobs` table men queue, one-at-a-time; Python batch ko workers/main.py men shift karo; har job ka progress DB main track karo; caching: unchanged dua = serve from cache, not re-render.  
- **Constraints** — Free: Remotion CLI, ffmpeg local. Local: koi paid cloud render (Lambda, etc. excluded).

## 5. Data model/storage
- **Kamzor** (Aud 2.6, 2.7) — JSON ledgers (upload_state, shorts_state, en_review, quota_state) alag alag; koi single source of truth; forward-only dua_status.json lekin ledgers drift dete hain (Aud 2.5).  
- **Achha** — QC gate, quota watchdog, atomic writes (.tmp+rename), per-channel caps, forward-only statuses.  
- **Improve** — Migration script (import_legacy.js) jo `duas.json` + ledgers + review ko SQLite `duas`, `videos`, `ledger_entries`, `review` tables men bulk import karen; backup/restore runbook: daily `v2.db` snapshot ba checksum; `data/` men retention 7 din, checksummed.  
- **Constraints** — Free: SQLite, json imports self-hosted. Local: koi paid cloud DB (Supabase only if free tier).

## 6. Backend/API
- **Kamzor** (server/routes/* audit 2.3) — dual render/queue systems collide; media endpoints unauthenticated (Aud 2.4.1); rate-limit bas POST par, GET unlimited (Aud 2.4.2); secrets plaintext (config.py, master_config.py, auth.json) (Aud 2.4.3).  
- **Achha** — token auth (bearer only), timingSafeEqual compare, origin allowlist, POST rate-limit 30req/2s/IP, 1MB body cap, consistent `{ok:false,error}` contract.  
- **Improve** — Auth on **every** endpoint, including media (`/media/*` signed token or cookie); CSP header server-side; HTML stripping defense-in-depth; rate-limit all `/api` endpoints (including GET); secrets env vars only, never in git; `timingSafeEqual` password comparison; audit log in SQLite `audit_log` table.  
- **Constraints** — Free: no paid auth services; local token generation; no password/2FA (owner decision, local-only).

## 7. Frontend/UI-UX
- **Kamzor** (app.js:2443 lines, audit 2.2) — koi framework nahi (vanilla JS), koi test nahi, no CSP, hardcoded UI copy mixes Urdu/Roman Urdu, custom modals bazay `<dialog>`, keyboard navigation alag, single status typo (app.js:538), no empty/error states polish grid.  
- **Achha** — dark theme tokens; responsive grid 5\'1; mobile hamburger drawer; reduced-motion + focus-visible; escaping consistent (`escHtml`).  
- **Improve** — React + TS + Vite + Tailwind (per V2_DECISIONS); vitest unit tests; CSP header add karo; `dialog` element use karo; keyboard shortcuts aloo; i18n ready strings (Urdu/Roman Urdu/English); empty/error states grid; PWA manifest + SW (later).  
- **Constraints** — Free: Vite, React, Tailwind CDN; local assets only; koi paid UI component library.

## 8. Security
- **Kamzor** (Aud 2.4) — media endpoints unauthenticated (`/video/*`, `/thumb/*`, `/audio/*`, `/temp/*`, `/preview/*`, `/vfx-preview/*`); no CSP; secrets plaintext on disk; GET /api unlimited rate; `Set-Cookie` issued on plain GET /.  
- **Achha** — token auth + timingSafeEqual, HttpOnly SameSite cookie, origin whitelist, POST rate limit, traversal guards, spawn arg arrays, security headers.  
- **Improve** — Auth on **every** endpoint including media; CSP header (default-src 'self'; style-src 'self'; img-src 'self' data:); HTML strip server-side (defense in depth with React escaping); rate-limit all `/api` (GET aur POST dono); secrets env vars or OS keyring, never commit; `timingSafeEqual` compare; audit log har mutation k liye (who/what/when, hash before/after) in SQLite; backup rotation daily `v2.db` + config snapshot to `backups/`, keep N=7, checksummed; sandboxed workers with CPU/quota caps, disk limits.  
- **Constraints** — Free: no paid security services; local token auth only; no password/2FA (owner: local-only); OS keyring optional; mkcert for HTTPS/LAN optional.

## 9. Operations/automation
- **Kamzor** (Aud 2.7) — no scheduling/cadence, no disk-space view, no failure notifications, no analytics beyond basic view counts; no auto-resume after restart (queue stall).  
- **Achha** — PM2 fork (1 instance, 512MB heap), autostart VBS, crash log rotation, 6h temp cleanup, daily cap 10 uploads + 9000 quota units, 10-min upload watchdog, 5-min auth watchdog, rate-limit cooldown.  
- **Improve** — Scheduler/calendar: auto-publish at chosen times, daily/weekly quotas per channel, respect quota ledger; monitoring: PM2 + job/queue gauges + crash alerts + disk-space panel; notifications: render complete / upload done / review needed / quota warning / failure; self-healing: retry-with-capped-backoff, stale-job sweeper, orphan temp cleaner, crash-resume; daily `v2.db` + config snapshot ba checksum; backup rotation N=7; deterministic renders: persisted master config reloads, remove `hash()` cache keys, seeded per-dua renders.  
- **Constraints** — Free: PM2 open-source, local monitoring; no paid cloud monitoring; backups local disk only.

---
**Registration**: This roadmap is registered in `H:\DUAGENERATOR 2.0\docs\IMPROVEMENT_ROADMAP.md` and will be committed to git after owner approval.  
**Mandate §9**: Code se pehle roadmap bani; owner ne approve kiya; tab Phase-1 shuru.