# ============================================================
# DUA VIDEO GENERATOR - MASTER PLAN (v0.13 roadmap)
# Channel: Noor-e-Iman (@bushranasir1075)
# Date: 2026-08-28
# Status: ACTIVE - Premium upgrade roadmap (2026 Shorts standard)
# ============================================================

> Purani PLAN.md / AUDIT_REPORT.md / readyness.md / audit_results.json /
> MONETIZATION_PLAN.md / HOWTOUSE.txt hata di gayi (v0.12.0 tag se recoverable).

---

## 1. PROJECT OVERVIEW

Automated YouTube Shorts generator for Islamic Duas (Arabic karaoke + Urdu
translation + voice narration + Pexels photo/video backgrounds + web dashboard).
Khud render/upload nahi hota - hamesha user permission se.

### Key facts (current state, v0.12.0)
- **FPS: 80** (user ne 120 se 80 kiya - render fast)
- **Resolution:** 1080x1920 (9:16 vertical, YouTube Shorts)
- **Doa count:** 103 duas, 17 categories
- **YouTube:** 17 videos uploaded live (stats pipeline active)
- **Pexels backgrounds:** 169 assets downloaded, render mein integrated
  (video via OffthreadVideo, image via bgImage layer)
- **Dashboard:** port 7860, bearer auth, YouTube stats auto-refresh 30s
- **AI import:** aihubmix (OpenAI-compatible) - quota exhausted, blocked
- **Security:** auth.json + ai_api_config.json git-ignored

---

## 2. DEEP AUDIT RESULTS (2026 Shorts standard)

Source: 3 test renders + ffprobe/ffmpeg waveform/frame analysis +
2026 web research (retention, captions, encoding best practices).

### 2.1 Jo THEEK hai (no change)
| Check | Value | Standard |
|---|---|---|
| Resolution | 1080x1920 9:16 | ✅ exact |
| Codec | H.264 High, AAC stereo 48k | ✅ exact |
| Loudness | -14.3 LUFS integrated | ✅ exact (-14) |
| Peak/clipping | sab < 0dB | ✅ none |
| Word-by-word karaoke | present | ✅ top rec |
| Center-safe composition | yes (115px margins) | ✅ |

### 2.2 Gaps (improve karna hai)
| # | Issue | Measured | 2026 Standard | Impact |
|---|---|---|---|---|
| G1 | **Text outline/stroke nahi** | sirf drop-shadow | 4-6px black stroke | Bright bg par text parhna mushkil → retention |
| G2 | **Background music nahi** | koi music nahi | instrumental rec | Flat audio, kam production feel |
| G3 | **Bitrate zyada** | 10.5/17.9/19.9 Mbps | 8-12 Mbps @60fps | Files 20-60MB, upload slow |
| G4 | **Bg brightness mismatch** | 52 / 95 / 140 | uniform | Channel inconsistent look |
| G5 | **travel_start bg weak** | sat 20, bright 140 (faded white) | strong b-roll | Sab kam attractive video |

---

## 3. PREMIUM MASTER ROADMAP

### Phase 1 - READABILITY (highest lever, low cost)  [>>> DONE - tsc pass ✅]
| # | Task | Files | Done |
|---|---|---|---|
| 1.1 | KaraokeText par black stroke (WebkitTextStroke ~6% font + paintOrder) | `KaraokeText.tsx` | ✅ |
| 1.2 | weak/low-res bg quality-gate (reject <800px OR washed-out sat<18) → travel_start weak 540p video → HD jpg | `make_manifest.py`, manifest | ✅ |
| 1.3 | Bright bg par text readable scrim gradient (photo/video backgrounds) | `Background.tsx` | ✅ |

> Re-render pending: bulk batch render ke waqt Phase-1 fixes ka final visual verify.

### Phase 2 - PRODUCTION QUALITY  [>>> DONE (code-level) ✅]
| # | Task | Detail | Done |
|---|---|---|---|
| 2.1 | Bitrate optimize (CRF 15→18) | files 60→25MB, quality ~same | ✅ `render.js:204` |
| ~~2.2~~ | ~~Background music~~ | **REVERTED** — Dua/Islamic videos me music nahi rakhte (namuna sahi nahi). Sirf narration + natural SFX. | ❌ removed |
| 2.3 | Bg color consistency (uniform cinematic) | GradeLayer (always on) + #1.3 scrim + #1.2 quality gate = bright/faded assets reject => uniform tone | ✅ covered |

### Phase 3 - EXTREME PREMIUM (advance)
| # | Task | Detail | Done |
|---|---|---|---|
| 3.1 | Thumbnail design (visual density first frame) | `ThumbCard.tsx` + `thumbnail-card` comp already exist | ✅ built-in |
| 3.2 | Loop design (last frame → first frame) | EndCard already present; loop is by-design nice-to-have | 🟡 optional |
| 3.3 | Intro trim (open on visual density, <2s) | `INTRO_FRAMES=66` @80fps = **0.825s** (< 2s standard) | ✅ already |
| 3.4 | Brand kit lock (fonts/colors/caption style) | `themes.ts` centralizes brand; karaoke stroke now uniform | ✅ already |

