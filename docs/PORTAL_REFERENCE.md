# Portal Reference — the CURRENT production system (read before V2 builds)

Complete operating reference of `H:\DuaVideoGenerator` (production, port 7860, pm2 app `dua-studio`). V2 agents: PORT this behavior; do NOT reinvent it. Anything marked (PORT) must be replicated/kept in V2.

---

## 1. System map

```
duas.json (114) ──► dashboard (server.js @127.0.0.1:7860) ──► render.js
                        │  render flow: prepare_dua.py (TTS+merge)
                        │                → make_manifest.py (remotion/src/data/<id>.json)
                        │                → Remotion CLI (cwd=remotion) → mp4
                        │                → ffmpeg BT.709 tag + faststart
                        │                → qc.py (1 auto-retry)
                        │                → make_thumbs.py / make_srt.py / metadata.py
                        ├─► upload.py / upload_shorts.py (ledger + quota guard)
                        ├─► youtube.js (per-channel ledger, 10/day cap, 9000 quota cap)
                        └─► status_store.js (dua_status.json, forward-only)
Python CLI (core/ + remotion/scripts/) — headless ops: seo_batch, upload_thumbs,
attach_captions, plan_playlists, generate_share_kit, verified_en, youtube_sync/stats
```

## 2. Data files & exact schemas — (PORT into SQLite)

| File | Type | Shape |
|---|---|---|
| `duas.json` | list[114] | `{id, category, title, arabic, urdu, explanation, reference, voice_arabic, voice_urdu, template, bismillah, duration}` (+ NEW: `title_en, english` after EN/UR/AR import fix) |
| `upload_state_channel1.json` | dict[87] | `dua_id → {status:"uploaded", video_id, privacy, locked, units_spent, uploaded_at}` |
| `shorts_state_channel1.json` | dict[21] | `dua_id → {shortHref, title, duration, sizeMB, video_id, privacy, uploaded_at}` |
| `en_review.json` | dict[28] (+`_comment`) | `dua_id → {status:pending|approved|rejected, ref, ar, en}` |
| `quota_state_channel1.json` | dict[24] | `YYYY-MM-DD → units_used` (log 2026-08-23→2026-09-19, 3200–8000) |
| `dua_status.json` | dict | `dua_id → {status: not_started|rendered|uploaded, uploaded_channels: {ch:...}}` |
| `channel_info.json` | dict | channel metadata cache (id `UC76kpCCao-WKwgZ5tiUMl4Q`, subs 36) |
| `custom_vfx.json`, `verified_en.json`, `trash/`, `upload_log.txt` | ... | aux stores |

Ledgers = **run-of-record**; `privacy` field unreliable (20 shorts actually private). (PORT: ledgers → `ledger_entries`; en_review → `review`; quota_state → daily quota rows.)

## 3. API surface (production, ~45 endpoints) — (PORT/improve)

- **duas.js**: `GET /api/duas` · `POST add-dua|update-dua|delete-dua|undo-delete-dua` · `GET /api/trash` · `POST /api/trash/restore/:id` · `GET/POST /api/ai-config` · `POST /api/ai-import|ai-fill-metadata|ai-format`
- **render.js**: `POST /api/render` (single) · `render-selected` (additive queue) · `render-all` · `GET /api/status` · `GET /api/status/stream` (SSE) · `POST /api/cancel` · `voice-only` · `voice-preview` · `tts-custom` · `thumbs-all` · `GET /api/history` · media `GET /video/* /thumb/* /audio/* /temp/* /preview/*`
- **youtube.js**: `GET /api/youtube/status` · `POST settings|secret|auth|auth-cancel` · `upload` · `yt-cancel` · `GET uploaded` · `POST sync` · `GET stats` · `POST update|re-upload`
- **batch.js**: `POST /api/batch/start|status|cancel` (python batch_render.py bridge)
- **vfx.js**: `GET /api/vfx/list` · `POST import|preview` · `GET/POST /api/vfx/weights`
- **review.js**: `GET /api/en-review/list` · `POST /api/en-review/:duaId/approve|reject`
- **config.js**: `GET/POST /api/config` (whitelisted keys: stylePreset/artFx/skyFx/borderFx/lookMode)
- Auth: bearer token / HttpOnly SameSite cookie; rate limit 30 POST / 2s / IP; origin allowlist localhost; 1MB body cap; `{ok:false,error}` contract.

## 4. Script catalog (remotion/scripts/*) — (PORT into V2 workers/commands)

