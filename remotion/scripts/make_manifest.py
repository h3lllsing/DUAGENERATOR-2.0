# -*- coding: utf-8 -*-
"""Generate Remotion manifest JSON from dua data + TTS timing sidecars."""
import json
import os
import shutil
import sys

PROJECT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
sys.path.insert(0, PROJECT)
import config as project_config
REMOTION = os.path.join(PROJECT, "remotion")
TEMP = os.path.join(PROJECT, "temp")

TICKS = 10_000_000
GAP_SECONDS = 0.30

# PILLAR 2 · broadcast loudness targets (mirrors core/audio_mixer.py).
# Master chain is now: tonal/dynamics filters -> TWO-PASS LINEAR loudnorm
# (via AudioMixer) -> mp3 encode. Dynamic single-pass loudnorm is gone,
# so compressor makeup gain is transparent and no gain-pumping occurs.
LOUDNESS_TARGET = -14.0   # LUFS integrated
TRUE_PEAK_TARGET = -1.0   # dBTP ceiling
LRA_TARGET = 11.0

# PILLAR 2 · codec priming compensation. MP3/AAC encoders prepend a
# priming window (~2112 samples @48k ~= 44 ms) that shifts every word
# slightly late during playback. Word timestamps are moved earlier by
# this constant so on-screen karaoke lands frame-accurate.
PRIMING_COMPENSATION_S = 0.044

# Studio mastering: rumble cut + warmth + clarity + compression +
# light masjid ambience. Loudness normalization happens AFTER this
# chain as a separate linear two-pass step (see master_audio).
MASTER_FILTER = (
    "highpass=f=70,"
    "bass=g=2.5,"
    "equalizer=f=3000:t=q:w=1:g=1.5,"
    "acompressor=threshold=-18dB:ratio=3:attack=10:release=200,"
    "aecho=0.6:0.25:60|120:0.12|0.08"
)

CATEGORY_THEME = {
    "sleep": "mosque",
    "evening": "mosque",
    "morning": "sunset",
    "travel": "sunset",
    "food": "emerald",
    "bathroom": "emerald",
    "prayer": "manuscript",
    # PILLAR 1 · taxonomy v2 aliases (legacy ids above stay untouched)
    "protection": "dark",
    "rizq": "emerald",
    "forgiveness": "manuscript",
    "morning_evening": "sunset",
    "guidance": "manuscript",
    "health": "ocean",
    "anxiety_relief": "ocean",
    "gratitude": "eid",
    "family": "royal",
    "occasions": "ramadan",
}

# Studio mastering: rumble cut + warmth + clarity + compression +
# light masjid ambience + YouTube loudness standard (-16 LUFS).
# Timing-safe: no time-stretch, karaoke sync untouched.
MASTER_FILTER = (
    "highpass=f=70,"
    "bass=g=2.5,"
    "equalizer=f=3000:t=q:w=1:g=1.5,"
    "acompressor=threshold=-18dB:ratio=3:attack=10:release=200,"
    "aecho=0.6:0.25:60|120:0.12|0.08,"
    "loudnorm=I=-16:TP=-1.5:LRA=11"
)


def master_audio(wav_src, audio_dst):
    """merged.wav -> mastered mp3 (PILLAR 2 three-stage master).

    Stage 1: tonal/dynamics polish chain (MASTER_FILTER) -> temp WAV
    Stage 2: AudioMixer TWO-PASS LINEAR loudnorm (-14 LUFS / -1.0 dBTP)
    Stage 3: transparent 192k mp3 encode. No dynamic loudnorm anywhere,
    so compressor makeup gain stays transparent (no gain-pumping).
    """
    import imageio_ffmpeg
    import subprocess
    sys.path.append(PROJECT)
    from core.audio_mixer import AudioMixer

    exe = imageio_ffmpeg.get_ffmpeg_exe()
    base, _ = os.path.splitext(audio_dst)
    chained = "{}.chain.wav".format(base)
    normalized = "{}.norm.wav".format(base)
    try:
        subprocess.run(
            [exe, "-y", "-hide_banner", "-loglevel", "error",
             "-i", wav_src, "-af", MASTER_FILTER,
             "-ar", "48000", "-ac", "2", "-c:a", "pcm_s16le", chained],
            capture_output=True, check=True)
        ok, _measured = AudioMixer.normalize_loudness(chained, normalized)
        if not ok:
            raise RuntimeError("two-pass linear loudnorm failed")
        subprocess.run(
            [exe, "-y", "-hide_banner", "-loglevel", "error",
             "-i", normalized, "-b:a", "192k", audio_dst],
            capture_output=True, check=True)
    finally:
        for tmp in (chained, normalized):
            if os.path.exists(tmp):
                try:
                    os.remove(tmp)
                except OSError:
                    pass


# STYLE-ROTATION v2 (2026-08-23): anti dark-monotony rebalance.
# Categories that previously collapsed onto "dark"/single themes now rotate
# between visually distinct, category-appropriate themes (seeded by dua id,
# so every re-render of the same dua stays identical).
CATEGORY_ROTATIONS = {
    "protection": ("desert", "qadr"),
    "guidance": ("royal", "manuscript"),
    "gratitude": ("eid", "emerald"),
    "health": ("ocean", "emerald"),
}
GENERAL_ROTATION = ("manuscript", "dark", "royal", "emerald")

VALID_THEMES = ("dark", "mosque", "sunset", "manuscript", "emerald",
                "ocean", "desert", "royal", "ramadan", "eid", "qadr")


