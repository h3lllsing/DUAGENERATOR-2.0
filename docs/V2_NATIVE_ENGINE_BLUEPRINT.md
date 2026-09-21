# V2 Native Engine — Blueprint (SRS)

**Status:** Approved draft — implementation = Phase 1
**Date:** 2026-09-20
**Scope:** Replace every borrowed/migrated orchestration with V2-owned, TypeScript-first
machinery. Remotion stays as the renderer. TTS edge-tts via V2's own `core/` Python package
stays (owner-approved: "TTS sahe hai"). Zero runtime dependence on `H:\DuaVideoGenerator`.

---

## 1. Objective

Build a single self-contained media engine inside V2 that is observably:

- **Faster** — target <60s wall-clock for a ~20s 1080x1920 dua video (today ~3 min through the
  legacy script chain), plus batch/parallel job throughput.
- **Higher quality** — karaoke word-highlight captions from TTS timestamps, cinematic
  scene transitions, proper RTL Arabic typography with full harakat, motion video
  backgrounds (Pexels/Pixabay), audible EQ/loudness to YouTube spec.
- **Fully native** — no file, script, or lookup belonging to the old portal is read or
  executed by V2. The old portal becomes a separate, irrelevant neighbour.

## 2. Non-Goals (owner locked)

- No Remotion Lambda / cloud rendering (free-only).
- No changes to TTS voices or providers (edge-tts as-is).
- No password/2FA, no backup infra.
- `H:\DuaVideoGenerator` remains READ-ONLY to V2; nothing we build writes there.
- SUNNI authentic dua sources, "kuch nahi hatana" (unit/smoke tests stay and gain coverage).

## 3. Current-State Summary (what we are replacing)

| Stage today | Command (legacy chain) | Owner today |
|---|---|---|
| TTS + timing | `python core/*` via `prepare_dua.py` | V2 python `core/` (KEEP) |
| Background poster | `make_manifest.py` fetches bg + writes `remotion/src/data/<id>.json` | Script |
| Render | `npx remotion render <compId> out/<id>.mp4` (CLI, cold bundle each time) | Remotion CLI |
| Encode | ffmpeg `libx264 -crf 18 -preset fast -movflags +faststart` | Script |
| QC | `qc.py` probes duration/res | Script |
| Thumb | `make_thumbs.py` (dry-run today) | Script |
| Metadata | `metadata.py` writes `<title>.txt` | Script |
| Upload | `upload.py` + `youtube_auth.py` (copied, PyGoogle) | Copied script |

Composition architecture already V2-native: `remotion/src/Root.tsx` registers a data-driven
composition (`compositionIdFor(duaId)` = `dua_id.replace(/_/g,'-')`) + `ThumbCard`. A
`KaraokeText.tsx` component already exists as the base for word-highlight.

## 4. Target Architecture

```
V2 DB (SQLite) ──> jobs ──> render-worker ──> apps/server/src/engine/* (TypeScript)
                                            ├─ audio.ts      → edge-tts via core (python, V2-owned)
                                            ├─ manifest.ts   → writes remotion/src/data/<id>.json
                                            ├─ reel.ts       → remotion renderMedia() in-process
                                            ├─ thumbs.ts     → remotion renderStill() in-process
                                            ├─ encode.ts     → ffmpeg-static, master + loudnorm + NVENC preview
                                            ├─ caption.ts    → karaoke pages from TTS word timings
                                            ├─ qc.ts         → ffprobe + size/duration policy checks
                                            └─ meta.ts       → sidecar + SEO fields
                 ──> publish-worker ──> apps/server/src/engine/yt.ts  (googleapis-native uploader)
```

**Python boundary (explicit):** Python remains *only* for `core/tts_engine.py` +
`core/audio_mixer.py` (edge-tts synthesis + URI timing). Everything else executes in Node.
The old `remotion/scripts/*.py` orchestration wrappers are retired from the worker.

## 5. Module Specifications (Phase 1)

### 5.1 `apps/server/src/engine/audio.ts`
- Wraps a single thin entrypoint: `python -X utf8 apps/server/src/engine/tts_once.py <duaKey>`
  (or direct `core` import), NO legacy script.
