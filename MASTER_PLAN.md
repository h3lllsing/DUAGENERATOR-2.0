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

### Phase 1 - READABILITY (highest lever, low cost)  [>>> START HERE]
| # | Task | Files | Done |
|---|---|---|---|
| 1.1 | KaraokeText par black stroke (WebkitTextStroke 4-6px) + karaoke styles | `KaraokeText.tsx` | ⬜ |
| 1.2 | travel_start ka faded bg → strong colorful Pexels bg fix | `manifest`, `Background.tsx` | ⬜ |
| 1.3 | Bright bg par text ke liye scrim/gradient overlay (uniform) | `Background.tsx` | ⬜ |

### Phase 2 - PRODUCTION QUALITY
| # | Task | Detail | Done |
|---|---|---|---|
| 2.1 | Bitrate optimize (CRF 15→18) | files 60→25MB, quality ~same | ⬜ |
| 2.2 | Background music (royalty-free Islamic instrumental) | -25 LUFS, voice se neeche | ⬜ |
| 2.3 | Bg color consistency (dark cinematic base) | uniform look | ⬜ |

### Phase 3 - EXTREME PREMIUM (advance)
| # | Task | Detail | Done |
|---|---|---|---|
| 3.1 | Thumbnail design (visual density first frame) | discovery +15-25% | ⬜ |
| 3.2 | Loop design (last frame → first frame) | rewatch spikes | ⬜ |
| 3.3 | Intro trim (open on visual density, <2s) | retention cliff fix | ⬜ |
| 3.4 | Brand kit lock (fonts/colors/caption style) | consistency | ⬜ |

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

## 5. NOTES / DECISIONS
- Secrets NEVER commit (auth.json, ai_api_config.json, keys)
- Background media (Pexels) git-ignored - naye clone ko download_backgrounds.py
- **Pexels keys:** conversation mein, repo mein nahi
- v0.12.0 tag = purani docs ka backup point
- AI import blocked (aihubmix quota exhausted) - recharge/chahiye free key