def _seed_pick(seq, seed):
    return seq[sum(map(ord, str(seed))) % len(seq)]


def resolve_theme(dua):
    t = (dua.get("template") or "").strip().lower()
    # Explicit non-dark choice always wins. "dark" stamps are treated as the
    # legacy default (import-loader era) and fall through to rotation so the
    # library stops collapsing onto one look.
    if t and t in VALID_THEMES and t != "dark":
        return t
    cat = dua.get("category", "")
    if cat == "general":
        return _seed_pick(GENERAL_ROTATION, dua["id"])
    rot = CATEGORY_ROTATIONS.get(cat)
    if rot:
        return _seed_pick(rot, dua["id"])
    return CATEGORY_THEME.get(cat, "dark")


def media_duration(path):
    import imageio_ffmpeg
    import re
    import subprocess
    exe = imageio_ffmpeg.get_ffmpeg_exe()
    proc = subprocess.run([exe, "-i", path], capture_output=True, text=True)
    m = re.search(r"Duration:\s*(\d+):(\d+):(\d+\.\d+)", proc.stderr)
    if not m:
        raise RuntimeError("no duration for " + path)
    h, mn, s = int(m.group(1)), int(m.group(2)), float(m.group(3))
    return h * 3600 + mn * 60 + s


def read_words(path):
    words = []
    with open(path, encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            ev = json.loads(line)
            if ev.get("type") != "WordBoundary":
                continue
            # PILLAR 2: shift earlier by the encoder priming window so
            # highlights land frame-accurate during AAC playback.
            start = max(0.0, ev["offset"] / TICKS - PRIMING_COMPENSATION_S)
            end = max(start, (ev["offset"] + ev["duration"]) / TICKS
                      - PRIMING_COMPENSATION_S)
            words.append({"t": ev["text"], "start": round(start, 3), "end": round(end, 3)})
    return words


def main(dua_id="rabbana_hasanah"):
    with open(os.path.join(PROJECT, "data", "duas.json"), encoding="utf-8") as f:
        duas = json.load(f)
    if not isinstance(duas, list):
        duas = duas.get("duas", [])
    dua = next(d for d in duas if d["id"] == dua_id)

    ar_words = read_words(os.path.join(TEMP, "{}_ar_timing.jsonl".format(dua_id)))
    ur_words = read_words(os.path.join(TEMP, "{}_ur_timing.jsonl".format(dua_id)))

    ar_dur = media_duration(os.path.join(TEMP, "{}_ar.mp3".format(dua_id)))
    urdu_base = ar_dur + GAP_SECONDS
    for w in ur_words:
        w["start"] = round(w["start"] + urdu_base, 3)
        w["end"] = round(w["end"] + urdu_base, 3)

    import wave
    with wave.open(os.path.join(TEMP, "{}_merged.wav".format(dua_id))) as w:
        total = w.getnframes() / w.getframerate()

    arabic_end = ar_words[-1]["end"]
    urdu_start = max(ur_words[0]["start"] - 0.05, 0.0)

    audio_dir = os.path.join(REMOTION, "public", "audio")
    os.makedirs(audio_dir, exist_ok=True)
    audio_dst = os.path.join(audio_dir, "{}.mp3".format(dua_id))
    wav_src = os.path.join(TEMP, "{}_merged.wav".format(dua_id))
    master_audio(wav_src, audio_dst)

    manifest = {
        "dua_id": dua_id,
        "title": dua["title"],
        "reference": dua["reference"],
        "fps": getattr(project_config, "VIDEO_FPS", 60),
        "width": 1080,
        "height": 1920,
        "totalDuration": round(total, 3),
        "audioFile": "audio/{}.mp3".format(dua_id),
        "template": resolve_theme(dua),
        "arabicWords": ar_words,
        "urduWords": ur_words,
        "sections": {
            "arabicEnd": round(arabic_end, 3),
            "urduStart": round(urdu_start, 3),
        },
    }
    if dua.get("masterpiece"):
        manifest["masterpiece"] = True

    cfg_path = os.path.join(os.path.dirname(os.path.abspath(__file__)),
                            "..", "dashboard", "config.json")
    if os.path.exists(cfg_path):
        try:
            with open(cfg_path, encoding="utf-8") as cf:
                cfg = json.load(cf)
            if cfg.get("channelName") or cfg.get("handle"):
                manifest["channel"] = {"name": cfg.get("channelName", ""),
                                       "handle": cfg.get("handle", "")}
        except Exception:
            pass

    sfx_dir = os.path.join(REMOTION, "public", "sfx")
    sfx = {}
    for name in ("whoosh", "riser", "tick"):
        if os.path.exists(os.path.join(sfx_dir, name + ".mp3")):
            sfx[name] = "sfx/{}.mp3".format(name)
    if sfx:
        manifest["sfx"] = sfx

    out_dir = os.path.join(REMOTION, "src", "data")
    os.makedirs(out_dir, exist_ok=True)
    out_path = os.path.join(out_dir, "{}.json".format(dua_id))
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(manifest, f, ensure_ascii=False, indent=1)

    print("manifest:", out_path)
    print("audio:", audio_dst)
    print("arabic words:", len(ar_words), "| urdu words:", len(ur_words))
    print("total: {:.2f}s | arabicEnd: {:.2f} | urduStart: {:.2f}".format(
        total, arabic_end, urdu_start))


if __name__ == "__main__":
    main(sys.argv[1] if len(sys.argv) > 1 else "rabbana_hasanah")