| Script | Purpose | Flags |
|---|---|---|
| `metadata.py` | title/desc/tags/hashtags sidecar `<Title>.txt` | (arg: dua_id) |
| `prepare_dua.py` | TTS (Arabic+Urdu edge-tts) + audio merge → temp artifacts + timings | — |
| `make_manifest.py` | duas.json + TTS sidecars → `remotion/src/data/<id>.json` | — |
| `make_shorts.py` | prepared vertical Shorts mp4 cut from rendered videos (≤58s) | `--dry-run --force --only` |
| `upload_shorts.py` | upload Shorts, ledger+privacy | `--dry-run --only --privacy` |
| `upload.py` | upload videos, ledger, caps, dry-run | `--auto --category-id --dry-run --ledger --limit --live --only --privacy --token` |
| `make_thumbs.py` | still thumbnails via `thumbnail-card` props (wrapped `{"data":...}`) | `--dry-run --only` |
| `upload_thumbs.py` | `thumbnails.set` from `thumbs_state_channel1.json` | `--dry-run --no-skip --only` |
| `seo_batch.py` | videos.update tags/desc refresh all | `--dry-run --only` |
| `attach_captions.py` | insert EN `.vtt` captions (approved only, gated) | `--all --channel --dry-run --gated --no-skip --only` |
| `fix_short_privacy.py` | set shorts public (quota-gated) | `--dry-run --limit` |
| `plan_playlists.py` | builds `playlist_plan_channel1.json` (9 themes) | — |
| `generate_share_kit.py` | WhatsApp texts → `share_kit/` (87) | — |
| `verified_en.py` | authoritative EN translations (reference-driven) | `--build-all --cooldown-hours --dua-id --force --limit` |
| `make_srt.py` | SRT from manifest timings; feeds verified_en queue | `--data --dua-id --no-en --out` |
| `ai_import.py` / `ai_fill_metadata.py` / `ai_format_dua.py` | AI dua gen/fill/format (aihubmix; EN/UR/AR enforced) | count/topic/category, title, text |
| `qc.py` | duration≥5s, brightness, variance, resolution, fps; exit code | — |
| `regen_all_voices.py` / `reprocess_audio.py` | full voice regen / remaster pass | — |
| `download_backgrounds.py` | Pexels portrait backgrounds per category | `--category --key --per-category --videos...` |
| `tts_custom.py` / `voice_preview.py` | custom mastered TTS / 3s preview | — |
| `update_metadata.py` | in-place title/tags update | `--channel --video-id --title --tags` |
| `youtube_auth.py` | OAuth desktop flow (token file per channel) | `status/refresh/clean` |
| `youtube_stats.py` / `youtube_sync.py` | stats fetch / channel-sync | `--ids --channel --token` |
| `batch_render.py` | Python batch bridge for dashboard | (stdin JSON) |

## 5. Remotion render path — (PORT, keep props contract)

- Entry: `remotion.config.ts`; **CLI must run with cwd=`remotion/`** else "No entry point specified".
- Compositions auto-built from `remotion/src/data/*.json` manifest files (`Root.tsx`, `require.context('./data', /\.json$/)`); composition id = `duaId.replace(/_/g,'-')`.
- `DuaVideo.tsx`: `INTRO_FRAMES=66`, `END_FRAMES=74`, TARGET_FPS=30; duration = ceil(totalDuration*30)+INTRO+END-14.
- `ThumbCard.tsx` props = `{data: DuaManifest}` ONLY. **Unwrapped props silently render composition default → identical thumbs (B5206BE1...897 hash).** Manifest fields: `dua_id, width, height, totalDuration, arabicWords[{t,start,end,...}], urduWords, template, ...` (see `src/types.ts`).
- Style: `themes.ts` (getTheme), `stylePresets.ts` (AURORA blobs, ParticleStyle, PaperTreatment), VFX layers (`ArtFx/SkyFx/BorderFx/FrameStyles/LookVariants`), `vfx/validate.ts`.
- Fonts via `@remotion/fonts` (`ensureFonts()`); external Google Fonts currently.

## 6. Render + upload pipeline (exact order) — (PORT as single-worker FSM)

1. `prepare_dua.py` (TTS + merge; Bismillah prepend; temp: `<id>_ar.mp3, _ur.mp3, _ar_timing.jsonl, _ur_timing.jsonl`)
2. `make_manifest.py` → `remotion/src/data/<id>.json`
3. Remotion CLI render → mp4 (CHROME); ffmpeg → BT.709 + faststart
4. `qc.py` (auto 1 retry) → thumbs → srt → metadata
5. `upload.py`/`upload_shorts.py` or dashboard `/api/youtube/upload`:
   - caps: **10 uploads/day, 9000 quota/day** (ledger), watchdog 10 min
   - dedupe: field exact/fuzzy≥90% + per-channel ledger + Arabic Jaccard≥0.85
   - quota reset: **midnight PT = 12:00 noon PKT**
