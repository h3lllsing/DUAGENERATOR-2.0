"""AI-powered Dua Import from aihubmix.com (OpenAI-compatible).

Usage:
    python ai_import.py --count 5 --category food
    python ai_import.py --count 10 --topic "travel duas"

API keys are loaded from data/ai_api_config.json (never hardcoded).
All duas are Islamic Sunni from authentic sources.
"""
import argparse
import json
import os
import re
import shutil
import sys
import time
import urllib.request

try:
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
except (AttributeError, ValueError):
    pass

PROJECT = os.path.dirname(
    os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
DATA_DIR = os.path.join(PROJECT, "data")
DUAS_PATH = os.path.join(DATA_DIR, "duas.json")
DUAS_BACKUP_PATH = os.path.join(DATA_DIR, "duas.backup.json")
CONFIG_PATH = os.path.join(DATA_DIR, "ai_api_config.json")

LOCK_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)),
                         "ai_import.lock")
LOCK_MAX_AGE = 10 * 60  # 10 minutes: stale-lock breakout


def _pid_alive(pid):
    """Windows-safe liveness probe via OpenProcess (stdlib only)."""
    try:
        import ctypes
        PROCESS_QUERY = 0x0400
        h = ctypes.windll.kernel32.OpenProcess(PROCESS_QUERY, False, int(pid))
        if not h:
            return False
        ctypes.windll.kernel32.CloseHandle(h)
        return True
    except Exception:
        return True


def acquire_lock():
    """Create an exclusive lock file so concurrent ai_import runs cannot
    clobber data/duas.json. Stale locks (owner dead or old) are broken."""
    os.makedirs(DATA_DIR, exist_ok=True)
    for _ in range(2):
        try:
            fd = os.open(LOCK_PATH, os.O_CREAT | os.O_EXCL | os.O_WRONLY)
            with os.fdopen(fd, "w", encoding="utf-8") as f:
                f.write(json.dumps({"pid": os.getpid(), "ts": time.time()}))
            return True
        except FileExistsError:
            stale = False
            try:
                with open(LOCK_PATH, encoding="utf-8") as f:
                    info = json.load(f)
                age = time.time() - float(info.get("ts", 0))
                stale = (age > LOCK_MAX_AGE) and not _pid_alive(info.get("pid"))
            except Exception:
                stale = True
            if stale:
                try:
                    os.remove(LOCK_PATH)
                except OSError:
                    pass
                continue
            return False
        except OSError:
            return False
    return False


def release_lock():
    try:
        os.remove(LOCK_PATH)
    except OSError:
        pass


def load_config():
    """Load AI API config from data/ai_api_config.json (portal pe save hoga)."""
    try:
        with open(CONFIG_PATH, encoding="utf-8-sig") as f:
            return json.load(f)
    except Exception:
        return {}


def _config():
    return load_config()


def api_base_url():
    c = _config()
    return (c.get("base_url") or "https://aihubmix.com/v1").rstrip("/")


def api_keys():
    c = _config()
    keys = c.get("api_keys") or []
    return [k for k in keys if k and k.strip()]


def api_models():
    c = _config()
    return [m for m in (c.get("models") or []) if m and m.strip()]


API_KEYS = api_keys()
API_URL = api_base_url() + "/chat/completions"

# Valid aihubmix FREE model IDs (live catalog 2026-08-28). Ye sirf fallback
# candidate list hai — config ke models pehle try hote hain, phir ye sorted
# by quality ke order me (vision-capable text models pehle). Invalid
# `qwen3.8-flash` jaise IDs harness me nhi rakhe (403 dete hain).
VALID_FREE_MODELS = [
    "minimax-m3-free",          # vision, 1.05M ctx
    "gemini-3.7-flash-free",    # vision, 1M ctx
    "gemini-3.6-flash-free",    # vision, 1M ctx
    "gpt-5.5-free",             # 1.05M ctx
    "glm-5.3-flash-free",
    "gpt-4.1-mini-free",
    "minimax-m3-flash-free",
    "gemini-3.5-flash-lite-free",
    "hy3-free",                 # 256K ctx
    "qwen3.6-plus-preview-free",  # 1M ctx
]

# Config ke models ko priority par rakho, phir valid list bhar do, dedupe.
FREE_MODELS = list(dict.fromkeys(
    api_models() + VALID_FREE_MODELS
))

