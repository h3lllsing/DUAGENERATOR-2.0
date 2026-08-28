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
import random
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
CONFIG_PATH = os.path.join(DATA_DIR, "ai_api_config.json")


def load_config():
    """Load AI API config from data/ai_api_config.json (portal pe save hoga)."""
    try:
        with open(CONFIG_PATH, encoding="utf-8") as f:
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
FREE_MODELS = api_models() or [
    "minimax-m3-free",
    "gemini-3.7-flash-free",
    "gemini-3.6-flash-free",
    "minimax-m2.7-free",
    "glm-5.3-flash",
    "qwen3.8-flash",
    "hy3-free",
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


def call_api(messages, api_key, model=None):
    """Call aihubmix.com API with fallback models."""
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
            result = json.loads(resp.read().decode("utf-8"))
            content = result["choices"][0]["message"]["content"]
            return content, m
        except urllib.error.HTTPError as e:
            body = ""
            try:
                body = e.read().decode("utf-8", errors="replace")[:500]
            except Exception:
                pass
            if "try 10 times" in body or "prevention" in body.lower():
                print("  [rate-limit] model=" + m + " key=" + api_key[-8:])
                continue
            print("  [error] model=" + m + " HTTP " + str(e.code) + ": " + body[:200])
            continue
        except Exception as e:
            print("  [error] model=" + m + ": " + str(e)[:200])
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
    import re
    return re.sub(r"[\s\u200c\u200f]+", " ", str(text or "").strip().lower())


def load_existing():
    """Load existing duas to check for duplicates."""
    try:
        with open(DUAS_PATH, encoding="utf-8") as f:
            return json.load(f)
    except Exception:
        return []


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
    existing_ids = {d.get("id") for d in existing}
    existing_ar = [_norm(d.get("arabic")) for d in existing if d.get("arabic")]
    existing_ur = [_norm(d.get("urdu")) for d in existing if d.get("urdu")]
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

        # Arabic duplicate check (fuzzy 90%+)
        if ar_norm:
            dup = False
            if ar_norm in existing_ar:
                dup = True
            if not dup and existing_ar:
                match = difflib.SequenceMatcher(None, ar_norm,
                                                max(existing_ar, key=len)).ratio()
                if match >= 0.90:
                    dup = True
            if dup:
                continue

        # Urdu duplicate check (fuzzy 90%+)
        if ur_norm:
            dup = False
            if ur_norm in existing_ur:
                dup = True
            if not dup and existing_ur:
                match = difflib.SequenceMatcher(None, ur_norm,
                                                max(existing_ur, key=len)).ratio()
                if match >= 0.90:
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
        added.append(entry)
    with open(DUAS_PATH, "w", encoding="utf-8") as f:
        json.dump(existing, f, ensure_ascii=False, indent=2)
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
        "Generate exactly {n} authentic Sunni Islamic duas for category "
        "'{cat}'.{topic}\n"
        "IDs must be unique snake_case starting with '{cat}_' prefix.\n"
        "Return JSON array only."
    ).format(n=count, cat=args.category,
             topic=topic_line,
             cat_prefix=cats[0] + "_")

    key_idx = 0
    all_new = []

    for attempt in range(len(API_KEYS) * 2):
        api_key = API_KEYS[key_idx % len(API_KEYS)]
        key_idx += 1
        print("[attempt {}/2] key=...{} model=auto".format(
            attempt + 1, api_key[-8:]))

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
                print("  [saved] {} new duas (total now {})".format(
                    len(added), len(load_existing())))
                break
            else:
                print("  [warn] no parseable duas in response")
        else:
            print("  [fail] no model worked with this key")

        time.sleep(1)

    if all_new:
        print("\n=== RESULT: {} new duas added ===".format(len(all_new)))
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
    raise SystemExit(main())