- Outputs to `V2/temp/<id>_ar.mp3`, `_ur.mp3`, `_ar_timing.jsonl`, `_ur_timing.jsonl`,
  `_merged.wav` (unchanged contracts), returns timing arrays to the orchestrator.
- Idempotent (skip if outputs exist); `--force` to redo.

### 5.2 `apps/server/src/engine/manifest.ts`
- Builds `remotion/src/data/<duaKey>.json` directly from **V2 DB row + audio timing** —
  no `data/duas.json` replica lookups after the first migration checkpoint.
- Resolution: `compositionIdFor(duaKey)` stays.
- Copies/refs background frame into `remotion/public/backgrounds/<duaKey>.jpg`.

### 5.3 `apps/server/src/engine/reel.ts` (the speed core)
- `bundle()` once at worker start (module-level), then `selectComposition()` +
  `renderMedia()` per job with `inputProps` from manifest.
- Concurrency: `npx remotion benchmark` result persisted (settings `remotion_concurrency`);
  default `50%` (≈5-6 on this 12-core box), clamp by RAM budget
  (~300MB/tab → max ≈4 on 16GB to stay safe).
- `chromiumOptions.gl = 'angle'` (GPU-accelerated when available; Remotion 5 default
  already auto-falls back to SwiftShader).
- `hardwareAcceleration: 'if-possible'` where supported (NVENC on this NVIDIA box) →
  options: `--hardware-acceleration if-possible`, `--video-bitrate 8M` for FHD.
- `offthreadVideo` for video backgrounds; static local assets via `staticFile()`/`public/`.
- Output: `remotion/out/<duaKey>.mp4` (raw master, H.264, CRF 18).

### 5.4 `apps/server/src/engine/encode.ts`
- Stream 1 (master/upload): `libx264 -crf 18 -preset slow -profile:v high -level 4.2
  -pix_fmt yuv420p -movflags +faststart` (YouTube re-encode headroom).
- Stream 2 (audio loudness): `loudnorm=I=-14:TP=-1.5:LRA=11` + `aac 192k, 48k, stereo`.
- Stream 3 (fast preview, optional): `h264_nvenc -preset p4 -cq 22` when GPU OK (5-10x).
- ffmpeg delivered via `ffmpeg-static` (no PATH assumption).

### 5.5 `apps/server/src/engine/caption.ts`
- Consumes TTS `*_timing.jsonl` → `@remotion/captions` `Caption[]`.
- `createTikTokStyleCaptions({ combineTokensWithinMilliseconds })` for Arabic+Urdu pages;
  per-word highlight with the existing `KaraokeText.tsx` as the visual base.
- RTL: wrapper `direction:'rtl'`, `textAlign:'start'`, `wordBreak:'keep-all'`,
  `whiteSpace:'pre'`.

### 5.6 `apps/server/src/engine/thumbs.ts`
- `renderStill()` (in-process) on `ThumbCard` comp at a pick frame → PNG in
  `remotion/out/thumbs/<duaKey>.png`, auto-shrink to <2MB, yt-thumb specs.
- Replaces `make_thumbs.py` (real generation by default, not dry-run).

### 5.7 `apps/server/src/engine/qc.ts`
- ffprobe: duration within expected window, dims = 1080x1920, fps 30,
  size sanity; emits pass/fail + alert hooks (reuse `alerts.ts`).

### 5.8 `apps/server/src/engine/meta.ts`
- Writes `remotion/out/<duaKey>.txt` sidecar + DB SEO fields (title/desc/tags) —
  replaces `metadata.py`.

### 5.9 Composition upgrades (`remotion/src`)
- `Sequence` scene model: Intro → Arabic (bismillah) → Urdu → Reference/Outro with
  `@remotion/transitions` `TransitionSeries` (fade 12-18f, spring timing, `durationRestThreshold:0.001`).
- Arabic fonts via `@remotion/fonts` self-hosted in `remotion/public/fonts/`:
  primary **Noto Naskh Arabic** (400/700) — full harakat/diacritics; `validateFontIsLoaded:true`.
- `LookVariants`/`FrameStyles` pass-through kept; budgets: ≤2 families, ≤3 weights, no
  remote font fetch at render time.