# Quota/balance exhausted message fingerprints — insaan ko "ye free model
# khatam hai, next try karo" batane ke liye (aur fake success se bachne ke liye).
BLOCK_MARKERS = [
    "try 10 times",
    "trial is used up",
    "prevention",
    "insufficient_user_quota",
    "balance is insufficient",
    "model does not exist",
    "model not found",
    "invalid model",
    "rate limit",
    "rate_limit",
    "quota exceeded",
    "daily limit",
    "per minute",
]

CATEGORIES = [
    "general", "prayer", "travel", "food", "sleep", "health",
    "study", "safety", "parents", "ramadan", "morning_evening",
    "mosque", "work", "clothing", "weather",
]

SYSTEM_PROMPT = """You are an expert Islamic Sunni scholar specializing in authentic duas from Quran and Hadith.

RULES (NON-NEGOTIABLE):
1. ONLY Sunni Islamic duas from authentic sources (Bukhari, Muslim, Tirmidhi, Abu Dawud, Nasai, Ibn Majah, Musnad Ahmad, etc.)
2. Arabic text MUST be accurate Quranic/Hadith Arabic - not transliteration
3. Urdu translation MUST be accurate and respectful
4. NEVER include Shia, Sufi innovations, or unauthenticated narrations
5. Each dua must have a verifiable hadith/reference source

Return ONLY a valid JSON array. No markdown, no explanation, no ``` code blocks.

Each object must have EXACTLY these keys:
{
  "id": "english_snake_case_unique_id",
  "title": "Urdu title of the dua",
  "titleEn": "English title",
  "arabic": "Full Arabic dua text with diacritics",
  "urdu": "Complete Urdu translation",
  "reference": "Authentic hadith/source reference (e.g. Sahih Bukhari 1010)",
  "category": "one of: general, prayer, travel, food, sleep, health, study, safety, parents, ramadan, morning_evening, mosque, work, clothing, weather"
}"""

CATEGORIES_MAP = {
    "food": ["food", "general"],
    "travel": ["travel", "safety", "general"],
    "sleep": ["sleep", "general"],
    "health": ["health", "general"],
    "study": ["study", "general"],
    "prayer": ["prayer", "mosque", "general"],
    "morning_evening": ["morning_evening", "general"],
    "safety": ["safety", "travel", "general"],
    "parents": ["parents", "general"],
    "ramadan": ["ramadan", "general"],
    "mosque": ["mosque", "prayer", "general"],
    "work": ["work", "general"],
    "clothing": ["clothing", "general"],
    "weather": ["weather", "general"],
    "general": ["general"],
}


def _block_reason(text):
    """Return a marker string if `text` indicates a blocked/unusable model,
    else None. text may be the HTTP response body OR the assistant content."""
    if not text:
        return None
    low = text.lower()
    for marker in BLOCK_MARKERS:
        if marker in low:
            return marker
    return None


def _is_empty_block(content):
    """Free models with used-up trial return HTTP 200 whose content is just a
    'sorry, try 10 times / recharge' note (no real answer). Detect that so we
    DON'T treat it as a successful generation."""
    if not content:
        return True
    c = content.lower()
    if any(m in c for m in ("try 10 times", "trial is used up",
                            "prevention", "insufficient",
                            "balance is insufficient", "recharge")):
        return True
    # A real dua JSON array always has at least one { "id": ... } object.
    if '"id"' not in content or "arabic" not in content:
        return True
    return False


