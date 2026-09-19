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

*append future decisions here (date | what | why)*