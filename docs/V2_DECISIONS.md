# V2 Decisions Log — every owner decision (append-only)

New agents: read this so you never re-ask. Format: `DATE | Decision | Detail`.

| Date | Decision | Detail |
|---|---|---|
| 2026-09-20 | Build in a separate folder | V2 workspace = `H:\DUAGENERATOR 2.0`; production `H:\DuaVideoGenerator` (port 7860) stays running, untouched. |
| 2026-09-20 | Lock prod | No code changes / new features on production portal. |
| 2026-09-20 | Frontend | React + TypeScript + Vite + Tailwind (mobile-first PWA), recommended choice. |
| 2026-09-20 | Backend | Fastify + better-sqlite3 (SQLite single file `v2.db`), WebSockets realtime, recommended choice. |
| 2026-09-20 | Dev port | 7870 (never collide with prod 7860). |
| 2026-09-20 | Render path | One path: Remotion only; Python (TTS/audio/metadata/QC) via subprocess. |
| 2026-09-20 | Free-only policy | **NO paid services/tools anywhere**; Remotion Lambda (paid) explicitly excluded; renders stay local. Existing paid AI import (aihubmix) stays until owner switches to a free tier. |
| 2026-09-20 | Security scope | **Password + 2FA NOT needed** (local single-system); token auth kept; keyring/SQLCipher/signed-media marked optional. |
| 2026-09-20 | Quality bar | V2 must be better than current portal in every way (speed/reliability/UX/security/maintainability) — "Better than prod har hal me". |
| 2026-09-20 | Agent readiness | Complete docs required so a fresh chat has full planning + goals + prod reference (this repo). Build happens in a NEW chat, not the planning chat. |
| 2026-09-20 | GitHub remote | V2 folder has NO remote (removed for safety). New repo + push only on owner request. |
| 2026-09-20 | No backups | Owner: "back up nahi chahiye". Drop the Phase 4 Daily-Backups item (SQLite snapshot, retention, restore runbook). Data safety still = nothing lost in migration + verify-by-recount. |
| 2026-09-20 | Old portal must NEVER go down | Owner: "H:\DuaVideoGenerator yeh old wala band nahi kerna, is ko kuch nahi hona chahiye". Running it is OK to resume (PM2 `dua-studio` on :7860), but NO work in V2 may stop it. PM2 coexistence rules: NEVER `pm2 kill`, `pm2 delete all`, `pm2 stop all`, or `pm2 save` in a way that would drop/overwrite the `dua-studio` process (dump.pm2 backs up to `data/dump_pm2_duastudio_backup.json`; single restore source of truth). V2 runs on manual/tsx processes (or separate PM2 apps ONLY if `dua-studio` stays loaded and dump is preserved). If the portal dies, restore with `pm2 resurrect` and verify http://127.0.0.1:7860 → 200. |
| 2026-09-20 | Old portal system integrity (READ-ONLY) | Owner: "old portal ka system b break na ho kisi surat me; videos jaise ban rahi thi waise hi bani chahiye". Prod folder (`H:\DuaVideoGenerator`) is **READ-ONLY** for V2 work: no writes, no installs (`npm install`/`pip`) inside it, no global deps changed, no shared mutable state, no `npm rebuild`. V2 renders use V2's own asset copies only — never point V2 workers at prod's live data/out/vo thresholds. Health = `scripts/check_prod_portal.ps1` (port 7860 + pm2 dua-studio online + out.log fresh). |

*append future decisions here (date | what | why)*