# AGENTS.md — Project Record

Master record for AI sessions on the DuaVideoGenerator project. Update this file after any significant change. Reporter (user) communicates in **Roman Urdu**; reply in Roman Urdu.

## Current State (updated 2026-09-20)

- **LOCKED**: User locked the portal on 2026-09-20 — **NO code changes, NO new features** unless explicitly asked. Working tree clean at commit `eee3bc1`.
- Pipeline for growth (share-kit, thumbnails, SEO, playlists, captions) is **built and ready**, only waiting on YouTube daily quota.
- 136 live videos (115 old + 21 shorts) on channel1. 20 of 21 shorts are **PRIVATE deliberately** (user's choice, avoids flooding); only `istikhara` (`uqe9lAC9o3Y`) is public. Do NOT change privacy unless user asks.

## Quota & Timing

- YouTube daily quota (10,000 units for writes) resets at **midnight Pacific (PT)** = **12:00 noon PKT**. Reading still works when quota exhausted; writes/token-api return `quotaExceeded` 403.
- Pending post-reset (approval first): 2 EN captions retry (100u) → 87 thumbnail uploads (4350u) → 87 SEO batch updates (4350u) ≈ 8800/10000. Playlists (~4500u) run on the **following day**.
- Channel1 OAuth token: `data/yt_token_channel1.json` (secret — NEVER commit; `data/` is gitignored).

## Key Facts

- Channel id: `UC76kpCCao-WKwgZ5tiUMl4Q` (cached in `data/channel_info.json`), subscribers ~36, no channel2 configured.
- Dashboard: pm2 app `dua-studio`, port `7860`, bearer token in `data/dashboard/auth.json` (secret). `POST /api/youtube/sync` syncs `dua_status.json` from ledgers.
- Ledgers: `data/upload_state_channel1.json` (87 entries: 68 longs + 19 shorts-tagged), `data/shorts_state_channel1.json` (21 shorts). Private/public privacy field in ledgers is NOT reliable — verify with live API.
- Shorts EN captions: 15/21 attached live; 2 quota-blocked (`sakht_musibat_mein_sabr_ki_dua`, `samundari_sarkash_hawaon_se_panah`); 4 no approved EN review (`barish_ki_dua`, `sachai_aur_imandari_ki_dua`, `ilm_aur_pakiza_rizq_ki_dua`, `khiyanat_se_bachne_ki_dua`) — decision: approve or skip, user to confirm.
- Thumbnails: 87 rendered (`remotion/out/thumbs/<dua_id>.png`), state in `data/thumbs_state_channel1.json` (video_id + thumb map). `upload_thumbs.py` + `seo_batch.py` have `--dry-run` / `--only`.
- Share kit: `share_kit/` (87 WhatsApp texts + `INDEX.md`) — done, committed.
- Playlist plan: `data/playlist_plan_channel1.json` — 9 playlists (nafs/khof/rizq/ilm/sabr/family/raat/mausam/other) via `plan_playlists.py`.

## Commands / Scripts (all from repo root or as noted)

- Thumbs render: `python remotion/scripts/make_thumbs.py` (remotion CLI must run with cwd=REMOTION; props must be wrapped `{"data": {...}}`)
- Upload thumbs: `python remotion/scripts/upload_thumbs.py [--dry-run|--only id1,id2]`
- SEO batch: `python remotion/scripts/seo_batch.py [--dry-run|--only ...]`
- EN captions: `python remotion/scripts/attach_captions.py --only sakht_musibat_mein_sabr_ki_dua,samundari_sarkash_hawaon_se_panah`
- Privacy rollout: `python remotion/scripts/fix_short_privacy.py --limit N`
- Share kit: `python remotion/scripts/generate_share_kit.py`
- Playlist plan: `python remotion/scripts/plan_playlists.py`

## Working Conventions

- H shell via PowerShell `bash` (OS win32). Write temp probe scripts to `C:\Users\MASOOD~1\AppData\Local\Temp\opencode\`; prefer reading files with the Read tool; use grep tool instead of `rg` (not installed). Handle non-ASCII output with `python -X utf8` or `io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')`.
- **Rule: ask before any write/upload to YouTube** — never assume. Get explicit go before running quota-costing operations.
- Never commit secrets: `data/`, tokens, `ai_api_config.json`, dashboard auth, `client_secret*` are gitignored.
- Repo remote: `https://github.com/h3lllsing/DuaVideoGenerator.git` (branch `main`). Commit only when user asks; match conventional-commit style in CHANGELOG/history.