# V2 Onboarding — read this first (new agent)

This folder = the V2.0 rebuild of the Dua Video Studio portal. Production still runs at `H:\DuaVideoGenerator` (port 7860, pm2 `dua-studio`) and must stay untouched.

## Read order (≈30 min)

1. `AGENTS.md` (this workspace rules + owner decisions)
2. `V2_AUDIT_AND_PLAN.md` (full audit findings + roadmap + open questions)
3. `docs/V2_ARCHITECTURE.md` (chosen stack, DB schema, API, workers)
4. `docs/V2_PHASE1_BRIEF.md` (current milestone tasks)
5. Reference only (do not edit): prod `H:\DuaVideoGenerator\remotion\src`, `remotion\scripts\metadata.py`, `core\` TTS/audio/QC modules

## Key gotchas when working here

- **Never** run `git push` from this folder until an origin is re-added (it was removed to shield prod). Ask owner for the new repo.
- **Never** touch `H:\DuaVideoGenerator`. Read-only reference.
- **Port 7860 is taken** by prod. Use 7870 for V2 dev; configure Vite + Fastify accordingly.
- YouTube quota resets **midnight PT = 12:00 noon PKT**. Test uploads only in dry-run or after confirming quota. Always ask owner before live writes.
- Python CLI scripts must run with correct cwd (e.g. Remotion CLI from `remotion/`), and Remotion props must be wrapped `{"data": {...}}` (see prod `make_thumbs.py`).
- Non-ASCII (Urdu/Arabic): set `PYTHONUTF8=1` or wrap stdout; use Read tool for files, grep tool for searches (`rg` not installed).
- Keep docs/AGENTS/CHANGELOG updated each milestone. Commits = conventional style.

## Environment setup (one-time)

```powershell
cd "H:\DUAGENERATOR 2.0"
py -m venv .venv ; .venv\Scripts\Activate.ps1
pip install -r requirements.txt
cd remotion ; npm install ; cd ..
# V2 apps:
cd apps/web   ; npm install ; cd ../..
cd apps/server; npm install ; cd ../..
```
(npm installs not yet run — do at first code scaffold.)

## Definitions (same names as prod)

- `duas.json` → dua library (Arabic+Urdu; EN now required for every dua)
- `upload_state_channel1.json` / `shorts_state_channel1.json` → legacy ledgers (imports into SQLite)
- `en_review.json` → approved/rejected EN subtitles
- `CATEGORY_SEO` / `HASHTAG_POOL` (metadata.py) → tags & hashtags engine to reuse
- Channel1 id `UC76kpCCao-WKwgZ5tiUMl4Q`; 20/21 shorts intentionally PRIVATE; do not flip without owner