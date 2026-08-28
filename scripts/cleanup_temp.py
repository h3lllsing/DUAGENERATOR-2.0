# -*- coding: utf-8 -*-
"""Delete useless temp build-files of RENDERED videos.

After an MP4 is baked, the TTS audio / merged wav / timing sidecars in
temp folder serve no purpose (they are only needed to BUILD the video).
This script removes them for every dua whose final MP4 exists, and frees
disk space.

Usage:
  python scripts/cleanup_temp.py            # delete (report first)
  python scripts/cleanup_temp.py --dry-run  # show what would be deleted

Never touches: out mp4/txt, thumbs, src/data manifests, duas.json, or
temp files of UNRENDERED duas.
"""
import argparse
import json
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)),
                                "..", "remotion", "scripts"))
from upload import safe_title  # same naming logic as the uploader

PROJECT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
TEMP = os.path.join(PROJECT, "temp")
OUT = os.path.join(PROJECT, "remotion", "out")
DB = os.path.join(PROJECT, "data", "duas.json")

JUNK_EXT = ("_ar.mp3", "_ur.mp3", "_merged.wav",
            "_ar_timing.jsonl", "_ur_timing.jsonl")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--dry-run", action="store_true")
    args = ap.parse_args()

    arr = json.load(open(DB, encoding="utf-8-sig"))
    deleted = freed = kept = skipped_ids = 0
    for d in arr:
        dua_id = d.get("id") or ""
        mp4 = os.path.join(OUT, safe_title(d.get("title") or "") + ".mp4")
        if not os.path.exists(mp4):
            skipped_ids += 1
            continue
        for ext in JUNK_EXT:
            p = os.path.join(TEMP, dua_id + ext)
            if os.path.exists(p):
                freed += os.path.getsize(p)
                deleted += 1
                if not args.dry_run:
                    os.remove(p)

    # stray temp files that belong to no known dua (custom/test) - report only
    known = {d.get("id") or "" for d in arr}
    strays = [f for f in os.listdir(TEMP)
              if os.path.isfile(os.path.join(TEMP, f))
              and f.rsplit("_", 1)[0] not in known]

    print("rendered duas      : {}".format(len(arr) - skipped_ids))
    print("unrendered (kept)  : {}".format(skipped_ids))
    print("files {}        : {}".format("scanned (would del)" if
          args.dry_run else "deleted", deleted))
    print("space {}           : {:.1f} MB".format(
        "reclaimable" if args.dry_run else "freed", freed / 1048576.0))
    print("stray temp files   : {} (untouched - check manually)".format(
        len(strays)))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
