# V2 Master Requirements — Everything Needed (gathered 2026-09-20)

Consolidated backlog across frontend, backend, pipeline and — critically — a NEW visual identity.
Owner directive: "saray angle dekh le... same wahe videos nahe chaheye jo old portal bana raha hai... jo chaheye jama ker le."

Reference: `V2_NATIVE_ENGINE_BLUEPRINT.md` (technical engine), `V2_ENHANCEMENT_CATALOG.md` (feature buckets),
`V2_GOALS.md` (mission/KPIs), audit of old portal `H:\DuaVideoGenerator` vs V2 (2026-09-20, both read-only).

> **RESEARCH UPDATE (2026-09-20):** see `V2_NEXTLEVEL_PLAN.md` for the deep-dive. Two corrections to anything
> written earlier about encoding: GPU is **AMD RX590 GME (Polaris)** → final encode = **libx264 CRF 18**,
> AMF (`h264_amf`) = preview tier only; rendering acceleration via Chromium ANGLE/D3D11. Remotion license
> confirmed **free for individual/≤3-employee org**; Rive excluded (paid export); XTTS/F5 excluded (non-commercial
> weights); Chatterbox v3 (MIT) optional experiment only.

---

## 1. Reality check — why "same videos" happens today

Read-only audit proves V2's render stack is a **visual port of the old portal**: identical 11 themes, same gold
palette (`#dcb93f` etc.), same starfield/aurora/godrays/ornaments, same `INTRO_FRAMES 66 / END_FRAMES 74`, same
Arabic/Urdu font set (Amiri Quran / Noto Nastaliq Urdu / Scheherazade New), same 15 AUTO_PRESETS + masterpiece
resolution order, same karaoke pill style, same default "dark" template. So V2 produces near-identical videos to
prod, and the pipeline still orchestrates through the old python script chain. **That is what must change.**

Old portal already has (do NOT re-invent; beat them): deterministic seeds, category theme rotation, voice pools,
BT.709 tags, −14 LUFS 2-pass linear loudnorm, QC gates, VFX studio (459 entries), AI dua import, English-review
gate, batch manager, YT manager 2-ch + quota ledger + dry-run, 854 approved backgrounds.

V2 already has (keep): Fastify+SQLite API, single render worker + auto-resume, publish worker + executor, scheduler
+ quota, analytics/topics/playlists, review/captions/thumb/SEO editors, PWA, monitoring, audio/timing sidecars.

## 2. The NEW visual identity (the differentiator)

Deliberate opposite of the old "dark-gold luxury mosaic" language. Two directions, owner picks one:

### Direction A — "Luminous Modern" (recommended)
- **Palette (new default themes):** deep ink base `#0B1220` + ambient violet-blue light `#6C8CFF` + warm ivory text
  `#F7F3E9`; accent gold reduced to a thin line, never the face. 6 new themes replacing the default rotation
  (currently manuscript/dark/royal/emerald): `luminous`, `dusk`, `frost`, `sage`, `plum`, `parchment-light`.
- **Layout:** typographic-first — generous whitespace, centered single-line Arabic emphasis, ornaments cut to ≈20%
  of current density (kill starfield/aurora/godrays defaults; keep at most one subtle motif).
- **Motion:** slow ambient drift + spring entrance + `@remotion/transitions` crossfades between Intro → Arabic →
  Urdu → Endcard (old = hard cuts). No sparkle bursts by default.
- **Karaoke:** TikTok-style **page captions** via `@remotion/captions` with word highlight (from manifest
  `arabicWords`/`urduWords` `{t,start,end}`). Visibly different from old full-line pill karaoke.
- **Backgrounds:** live `OffthreadVideo` motion loops (AI pack + stock) with soft blur + scrim gradient —
  replaces static poster feel.
- **Typography:** Arabic stays Quranic-correct (Amiri Quran / Scheherazade New, full harakat). Urdu switches from
  Noto Nastaliq (old signature) to clean **Noto Naskh Arabic** style weights (400/700) for an editorial look;
  Nastaliq optional as headline-only mode.

