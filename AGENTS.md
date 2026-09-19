# AGENTS.md — DuaVideoGenerator V2.0 Workspace

Master record for AI sessions working in this folder (`H:\DUAGENERATOR 2.0`). Update after any significant change. Owner communicates in **Roman Urdu** — reply in Roman Urdu.

## Critical facts first

- This is the **V2.0 rebuild workspace**. The **production portal is NOT here** — it runs untouched at `H:\DuaVideoGenerator` (pm2 app `dua-studio`, port `7860`, status ONLINE). **Do NOT modify or restart it.** You may read its files for reference.
- This folder is a clean git clone of production at commit `f1fb7fc`, secrets/data excluded. `git origin` was REMOVED to prevent accidental pushes to the production repo (`https://github.com/h3lllsing/DuaVideoGenerator.git`). To push later: `git remote add origin <new-repo-url>` (owner picks repo).
- Owner confirmed stack (2026-09-20): **React + TypeScript + Vite + Tailwind** (mobile-first PWA), **Fastify** + **better-sqlite3**, WebSockets for realtime. Dev port **7870** (production uses 7860 — never collide).
- Portal is LOCKED for changes (owner directive). New code/features ONLY go in this folder.

## V2 Decisions (owner-approved)

| Area | Choice |
|---|---|
| Frontend | React + TypeScript + Vite + Tailwind CSS, mobile-first PWA |
| Backend | Node + Fastify + `better-sqlite3` |
| Realtime | WebSockets (SSE retired) |
| Data store | SQLite (single file `v2.db`); JSON only for import/export/backup |
| Render path | ONE path: Remotion `.tsx` components; Python reused for TTS/audio/metadata/QC via subprocess |
| Ports | Dev 7870; production 7860 (untouched) |
| Tests | vitest (frontend/API), keep pytest for Python CLI tools |

## Roadmap & specs

- Full audit + roadmap: `V2_AUDIT_AND_PLAN.md` (root).
- Architecture + DB schema + API design: `docs/V2_ARCHITECTURE.md`.
- New-agent onboarding (read order + gotchas): `docs/V2_ONBOARDING.md`.
- First implementation milestone (Foundation): `docs/V2_PHASE1_BRIEF.md`.

## What to reuse from the production codebase (read from `H:\DuaVideoGenerator`)

- `remotion/src/*` components (`Root.tsx`, `DuaVideo.tsx`, `ThumbCard.tsx`, `themes.ts`, VFX) — render engine.
- `remotion/scripts/*` CLI tools → retarget as worker commands: `make_shorts.py`, `make_thumbs.py`, `upload_thumbs.py`, `upload_shorts.py`, `seo_batch.py`, `attach_captions.py`, `plan_playlists.py`, `generate_share_kit.py`, `metadata.py`, `qc.py`, `youtube_auth.py`.
- `core/` Python: `tts_engine.py`, `audio_mixer.py`, `metadata_generator.py`, `quality_checker.py`, `word_highlight.py`, `master_config.py`.
- SEO data: `metadata.py` `CATEGORY_SEO` + `HASHTAG_POOL` + `build_tags`/`hashtag_line`/`build_description` (see `remotion/scripts/metadata.py:65-302`).
- Ledgers/data model prototypes: `data/upload_state_channel1.json`, `data/shorts_state_channel1.json`, `data/quota_state_ch1.json`.

## Known bugs from audit (do NOT reproduce)

- Render queue: no auto-resume after restart; `render-selected` strat-single-job stall; non-atomic queue file.
- Two parallel render systems (native queue vs python batch) collide — V2 = single worker.
- Unauthenticated media/static endpoints + no CSP + server keeps secrets plaintext.
- 3-way upload-truth divergence (status ↔ ledgers ↔ YouTube).
- Python: global `random` helper + `hash()` cache keys break determinism; `config.py` vs `master_config.py` sprawl.

## Conventions

- H shell via PowerShell (OS win32). Temp probes → `C:\Users\MASOOD~1\AppData\Local\Temp\opencode\`. Use Read tool; grep tool instead of `rg` (not installed). Non-ASCII output: `python -X utf8` or wrap stdout with `io.TextIOWrapper(..., encoding='utf-8', errors='replace')`.
- **Ask before any live YouTube write/read that costs quota** (uploads, caption inserts, thumbnails.set, videos.update, playlist writes). Reads are cheap but still confirm bulk ops.
- Never commit secrets: `data/` (token files), `.env`, `client_secret*`, `v2.db` if it ever holds tokens, `auth.json`. Keep `*.gitignore` patterns local.
- Conventional commits (matches repo history style). Update `CHANGELOG.md` and `AGENTS.md` with each milestone.
- Owner language: Roman Urdu. Docs stay in English (repo convention).