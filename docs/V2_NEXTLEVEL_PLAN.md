# V2 Next-Level Plan — research-backed upgrades over the old portal (2026-09-20)

Deep-dive (2026 facts) on what makes V2 genuinely BETTER than `H:\DuaVideoGenerator`, not just rebuilt.
Sources listed inline. Owner policy: free/open-source only, mobile-first, old portal read-only.

---

## 1. Hardware reality (measured) — changes the encode strategy

- GPU is **AMD Radeon RX590 GME, 4GB VRAM** (Polaris/VCE) — NOT NVIDIA. `h264_nvenc` is NOT available.
- 2026 reviews agree: on Polaris-class AMD, **skip AMF, use x264** — AMF H.264 is the weakest hardware
  encoder (VMAF/PSNR "lagged significantly behind", reaches libvpx-level below ~6 Mbps). At 8 Mbps 1080p it
  approaches other encoders but no advantage. Recommended 2026 command for video-production quality:
  `ffmpeg -i in -c:v h264_amf -preset quality -rc vbr_peak -b:v 4000000 -maxrate 8000000 -bufsize 8000000 -vbaq true -preencode true -g 120 -high_motion_quality_boost_enable true -max_b_frames 3 -pa_adaptive_mini_gop true -pa_lookahead_buffer_depth 40 -pa_taq_mode 2` (AMD wiki) — BUT still only for PREVIEWS.
- **Decision:**
  - Final master/delivery = **libx264 CRF 18, preset slow/medium, High profile, 2 B-frames, closed-GOP, CABAC** (CPU, best quality). 12 CPU threads plenty fast for ≤60s clips.
  - **AMF = "preview tier" only**: fast low-cost QC/iteration renders (`h264_amf -quality speed/balanced` → preview.mp4) so the owner reviews look quickly; masters stay CRF18.
  - **Render acceleration still wins on GPU:** Chromium ANGLE/D3D11 on the RX590 accelerates PAINTING frames (Remotion `chromiumOptions.gl:'angle'`) — that's the real speed lever, independent of codec.
- ffprobe assertion per render: `streams[0].codec_name` = `h264` (check) + encoder string must be `libx264` for master / `h264_amf` for preview.

## 2. Audio — TTS stays, but delivery goes pro (owner: "TTS sahe hai")

- Keep edge-tts `ar-SA-Hamed` / `ur-PK-Asad` + VOICE_POOLS + `voice_prosody.json` + WordBoundary JSONL sidecars → captions.
- **Local neural TTS 2026 report:** Kokoro (Apache-2.0, 82M, CPU-fast) has **no Arabic/Urdu** → not for us.
  XTTS v2 has Arabic but **CPML = non-commercial** → out. F5-TTS weights **CC-BY-NC** → out.
  Chatterbox Multilingual v3 (MIT, 25 langs incl Arabic, emotion dial, PerTh watermark) would need a real GPU —
  RX590 4GB is borderline/slow → mark as **optional Phase C experiment**, not core.
- **Next-level audio moves (free, no new model):**
  1. **Two-voice narration:** Arabic verse on vo1, Urdu translation on vo2 (distinct voices) — old portal is single voice; instant audible upgrade. Settings: `tts_voice_ar`, `tts_voice_ur`.
  2. **Tight prosody:** cap internal pauses ≤150ms, trim head/tail silence, natural sentence taper (Arabic-TTS pipeline best-practice from 2026 research), deterministic seed.
  3. **Ambience bed** (optional CC0, −28 LUFS under narration) — exclusivity of "no music" preserved; mastering via 2-pass linear `loudnorm` I=-14 LUFS unchanged.
  4. **Whisper QC (faster-whisper, free/local):** ASR the TTS audio and diff against dua text → catches wrong recitation/voice swaps BEFORE publish (nobody in this niche does this).

## 3. Visual story — the real "not the old portal" lever

- **Karaoke pages** via `@remotion/captions` (word-highlight TikTok pages) built straight from manifest
  `arabicWords`/`urduWords` `{t,start,end}` — replaces old full-line pill karaoke.