def call_api(messages, api_key, model=None):
    """Call aihubmix.com API with AUTO-FALLBACK across all FREE models.

    Strategy:
      - Config ke `models` pehle, phir valid free catalog — har model try.
      - Agar model 10-trial/insufficient-quota/invalid ho (HTTP error ya
        durust HTTP 200 par empty sorry-message) -> is model ko skip kar ke
        agla valid free model try karo.
      - Pehli GENUINE dua response (jo JSON object ho) wahi return hota hai.
    Returns (content, model) or (None, None) agar koi model kaam na kare.
    """
    models_to_try = [model] if model else FREE_MODELS
    for m in models_to_try:
        payload = json.dumps({
            "model": m,
            "messages": messages,
            "temperature": 0.7,
            "max_tokens": 4000,
        }).encode("utf-8")
        req = urllib.request.Request(API_URL, data=payload, headers={
            "Authorization": "Bearer " + api_key,
            "Content-Type": "application/json",
            "User-Agent": "DuaStudio/0.11",
        })
        try:
            resp = urllib.request.urlopen(req, timeout=60)
            body = resp.read().decode("utf-8", errors="replace")
            result = json.loads(body)
            content = result["choices"][0]["message"]["content"]
            # Genuine JSON response check — real dua answer hona chahiye.
            if _is_empty_block(content):
                why = _block_reason(content) or "empty/blocked"
                print("  [skip] model=" + m + " key=" + api_key[-6:]
                      + " -> " + why)
                continue
            return content, m
        except urllib.error.HTTPError as e:
            body = ""
            try:
                body = e.read().decode("utf-8", errors="replace")[:500]
            except Exception:
                pass
            why = _block_reason(body) or ("HTTP " + str(e.code))
            print("  [skip] model=" + m + " key=" + api_key[-6:]
                  + " -> " + why)
            continue
        except Exception as e:
            print("  [skip] model=" + m + ": " + str(e)[:200])
            continue
    return None, None


def parse_duas(text):
    """Parse JSON array from AI response, handling common issues."""
    text = text.strip()
    if text.startswith("```"):
        lines = text.split("\n")
        lines = [l for l in lines if not l.strip().startswith("```")]
        text = "\n".join(lines)
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        start = text.find("[")
        end = text.rfind("]")
        if start >= 0 and end > start:
            try:
                return json.loads(text[start:end + 1])
            except json.JSONDecodeError:
                pass
    return []


def _norm(text):
    """Normalize text for comparison: lowercase, strip punctuation, collapse whitespace."""
    return re.sub(r"[\s\u200c\u200f]+", " ", str(text or "").strip().lower())


def load_existing():
    """Load existing duas to check for duplicates.

    Returns [] only when the file does not yet exist (fresh library).
    Returns None when the file EXISTS but is unreadable/corrupt — callers
    MUST abort before saving so a transient read failure can never wipe
    the whole library via an empty overwrite.
    """
    if not os.path.exists(DUAS_PATH):
        return []
    try:
        with open(DUAS_PATH, encoding="utf-8-sig") as f:
            existing = json.load(f)
        if isinstance(existing, dict):
            existing = existing.get("duas")
        if not isinstance(existing, list):
            return None
        return existing
    except Exception as e:
        print("ERROR: duas.json unreadable/corrupt (save ABORTED): "
              + str(e)[:200], file=sys.stderr)
        return None