### 5.10 `apps/server/src/engine/yt.ts` (Phase 2 — publish)
- Native Node uploader using `googleapis` + `google-auth-library` OAuth with
  `data/yt_token_channel1.json` (refresh flow), replaces copied `upload.py`.
- `videos().insert` with scheduled publish support; `thumbnails().set`; privacy from settings
  (`v2_upload_privacy`, default `private`).
- Post-upload: video_id write-back, ledger entry, job `done` (same contract as the
  current executor so the wiring test remains green).

## 6. Backgrounds as a Service (Phase 2)

- `apps/server/src/engine/stock.ts` — Pexels (free) + Pixabay (free) search-by-category;
  vertical 1080x1920 preference (`orientation=portrait`, `min_height`); cache to
  `assets/backgrounds/videos/`; license attribution recorded in DB.
- OffthreadVideo backgrounds replace static-image bg for motion quality.
- Safe no-key mode: exists local library fallback (current 185 videos) if API key absent.

## 7. Data / Replica Cleanup

- Milestone checkpoint: `remotion/src/data/<duaKey>.json` manifests become the single
  source consumed by compositions; `data/duas.json` replica then stop being read by the
  worker (file can remain for dashboard/export, not for rendering).

## 8. Performance Budget (acceptance)

| Case | Today | Target (Phase 1 done) |
|---|---|---|
| ~20s dua, 1080x1920, h264 | ~150-180s | <60s |
| Thumbnail PNG | dry-run only | real, <2MB, <5s |
| Batch 10 dois | sequential ~30min | ≤ 25 min (pipeline concurrency + encode overlap) |

## 9. Phased Plan

- **Phase 1 (this sprint):** engine modules 5.1-5.8 + reel/caption/transitions/fonts in
  comps; worker rewired; probe render green on 2 dois; unit/smoke tests extended; upload
  executor job-state contract unchanged (upload.py still functioning until Phase 2).
- **Phase 2:** `yt.ts` native uploader + `stock.ts` background service; flip `upload_live`
  after approval; delete nothing.
- **Phase 3 (optional):** 2160x3840 4K master path (`--scale` incremented) for YT's higher
  encoding tier; NVENC fast-preview toggles; per-render telemetry.

## 10. Risks & Mitigations

- **GPU/NVENC availability** — `nvidia-smi` blocked (permissions). Mitigation: probe once at
  worker start (`ffmpeg -encoders | findstr nvenc`); fall back to `libx264` software silently.
- **NVENC file-size blowup** — use `--video-bitrate 8M` (documented) for final upload;
  NVENC preview streams never uploaded.
- **Arabic font rendering drift** — fonts self-hosted + `validateFontIsLoaded`; 10s test
  render regression for a harakat-heavy dua before each release.
- **Memory** — clamp local concurrency by RAM budget; long renders chunked.

## 11. Research Addendum (2026, web-verified + on-machine probes)
**Environment facts (probed on this machine, 2026-09-20):**
- Remotion **4.0.520** installed under `remotion/node_modules` (NOT root); packages available:
  `@remotion/captions`, `transitions`, `fonts`, `layout-utils`, `media`, `renderer`, `compositor-win32-x64-msvc`.
- Bundled FFmpeg = `remotion/node_modules/@remotion/compositor-win32-x64-msvc/ffmpeg.exe` (n7.1).
  It **ship `h264_nvenc` + `hevc_nvenc`** — confirmed. Remotion's renderer uses THIS binary, not PATH ffmpeg,
  so no `binariesDirectory` override needed on Windows (docs updated in 2026).
- `remotion.config.ts` today: `setCrf(18)`, `setJpegQuality(90)`, `setConcurrency(null)`, `setChromiumOpenGlRenderer('angle')`.
  ANGLE already engages D3D11 GPU rasterization for frames. GPU model unknown (`nvidia-smi` needs admin).

