"""Upload prepared Shorts to YouTube (vertical <=60s videos become Shorts).

Usage:
    python upload_shorts.py --dry-run             # show plan for all prepared
    python upload_shorts.py                        # upload all (privacy: private)
    python upload_shorts.py --privacy public       # upload public
    python upload_shorts.py --only id1,id2         # specific duas
    python upload_shorts.py --privacy unlisted --dry-run

Idempotent: already-uploaded shorts in state are skipped.

Output: JSON on the LAST stdout line.
"""
import argparse
import io
import json
import os
import sys

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8",
                              errors="replace")

SCRIPTS = os.path.dirname(os.path.abspath(__file__))
PROJECT = os.path.dirname(os.path.dirname(SCRIPTS))
STATE_PATH = os.path.join(PROJECT, "data", "shorts_state_channel1.json")
DUAS_PATH = os.path.join(PROJECT, "data", "duas.json")
TOKEN_PATH = os.path.join(PROJECT, "data", "yt_token_channel1.json")

CATEGORY_ID = "22"


def load_json(path):
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)


def load_state():
    if os.path.exists(STATE_PATH):
        try:
            with open(STATE_PATH, "r", encoding="utf-8") as f:
                return json.load(f)
        except Exception:
            pass
    return {}


def save_state(state):
    os.makedirs(os.path.dirname(STATE_PATH), exist_ok=True)
    tmp = STATE_PATH + ".tmp"
    with open(tmp, "w", encoding="utf-8") as f:
        json.dump(state, f, ensure_ascii=False, indent=2)
    os.replace(tmp, STATE_PATH)


def get_service():
    sys.path.insert(0, SCRIPTS)
    import youtube_auth
    youtube_auth.set_token_path(os.path.abspath(TOKEN_PATH))
    cred = youtube_auth.get_credentials()
    if not cred:
        return None
    from googleapiclient.discovery import build
    return build("youtube", "v3", credentials=cred)


def build_meta(dua, rot, fallback=None):
    from metadata import Rot, build_tags, build_description
    title = dua.get("title") or (fallback or {}).get("title") or "Dua"
    ref = (dua.get("reference") or (fallback or {}).get("reference")
           or "").strip()
    full_title = f"{title} | {ref}" if ref else title
    tags = build_tags(dua, rot)
    if "shorts" not in tags:
        tags.insert(0, "shorts")
    desc = build_description(dua, rot, {})
    if "#Shorts" not in desc:
        desc = desc.rstrip() + "\n#Shorts\n"
    return {"title": full_title[:100], "description": desc, "tags": tags}


def mirror_upload(service, body, media, progress=False):
    from googleapiclient.http import MediaFileUpload
    if isinstance(media, str):
        media = MediaFileUpload(media, chunksize=8 * 1024 * 1024,
                                resumable=True, mimetype="video/mp4")
    request = service.videos().insert(part="snippet,status", body=body,
                                      media_body=media)
    response = None
    while response is None:
        status, response = request.next_chunk()
        if status and progress:
            print("  progress: %d%%" % int(status.progress() * 100),
                  file=sys.stderr)
    return response


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--only", default=None)
    ap.add_argument("--dry-run", action="store_true")
    ap.add_argument("--privacy", default="private",
                    choices=["public", "unlisted", "private"])
    args = ap.parse_args()

    state = load_state()
    prepared = {k: v for k, v in state.items() if v.get("shortHref")}
    if args.only:
        want = [x.strip() for x in args.only.split(",") if x.strip()]
        prepared = {k: v for k, v in prepared.items() if k in want}

    duas = load_json(DUAS_PATH)
    if not isinstance(duas, list):
        duas = duas.get("duas", [])
    dua_map = {d.get("id"): d for d in duas if d.get("id")}

    order = sorted(prepared)
    plan = []
    for did in order:
        entry = prepared[did]
        dua = dua_map.get(did) or {}
        rot = None
        from metadata import Rot
        rot = Rot(did)
        meta = build_meta(dua, rot, entry)
        plan.append({"duaId": did, "title": meta["title"],
                     "file": entry["shortHref"],
                     "dur": entry.get("duration"),
                     "privacy": args.privacy,
                     "alreadyUploaded": bool(entry.get("video_id"))})

    if args.dry_run:
        print(json.dumps({"ok": True, "dryRun": True, "total": len(plan),
                          "items": plan}, ensure_ascii=False))
        return 0

    to_upload = [p for p in plan if not p["alreadyUploaded"]]
    if not to_upload:
        print(json.dumps({"ok": True, "uploaded": 0, "skipped": len(plan),
                          "note": "sab pehle se uploaded hain"},
                          ensure_ascii=False))
        return 0

    service = get_service()
    if service is None:
        print(json.dumps({"ok": False, "error": "auth failed"},
                         ensure_ascii=False))
        return 1

    results = []
    for p in to_upload:
        did = p["duaId"]
        dua = dua_map.get(did) or {}
        from metadata import Rot
        rot = Rot(did)
        meta = build_meta(dua, rot, prepared[did])
        body = {"snippet": {"title": meta["title"],
                            "description": meta["description"],
                            "tags": meta["tags"],
                            "categoryId": CATEGORY_ID,
                            "defaultLanguage": "en"},
                "status": {"privacyStatus": args.privacy,
                           "selfDeclaredMadeForKids": False}}
        try:
            resp = mirror_upload(service, body,
                                 prepared[did]["shortHref"])
            vid = resp.get("id")
            state[did]["video_id"] = vid
            state[did]["privacy"] = args.privacy
            state[did]["uploaded_at"] = __import__(
                "datetime").datetime.now().isoformat(timespec="seconds")
            save_state(state)
            results.append({"duaId": did, "status": "uploaded",
                            "videoId": vid,
                            "url": "https://youtube.com/shorts/" + vid})
        except Exception as e:
            results.append({"duaId": did, "status": "error",
                            "note": str(e)[:300]})
    ok = [r for r in results if r["status"] == "uploaded"]
    print(json.dumps({"ok": ok or not results, "uploaded": len(ok),
                      "total": len(to_upload), "items": results},
                     ensure_ascii=False))
    return 0 if len(ok) == len(to_upload) else 2


if __name__ == "__main__":
    raise SystemExit(main())