> Phase 3 majorly ALREADY supported by architecture. Real remaining step is
> the bulk re-render + final visual verification of Phase 1/2 changes.

---

## 4. VERIFY PIPELINE (har Phase ke baad test-render)
```
python remotion/scripts/prepare_dua.py <dua_id> --force
python remotion/scripts/make_manifest.py <dua_id>
node remotion/node_modules/@remotion/cli/remotion-cli.js render \
  "<comp-id>" "out/<name>_final.mp4" \
  "--browser-executable=C:\Program Files\Google\Chrome\Application\chrome.exe" \
  --crf=<crf> --jpeg-quality=100 --log=error
```

### Quality gates (RFC)
- Loudness: -14 LUFS ±1
- Peak: < -1 dBFS (no clipping)
- Text readable: black stroke present, contrast > 4.5:1
- Bitrate: 8-12 Mbps @ 1080p60
- Background: natural (photo/video), not procedural gradient, category-matched

---

## 5. DEEP AUDIT & FIX ROUND 2 (2026-08-28, code-level)  [>>> DONE ✅]

3 parallel subagent audits (Python backend / Node dashboard / Remotion render)
+ verified fixes. Sab compile checks pass (tsc 0, node --check 0, python ast OK,
pytest 399+ passed).

### 5.1 Python backend (`core/`)
| Sev | Fix | File |
|---|---|---|
| CRIT | **60fps writer vs 80fps pipeline** — `VideoBuilder()` default fps 60 → ab config `VIDEO_FPS=80` se leta hai, takay QC FPS gate (exact 80) pass ho | `video_builder.py` |
| CRIT | **Double dynamic loudnorm** — `_mux_direct` par 2nd dynamic `loudnorm=-14:TP=-1.5` (AUDIO-001 ke khilaf) → hata diya; audio pehle hi 2-pass LINEAR -14/-1.0 normalize ho chuki hai | `video_builder.py` |
| HIGH | MAX_DURATION fallback mismatch (25 vs 50) → 50 par align | `audio_mixer.py`, `timeline_builder.py` |
| MED | `VideoCapture` not released on exception | `video_analyzer.py` |
| LOW | Dead code removed: `get_optional_field_coverage`, `get_category_names` | `dua_database.py` |
| — | Stale "24/60/120 FPS" docs + main.py error msg → 80 | `scene_engine.py`, `quality_checker.py`, `main.py` |
| — | Stale tests (120fps) → 80 aligned | `test_video_002.py`, `test_e2e_render.py` |

### 5.2 Node dashboard (`remotion/dashboard/`)
| Sev | Fix | File |
|---|---|---|
| HIGH | **Disconnected private cacheStore/qcStore** in render.js → ab shared `deps` refs use karta hai (delete-dua/render QC desync ended) | `routes/render.js` |
| MED | `GET /api/duas` no try/catch → 500 instead of hang | `routes/duas.js` |
| MED | `/api/cancel` ab runQuiet/runCapture children bhi kill karta hai (orphan process leak) | `routes/render.js` |
| MED | `thumbs-all` async IIFE no try/catch → handled | `routes/render.js` |

### 5.3 Remotion render (`remotion/src/`)
| Sev | Fix | File |
|---|---|---|
| HIGH | Grain SVG 160-rect data-URI per-frame rebuild → memoized (frame ke sirf position change) | `Background.tsx` |
| HIGH | `fitFontSize`+`measureText` (≤6×2) per-frame → `useMemo([data])` | `DuaVideo.tsx` |
| MED | **Karaoke off-by-one** — `ceil(end)` overlap ke saath `findIndex` first-match → ab latest-started-word selection, exactly 1 active/frame | `KaraokeText.tsx` |
| MED | Deterministic FX arrays (drops/flakes/banks/puffs/bugs/petals/birds/clouds/streaks/leaves/stars/falls) per-frame → memoized | `SkyFx.tsx`, `BorderFx.tsx`, `ArtFx.tsx` |
| MED | WaveBands SVG string per-frame → memoized | `Background.tsx` |

> Cars: bulk re-render + final visual verify pending (Phase 1/2 changes ke sath).

## 6. NOTES / DECISIONS
- Secrets NEVER commit (auth.json, ai_api_config.json, keys)
- Background media (Pexels) git-ignored - naye clone ko download_backgrounds.py
- **Pexels keys:** conversation mein, repo mein nahi
- v0.12.0 tag = purani docs ka backup point
- AI import blocked (aihubmix quota exhausted) - recharge/chahiye free key
- **Known test note:** `test_asset_registry.py::test_real_manifest...` red
  (expects empty asset DB, lekin 169 real Pexels assets aa chuke hain — data
  wali expectation, code bug nahi)