**NVENC critical rules (from Remotion issue #10698 on 4.0.5xx):**
- `crf` **silently disables** `hardwareAcceleration:'if-possible'` → falls back to software x264 with NO log line.
  ⇒ Master encode path: HW accel ON → use `videoBitrate:'8M'` (crf incompatible); SW path → keep CRF 18.
  Never set both. Verified NVENC via post-render `ffprobe` of the `encoder` tag (`h264_nvenc`).
- Remotion joins/encodes in-process; `parallelEncoding` + `resolvedConcurrency` reported in `onStart` — log them for telemetry.
- `--video-bitrate 8M` ≈ same size as software CRF18 encodes at 1080p (documented by Remotion).

**Render speed (Remotion official + community 2026):**
- `concurrency` default = half CPU threads (=6 here; 12 logical cores). Per tab ≈ 200-400MB → cap ≈ 4-6 tabs on 16GB.
- **Bundle once:** `bundle()` (webpack) once per worker → reuse `serveUrl`; cold-bundle-per-job (current `npx remotion render`
  behavior) is the single biggest waste we are removing. `selectComposition()` returns the authoritative `durationInFrames`.
- Job-level pool (e.g. 2 concurrent jobs) × internal concurrency (≈4) → ~8 active threads ≈ best for 8-12 core / 16GB.
  Values tuned via `npx remotion benchmark`.
- `<OffthreadVideo>` = fastest renderer for video, but background video extracts frames sequentially → keep video-bg count/short,
  use `offthreadVideoThreads` if heavy; alternative: full-frame static (blurred) bg + one small OffthreadVideo motion accent.

**Captions / karaoke (implementable with @remotion/captions 4.0.x):**
- `createTikTokStyleCaptions({captions, combineTokensWithinMilliseconds})` → `pages` of `{text, startMs, durationMs, tokens[]}`.
  Tokens carry `fromMs/toMs` for word highlight (TikTok style). Gate: every token `text` must LEAD with a space (else whole text
  collapses to one line); render container needs `whiteSpace:'pre'`. Use `fitText()` (`@remotion/layout-utils`) to auto-size pages.
- RTL: wrapper `direction:'rtl'`; tokens highlight with color swap — verified fine with Arabic. Combine window ≈ 1500-1800 ms
  for dua pacing. Existing `remotion/src/KaraokeText.tsx` = the visual base.
- Sources: edge-tts `*_timing.jsonl` already give word boundaries (start/end per word) — direct input, no Whisper needed.

**Arabic typography (Chromium = our renderer, not WebKit):**
- Noto Kufi Arabic and Noto Sans Arabic confirmed rendering correctly in Remotion issues; Noto Naskh Arabic (modulated serif,
  1598 glyphs, full Quranic diacritics + Urdu coverage) is the recommended primary. NOT Noto Nastaliq Urdu (complex Nastaliq
  shaping unreliable even in browser).
- Self-host TTF files in `remotion/public/fonts/` (Google Fonts strips `dlig`; the من الله لله ligature variant relies on it —
  self-hosted keeps ligature). Load weights 400/700 only (+ `RTL` subset). v4.0.520: `loadFont()` without args is allowed
  (v5.0 requires explicit weights/subsets — note for future upgrades).
- Known cosmetic quirk: ليس لله Lam-Lam-Heh ligature renders short in Noto Naskh builds (notofonts/arabic#192) — acceptable.

**YouTube upload/master spec 2026 (official support page + industry):**
- Container MP4; H.264 High Profile; progressive; CABAC; 2 consecutive B-frames; closed GOP = half frame rate; 4:2:0; VBR.
- SDR bitrate recs (30fps): 1080p **8 Mbps**, 2160p **35-45 Mbps**. Audio AAC-LC 256k, 48k, stereo (independent of res).
- **4K vertical tier is a real quality lever:** YouTube assigns VP9/AV1 tier + higher bitrate ceiling to 2160p uploads; playback
  at 1080p then looks cleaner than a native 1080p upload. Because our graphics/title/karaoke text are vector, rendering directly
  at 2160x3840 keeps text sharp (better than upscale-only blogs describe). Trade-off: ~2-3x render time + slower YT processing.
  Phase 3: `renderMedia` natively at 2160x3840 (~35Mbps) as optional master; keep 1080x1920 default.
- Vertical 9:16 uploads auto-adapt in the player (no letterboxing); Shorts = ≤60s, our content is typically longer → regular upload.
- loudnorm -14 LUFS stays.

**Video background stock (legal surface, 2026):**
- Pexels License + Pixabay Content License both allow commercial + monetized YouTube use, **no attribution required**, no standalone
  resale. Pexels: `GET api.pexels.com/v1/videos/search?orientation=portrait&size=medium|large&query=...`, 200 req/hr / 20k/mo free,
  unlimited free with attribution on request. Pixabay: `pixabay.com/api/videos/?video_type=film&min_height=1920&category=...`.
- **Monetization caution (YouTube July 2025 "inauthentic content" policy):** channels that look mass-produced/interchangeable or
  overwhelmingly reused stock cannot monetize (this applies to STOCK-ONLY formats). Our format is transformative: original TTS
  voiceover + karaoke + duas + own composition, with stock used as accent (target original-content dominance >80-90%). Keep
  per-clip license receipts (source URL + download date) for Content-ID disputes; vary clips; avoid same-trending-clip reuse.

**Decision log (recorded here so implementation matches reality):**
- Phase 1 master path: `renderMedia` (bundle once) → H.264; NVENC probe → `videoBitrate 8M`, else CRF18 SW; loudnorm + AAC-LC 256k.
- Remove `Config.setCrf(18)`/`setConcurrency(null)` coupling: crf supplied per-render only on SW path; HW path passes `videoBitrate`.
- Capture `onStart({resolvedConcurrency, parallelEncoding})` for logs; ffprobe encoder-tag assertion after every master render.
- No `edge-tts` change; no Whisper (timings already present); no cloud render; no new python.

## 13. Research Addendum 2 (2026) — final stack verdicts
**Remotion versioning (stay on 4.x):**
- Remotion **5.0 is not yet released** (migration page: "not yet released, incomplete list"). It relocates/retires 4 packages
  (`@remotion/media-parser` + `@remotion/webcodecs` → Mediabunny, `@remotion/studio-leaks` → effects, starburst → built-in).
  `@remotion/media` (OffthreadVideo) is NOT in the discontinued set.
- ⇒ **Keep 4.0.520 for Phase 1.** Disciplines that also apply in v4: always pass `weights` + `subsets` to `loadFont()`
  (bare `loadFont()` downloads ALL weights/subsets → timeouts, Remotion issue #5071). Local fonts via `@remotion/fonts`
  (available ≥4.0.164) or bundled `FontFace` — self-host TTF for Arabic ligatures (`dlig` preserved).
  `validateFontIsLoaded` defaults true only in v5 — set it explicitly now.

**AI-generated backgrounds (originality/monetization lever, free-only compatible):**
- 2026 free tiers (verified): **PixVerse V5** — 60 credits/day, no watermark on standard exports; **Veo 3.1 via Google Vids**
  — 10 free 4K generations/month, unwatermarked, native 9:16; **Kling 3.0** — 3-5 clips/day (watermarked, $6.99 removes).
  Sora consumer app discontinued Apr 2026 — avoid. Runway Gen-4.5 paid only ($12+).
- AI-generated B-roll is the strongest defense against YouTube's July-2025 "inauthentic/reused content" policy AND against
  "same-drone-shot" stock familiarity. But free tiers are cloud-UIs (no API for automation) and license terms vary for
  monetized YouTube ⇒ **recommended pattern (free-only): "AI Background Pack"** — monthly manual batch of 10-30 unique
  vertical 4K clips (Veo Google Vids 10/mo + PixVerse 60/day) saved to `assets/backgrounds_v2/` with a license-receipt
  JSON; engine (Phase 2 `stock.ts`) prefers this library first, Pexels/Pixabay as fill. Originality stays >90%.
- Local SDXL/Flux generation on this box: no confirmed GPU (nvidia-smi blocked), stills-only, slow — skip for now.

**edge-tts voice options (TTS unchanged, voice tuning optional):**
- Urdu: `ur-PK-AsadNeural` (male) / `ur-PK-UzmaNeural` (female). Arabic: `ar-SA-HamedNeural` (male) /
  `ar-SA-ZariyahNeural` (female); alternatives `ar-QA-MoazNeural`, `ar-AE-HamdanNeural`, `ar-EG-SalmaNeural`.
- Voices tagged ContentCategories (General/News/...) + personality — target "General," neural > non-neural. Keep current
  V2 `core/tts_engine.py` defaults (owner: "TTS sahe hai"); a future settings key (`tts_voice_ar`/`tts_voice_ur`) can flip
  without pipeline changes.

## 14. SQLite/DB + engine call-path notes (contracts locked)
- render-worker swaps its six `execSync` stages for `engine/*` awaits (audio → manifest → reel → encode → qc → meta), then
  thumbs via renderStill; state updates (%) and `out/<duaKey>.mp4`/`_final.mp4`/`thumbs/<duaKey>.png` paths unchanged so
  `pipeline_test.mjs` and the dashboard keep working.
- `job_id` uniqueness & `videos.state` transitions stay; render/upload type-filter fix already applied.
- Bundle cache: module-level `getCachedBundle()` (Promise dedupe); served URL reused for `selectComposition`+`renderMedia`
  per job. Composition ids unchanged (`duaKey.replace(/_/g,'-')`); `ThumbCard` unchanged id.

## 16. Pre-implementation verification (probed 2026-09-20)
- **Package locations:** `@remotion/transitions`, `fonts`, `layout-utils` @4.0.520 already in `remotion/package.json`.
  `@remotion/captions` is **missing from remotion/package.json** (present only as a transitive/hoisted artifact) ⇒ add
  `@remotion/captions@4.0.520` before use. Renderer/bundler live under `remotion/node_modules`, NOT `apps/server` —
  the engine imports must resolve from **apps/server** ⇒ install `@remotion/{renderer,bundler,captions}` @4.0.520 there
  (no workspace; nested node_modules layout confirmed).
- **Karaoke data already exists:** `core/tts_engine.py` captures edge-tts `WordBoundary` metadata as a JSONL sidecar
  (`metadata_fname`) per language — the exact word timings `@remotion/captions` needs. No Whisper, no new TTS work.
  Voices already `ar-SA-HamedNeural` (ar) + `ur-PK-AsadNeural` (ur), with per-dua style rotation and
  `data/voice_prosody.json` rate/pitch overrides.
- **Composition contract:** manifests are bundled via `require.context('./data')`, so rendering must pass
  `inputProps: {data}` (the manifest read from `remotion/src/data/<duaKey>.json`); each Composition id =
  `duaKey.replace(/_/g,'-')`; `width/height/fps/durationInFrames` derive from manifest + INTRO/END frames —
  `selectComposition()` returns the authoritative `durationInFrames` for RenderMedia.
- **Manifest already carries karaoke data:** `arabicWords`/`urduWords` = `WordTiming[] {t, start, end}` → maps 1:1 to
  `@remotion/captions` `Caption[]` (no timing transform). Also `sections {arabicEnd, urduStart}`, `width/height/fps`,
  `background`+`backgroundKind`, `sfx`, `template` — engine just reads `remotion/src/data/<duaKey>.json`.
- **Bundle entry + install targets:** entry = `remotion/src/index.ts` (`registerRoot(RemotionRoot)`). `apps/server/` has
  its OWN `node_modules`; project root has NO `@remotion` ⇒ engine deps must be installed into `apps/server`:
  `@remotion/{renderer,bundler,captions,transitions,fonts,layout-utils}@4.0.520`.
- **cli-config vs JS API (removes the crf trap):** `remotion.config.ts` (`setCrf(18)`, `setConcurrency(null)`, image
  format) applies ONLY to the CLI. The engine uses `renderMedia()` options → pass `{crf:18 | videoBitrate:'8M',
  concurrency, imageFormat:'jpeg', jpegQuality:90, chromiumOptions:{gl:'angle'}}` explicitly. No silent CRF/NVENC clash
  in the native path; the crf-vs-NVENC rule still applies *inside* the engine's own option builder.

## 17. Definition of Done (Phase 1)

1. Worker executes zero legacy-orchestration scripts; all stages in `apps/server/src/engine/*`.
2. Two full renders with karaoke + transitions + RTL fonts produce QC-passing masters.
3. `scripts/verify_v2.js` (38) + vitest suite still green; new engine unit tests added.
4. `upload_live=0` dry-run still passes through the (unchanged) upload job executor.
5. Old portal untouched; `scripts/check_prod_portal.ps1` green.