### Direction B — "Editorial Paper & Ink"
- Warm parchment base, ink Arabic, manuscript-adjacent but flat/minimal: thick rules, drop caps, no glow or VFX.
- Reads scholarly/serene; strongest contrast to any other dua channel; simple to render fast (low GPU cost).

**Common invariants (both):** determinism (seeded), RTL correctness, harakat-preserving Arabic fonts self-hosted,
BT.709 tags, −14 LUFS, our QC gates, ≥4.5:1 text contrast.

## 3. Pipeline / engine (from blueprint — summarized)

1. **Native TS engine** in `apps/server/src/engine/*`: audio (TTS-only python), manifest, reel (`renderMedia`
   bundle-once), thumbs (`renderStill`), encode (master CRF18 SW / 8M NVENC + loudnorm + fast-preview), qc
   (ffprobe), meta. Kill the 6 legacy `execSync` stages.
2. **NVENC path:** `hardwareAcceleration:'if-possible'` + `videoBitrate:'8M'` ONLY (no `crf` together); verify each
   render's `encoder` tag via ffprobe. Settings keys: `use_hardware_acceleration`, `remotion_concurrency`.
3. **Compositions:** dynamic comp + `inputProps:{data}`; karaoke pages, transitions, new themes integrated;
   `thumbnail-card` restyled to new identity.
4. **Publish:** `yt.ts` native googleapis uploader (Phase 2) replacing copied `upload.py`; keep executor contract.
5. Keep TTS exactly as-is (voice pools + `voice_prosody.json` + WordBoundary sidecars) — owner: "TTS sahe hai".

## 4. Frontend additions (beyond existing 11 pages)

1. **Look & Sound Studio page** — pick visual direction theme per dua/category; preview still; NVENC/quality toggles
   (writes settings keys).
2. **Background Manager** — shows library partition (AI pack vs Pexels vs Pixabay), license receipts per clip,
   "generate background pack" checklists + import (drag & drop → `assets/backgrounds_v2/` + registry + receipt JSON).
3. **Karaoke caption preview** — scrub view of TikTok pages before render (reuses vendored WaveSurfer + timing data).
4. Small polish: monitoring panel already exists; add `resolvedConcurrency`/encoder used per render.

## 5. Backend/settings additions

- settings keys: `use_hardware_acceleration`, `remotion_concurrency`, `v2_upload_privacy`, `upload_live`,
  `tts_voice_ar`, `tts_voice_ur`, `visual_direction`.
- New tables/artifacts: `backgrounds` (asset registry in DB), `background_license_receipts`, per-render
  `render_telemetry` (concurrency, encoder, time, size).
- Audit-log every mutation (already exists — extend coverage).

## 6. Phased delivery (merge of blueprint phases + this identity)

- **Phase A — Identity + Engine (this sprint):** native engine modules; dynamic composition + inputProps; new themes
  (Direction A or B); karaoke pages + transitions; thumbs restyle; NVENC/bitrate controls; settings keys;
  safe probe render on one dua with `_v2` output prefix. Success = visibly different, QC-passing, <60s render.
- **Phase B:** backgrounds service (AI pack + stock, OffthreadVideo, Background Manager UI); `yt.ts` native uploader.
- **Phase C:** 4K vertical tier (2159×3840 master, 35-45Mbps), fast-preview NVENC toggles, render telemetry, per-render
  improvement loop (benchmark → concurrency persist).

## 7. Definition of Done (phase A)

1. Two render probes (`_v2` outputs) with the new identity: master QC-pass, encoder verified, karaoke pages + RTL +
   transitions visible, thumbnails new layout.
2. Engine has zero legacy-orchestration script calls; bundle-once active; `onStart` telemetry logged.
3. `scripts/verify_v2.js` (38 checks) + vitest green; `check_prod_portal.ps1` green; old portal untouched.
4. Settings keys live in the dashboard (Look & Sound) page.

## 8. Risks
- Angle/GPU availability for NVENC → runtime probe + SW fallback (documented in blueprint §10).
- 4K renders ~2-3x slower / bigger files → keep default 1080x1920, 4K opt-in per dua.
- New fonts must preserve harakat → self-hosted, validateFontIsLoaded, regression render with a diacritic-heavy dua.
- YouTube "inauthentic content" → AI-pack + original composition keep original content >90%; license receipts kept.