def save_duas(new_items):
    """Append new duas to duas.json.

    Dedup logic:
      - Never add an item whose `id` already exists.
      - Never add an item whose ARABIC text matches an existing dua's arabic.
      - Never add an item whose URDU text matches an existing dua's urdu.
    A 90%+ similarity (after normalization) counts as duplicate, so minor
    wording differences don't slip through.
    """
    import difflib

    existing = load_existing()
    if existing is None:
        print("ABORT: library load failed - no changes written",
              file=sys.stderr)
        return []
    existing_ids = {d.get("id") for d in existing}
    existing_ar = [_norm(d.get("arabic")) for d in existing if d.get("arabic")]
    existing_ur = [_norm(d.get("urdu")) for d in existing if d.get("urdu")]
    existing_ti = [_norm(d.get("title")) for d in existing if d.get("title")]
    added = []
    for item in new_items:
        if not isinstance(item, dict):
            continue
        required = ["id", "title", "arabic", "urdu", "reference", "category"]
        if not all(item.get(k) for k in required):
            continue
        if item["id"] in existing_ids:
            continue

        ar_norm = _norm(item.get("arabic"))
        ur_norm = _norm(item.get("urdu"))
        ti_norm = _norm(item.get("title"))

        def _best_ratio(text, pool):
            if not text or not pool:
                return 1.0 if (not text and not pool) else 0.0
            return max(difflib.SequenceMatcher(None, text, p).ratio()
                       for p in pool)

        # Title duplicate check (exact + fuzzy 90%+) — NEW
        if ti_norm:
            if ti_norm in existing_ti or _best_ratio(ti_norm, existing_ti) >= 0.90:
                continue

        # Arabic duplicate check (exact + best fuzzy 90%+)
        if ar_norm:
            dup = False
            if ar_norm in existing_ar:
                dup = True
            if not dup and existing_ar and _best_ratio(ar_norm, existing_ar) >= 0.90:
                dup = True
            if dup:
                continue

        # Urdu duplicate check (exact + best fuzzy 90%+)
        if ur_norm:
            dup = False
            if ur_norm in existing_ur:
                dup = True
            if not dup and existing_ur and _best_ratio(ur_norm, existing_ur) >= 0.90:
                dup = True
            if dup:
                continue

        entry = {
            "id": item["id"],
            "title": item.get("title", ""),
            "titleEn": item.get("titleEn", ""),
            "arabic": item.get("arabic", ""),
            "urdu": item.get("urdu", ""),
            "reference": item.get("reference", ""),
            "category": item.get("category", "general"),
        }
        existing.append(entry)
        existing_ids.add(item["id"])
        if ar_norm:
            existing_ar.append(ar_norm)
        if ur_norm:
            existing_ur.append(ur_norm)
        if ti_norm:
            existing_ti.append(ti_norm)
        added.append(entry)
    try:
        if os.path.exists(DUAS_PATH):
            shutil.copy2(DUAS_PATH, DUAS_BACKUP_PATH)
    except Exception as e:
        print("WARN pre-save backup fail: " + str(e)[:120], file=sys.stderr)
    tmp = DUAS_PATH + ".tmp"
    try:
        with open(tmp, "w", encoding="utf-8") as f:
            json.dump(existing, f, ensure_ascii=False, indent=2)
        os.replace(tmp, DUAS_PATH)
    except Exception as e:
        print("ERROR: duas.json save failed: " + str(e)[:200],
              file=sys.stderr)
        try:
            os.remove(tmp)
        except OSError:
            pass
        return []
    return added


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--count", type=int, default=5,
                    help="Number of duas to generate (default 5)")
    ap.add_argument("--category", default="general",
                    help="Category: food, travel, sleep, health, study, etc.")
    ap.add_argument("--topic", default="",
                    help="Custom topic/prompt for dua generation")
    args = ap.parse_args()

    count = max(1, min(args.count, 10))
    cats = CATEGORIES_MAP.get(args.category, ["general"])

    topic_line = ""
    if args.topic:
        topic_line = " Topic/theme: " + args.topic + "."

    user_prompt = (
        f"Generate exactly {count} authentic Sunni Islamic duas for category "
        f"'{args.category}'.{topic_line}\n"
        f"IDs must be unique snake_case starting with '{args.category}_' prefix.\n"
        "Return JSON array only."
    )

    key_idx = 0
    all_new = []

    for attempt in range(len(API_KEYS) * 2):
        api_key = API_KEYS[key_idx % len(API_KEYS)]
        key_idx += 1
        print(f"[attempt {attempt + 1}/2] key=...{api_key[-8:]} model=auto")

        messages = [
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": user_prompt},
        ]
        content, model_used = call_api(messages, api_key)
        if content:
            print("  [ok] model=" + str(model_used))
            duas = parse_duas(content)
            if duas:
                added = save_duas(duas)
                all_new.extend(added)
                print(f"  [saved] {len(added)} new duas (total now {len(load_existing())})")
                break
            else:
                print("  [warn] no parseable duas in response")
        else:
            print("  [fail] no model worked with this key")

        time.sleep(1)

    if all_new:
        print(f"\n=== RESULT: {len(all_new)} new duas added ===")
        for d in all_new:
            print("  + {} | {} | {}".format(d["id"], d["title"],
                                             d["reference"]))
        print(json.dumps({"ok": True, "added": len(all_new),
                          "duas": [{"id": d["id"], "title": d["title"]}
                                   for d in all_new]}))
        return 0
    else:
        print("\n=== RESULT: 0 new duas ===")
        print(json.dumps({"ok": False, "added": 0,
                          "error": "No duas generated - check API keys/balance"}))
        return 1


if __name__ == "__main__":
    if not acquire_lock():
        print("ERROR: another ai_import run already holds "
              + LOCK_PATH, file=sys.stderr)
        raise SystemExit(3)
    try:
        raise SystemExit(main())
    finally:
        release_lock()