- **`@remotion/transitions`** crossfades Intro → Arabic → Urdu → Endcard (old = hard cuts).
- **Motion backgrounds** via `<OffthreadVideo>` loops + soft blur + scrim (old = static poster look).
- **Procedural Islamic motifs** (SVG geometry in Remotion, e.g. 8-fold/12-fold star tiling, generated at runtime,
  seeded) — replaces redistributable raster ornament with infinite royalty-free deterministic vector; light to render.
- **AI Background Pack (free tiers, 2026):** PixVerse V5/V6 ~60 daily credits, standard export **no visible
  watermark**, also Kling 3.0 3-5 clips/day (watermarked at free tier) and Veo 3.1 via Google Vids 10/mo 1080p
  (imperceptible SynthID). Rule: backgrounds get blurred/scrimmed ≤30-40% of frame + karaoke/text/graphics over
  them → original composite remains >90% original content (keeps YT July-2025 inauthentic-content policy in check).
  Receipts+source per clip (Pexels/Pixabay licences fine, receipts too). Regulated in Background Manager.
- **Thumbnails:** auto-pick best frame via OpenCV entropy/rule-of-thirds scoring (old picks a fixed frame), new
  minimal card layout (Direction A sample approved pattern) — no double-ornament border of old.

## 4. Licensing verdicts (2026 — verified, so we don't ship something risky)

| Item | Verdict |
|---|---|
| Remotion (v4.0.520) | ✅ **Free** — individual/≤3-employee org even commercially; automation renders locally = fine. (Not selling Remotion itself.) |
| Rive | ❌ **Skip** — editor exports to production are $9/mo since Oct-2025; runtime-only doesn't get us design assets. |
| @remotion/lottie + our SVG | ✅ Free (already in package.json) — replaces Rive-class motion. |
| edge-tts / faster-whisper / opencv / tesseract | ✅ Free/MIT — all local. |
| XTTS v2 (CPML) / F5 weights (NC) | ❌ Non-commercial — excluded. |
| Chatterbox v3 (MIT) | ⚠️ Optional experiment; needs GPU we don't really have. |
| Fonts (Amiri Quran/Scheherazade/Noto Naskh Urdu) | ✅ Self-host (OFL) |
| AI bg: PixVerse/Veo(Vids)/Kling free tiers | ✅ With licensing/source receipts + our composite rule. |

## 5. Distribution — beat old portal

- **YouTube native uploader** via `googleapis` (free, alive) — Phase B, replaces copied `upload.py`.
- **IG/FB Reels auto-post is possible free** (Meta Graph API v26 container flow: media container → poll
  `FINISHED` → `media_publish`; 100 posts/24h cap) but needs Business/Creator account + FB Page + (for non-self)
  App Review — engineering/time cost. **Gate behind owner opt-in**; implement only if the channel expands.
- **WhatsApp share-kit + channel** — already in catalog; build in Phase B.
- Scheduler + daily quota (10/day, midnight-PT reset) already exist in V2.

## 6. Speed (the "faster than prod" promise)

- Bundle-once (`bundle()` → cached), warm browser, `renderMedia` with explicit options; concurrency ≈ 6 on 12C/16GB;
  no `execSync` python chain (native TS engine); AMF preview tier for fast review loops; render telemetry persisted
  (concurrency/encoder/seconds) for auto-tuning.

## 7. Explicit non-goals (to keep us honest & free)

Lambda, Sora, paid nasheed/music, XTTS/F5 output in published videos, TikTok autopost (no official free API),
Rive-exported animation, 2FA/cloud infra (owner-decided), vector-auto-dub of voices.

---

Phase mapping: **Phase A** = §1 (x264 master + AMF preview + ANGLE render accel), §2 #1/#4, §3 karaoke/transitions/
motifs/thumb-best-frame, §6. **Phase B** = §2 #2/#3, §3 motion-bg + AI pack + Background Manager, §5. **Phase C** =
§2 optional Chatterbox, 4K vertical tier, telemetry autotune, IG/FB opt-in.