6. `status_store.setUploadedBatch` → dua_status.json forward-only (`not_started→rendered→uploaded`).

## 7. SEO engine (metadata.py) — (PORT; source of tags/hashtags/desc)

- Title: `<Urdu Title> | <Reference>` (≤100)
- Description: opener → arabic → urdu → explanation → ref box → CTA → footer → hashtags → disclaimer (≤MAX_DESC)
- Tags: `build_tags()` = ref book names + `CATEGORY_SEO[category]`(en/roman/ur) + title content-words + BASE_TAGS_EN + URDU_GENERIC_TAGS
- Hashtags: `#Shorts` + category hash (`#Hifazat` etc.) + `#TitleWords` + 2 from pool (`#IslamicShorts #DailyDua #Sunnah #MuslimTikTok #QuranRecitation #PeacefulReminder #DuaForYou #IslamicReminder #Allah #Muslim`), deterministic via `Rot(dua_id)`.
- `CATEGORY_SEO` has 18 categories; `general` fallback. **Note:** 43 duas are `general` (maut/qabr/akhirat themes get generic tags — a V2 opportunity).

## 8. Config layers — (PORT: consolidate!)

- `config.py` (root) — legacy settings (TTS voices, durations, themes) — **drifted**
- `core/master_config.py` — Master Randomizer (`UltraConfig`): persists to `master_config.json`; helpers use **global `random`** (non-deterministic unless reloaded) — fix in V2
- `remotion/dashboard/config.json` — dashboard settings (whitelisted keys)
- `remotion/remotion.config.ts` — renderer settings
- Voices: `ar-SA-HamedNeural`, `ur-PK-AsadNeural` (edge-tts); gender pools in `tts_engine.py` (`pick_voice`).

## 9. Published-state facts (2026-09-20)

- Channel1: `UC76kpCCao-WKwgZ5tiUMl4Q`, ~36 subs, **136 live videos** (115 longs + 21 shorts).
- **20 of 21 shorts PRIVATE** (owner choice, intentional); istikhara (`uqe9lAC9o3Y`) public.
- EN captions: 15/21 attached; 2 quota-blocked (`sakht_musibat_mein_sabr_ki_dua`, `samundari_sarkash_hawaon_se_panah`); 4 without approved review (`barish_ki_dua`, `sachai_aur_imandari_ki_dua`, `ilm_aur_pakiza_rizq_ki_dua`, `khiyanat_se_bachne_ki_dua`).
- Thumbs: 87 rendered (`remotion/out/thumbs/<id>.png`).
- Share kit: 87 files; playlist plan: 9 themes.

## 10. Known prod bugs V2 MUST fix (from V2_AUDIT_AND_PLAN.md §2.3)

1. Queue restored after restart never auto-starts (`render.js:56-68`).
2. `render-selected` append stalls while single job runs (`render.js:1039-1042`).
3. `queue_state.json` non-atomic write (`render.js:27-36`).
4. Dual render paths (JS queue + python batch) collide — V2 = **one worker**.
5. Media/static endpoints unauthenticated; no CSP; server never strips HTML.
6. 3-way upload truth (status↔ledgers↔YouTube) drifts — V2 = DB single truth.
7. AI endpoints parse "last stdout line" (fragile) — V2 = structured JSON contract.
8. `taskkill /T /F` cancel footgun; `open-folder` spawns explorer.
9. Crash handler logs but doesn't exit.
10. Determinism leaks: global `random`, `hash()` cache keys, random Pexels.

## 11. V2 porting checklist (nothing lost in migration)

- [ ] duas.json (114) → `duas` table (+ pillar, source, versions)
- [ ] upload_state/shorts_state → `ledger_entries` + `videos`
- [ ] en_review → `review` table with edit-in-place (not just approve/reject)
- [ ] quota_state → per-channel daily quota rows + planner
- [ ] dua_status (forward-only) → `videos.state` + `status_history`
- [ ] Remotion comps + manifest contract → unchanged (reuse `remotion/src`)
- [ ] metadata.py SEO engine → service (tags/hashtags/desc builder) + CATEGORY_SEO table upgrade
- [ ] 29 CLI scripts → worker/task commands (structured JSON i/o)
- [ ] Auth: keep token/cookie, drop password/2FA (local-only), add auth on media + CSP
- [ ] Keep: QC gate, quotas, watchdog, dedupe, trash/soft-delete, atomic writes
- [ ] Deviations from prod: single queue worker, DB truth, WS realtime, deterministic renders