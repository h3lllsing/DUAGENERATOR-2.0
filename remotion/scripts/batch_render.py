# -*- coding: utf-8 -*-
"""PILLAR 3 Task 2: batch-render dedicated YouTube thumbnails.

Renders the `thumbnail-card` Remotion composition (remotion/src/ThumbCard.tsx)
to a 1080x1920 PNG for every rendered video in remotion/out/.

Usage:
  python remotion/scripts/batch_render.py            # dry-run plan
  python remotion/scripts/batch_render.py --limit 1  # smoke test
  python remotion/scripts/batch_render.py --apply    # full run
  optional: --only id1,id2   force specific ids
            --force          re-render even if thumb exists / state=done

Checkpointing: remotion/out/thumbs/_render_state.json (atomic replace).
Resume-safe: completed thumbs are skipped unless --force.
"""
import argparse
import io
import json
import os
import re
import shutil
import subprocess
import sys
import time

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8",
                              errors="replace")

PROJECT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
REMOTION = os.path.join(PROJECT, "remotion")
OUT_DIR = os.path.join(REMOTION, "out")
THUMB_DIR = os.path.join(OUT_DIR, "thumbs")
STATE_PATH = os.path.join(THUMB_DIR, "_render_state.json")
STATE_LOCK_PATH = os.path.join(THUMB_DIR, "_render_state.lock")
DATA_DIR = os.path.join(REMOTION, "src", "data")
CLI = os.path.join(REMOTION, "node_modules", "@remotion", "cli",
                   "remotion-cli.js")
CHROME_CANDIDATES = [
    os.environ.get("CHROME_PATH") or "",
    r"C:\Program Files\Google\Chrome\Application\chrome.exe",
    r"C:\Program Files (x86)\Google\Chrome\Application\chrome.exe",
]
MIN_PNG_BYTES = 50 * 1024

CREATE_NEW_PROCESS_GROUP = getattr(subprocess, "CREATE_NEW_PROCESS_GROUP", 0)


def _taskkill(pid):
    """Force-kill a process and its whole tree on Windows. Prevents orphaned
    Chromium child processes when a still-render is killed by timeout/crash."""
    try:
        subprocess.run(["taskkill", "/PID", str(pid), "/T", "/F"],
                       capture_output=True, timeout=10)
    except Exception:
        pass


def disk_headroom(video_count):
    """Return (free_bytes, required_bytes) for the output drive.
    Headroom: 1GB baseline + 20MB per remaining render."""
    usage = shutil.disk_usage(OUT_DIR)
    need = 1_000_000_000 + video_count * (20 * 1024 * 1024)
    return usage.free, need


def _acquire_state_lock(wait_secs=15, stale_secs=120):
    end = time.time() + wait_secs
    while True:
        try:
            os.makedirs(THUMB_DIR, exist_ok=True)
            fd = os.open(STATE_LOCK_PATH,
                         os.O_CREAT | os.O_EXCL | os.O_WRONLY)
            os.write(fd, str(os.getpid()).encode())
            os.close(fd)
            return True
        except FileExistsError:
            try:
                age = time.time() - os.path.getmtime(STATE_LOCK_PATH)
            except OSError:
                age = 0
            if age > stale_secs:
                try:
                    os.remove(STATE_LOCK_PATH)
                except OSError:
                    pass
                continue
            if time.time() > end:
                return False
            time.sleep(0.05)
        except OSError:
            return False


def _release_state_lock():
    try:
        os.remove(STATE_LOCK_PATH)
    except OSError:
        pass


def load_state():
    if os.path.exists(STATE_PATH):
        try:
            with open(STATE_PATH, encoding="utf-8") as f:
                return json.load(f)
        except Exception as e:
            print("WARN state unreadable, starting fresh:", e)
    return {"thumbs": {}}


def save_state(updates):
    """Single-flight load-merge-atomic write. Reloads the on-disk state,
    merges ONLY the updated entries, then atomically replaces the file, so a
    concurrent invocation can never erase the other run's progress."""
    got = _acquire_state_lock()
    try:
        current = load_state()
        thumbs = current["thumbs"]
        thumbs.update(updates)
        tmp = STATE_PATH + ".tmp"
        with open(tmp, "w", encoding="utf-8") as f:
            json.dump(current, f, ensure_ascii=False, indent=1)
        os.replace(tmp, STATE_PATH)
        return current
    finally:
        if got:
            _release_state_lock()


def chrome_path():
    for c in CHROME_CANDIDATES:
        if c and os.path.exists(c):
            return c
    return None


def build_title_map():
    """mp4 filenames are TITLE-based -> map to canonical dua_id."""
    tmap = {}
    for f in os.listdir(DATA_DIR):
        if not f.endswith(".json"):
            continue
        try:
            m = json.load(open(os.path.join(DATA_DIR, f),
                               encoding="utf-8"))
        except Exception:
            continue
        t = (m.get("title") or "").strip().lower()
        if t:
            tmap[t] = m.get("dua_id") or f[:-5]
    return tmap


def resolve_video_id(stem, tmap):
    """'Subah Ki Dua (1)' -> 'subah_ki_dua'; None if no manifest match."""
    s = stem.strip().lower()
    if s in tmap:
        return tmap[s]
    s2 = re.sub(r"\s+\(\d+\)$", "", s)
    return tmap.get(s2)


def archived_ids():
    dbp = os.path.join(PROJECT, "data", "duas.json")
    try:
        duas = json.load(open(dbp, encoding="utf-8"))
        if isinstance(duas, dict):
            duas = duas["duas"]
        return {d["id"] for d in duas if d.get("archived")}
    except Exception as e:
        print("WARN could not load DB for archived check:", e)
        return set()


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--apply", action="store_true")
    ap.add_argument("--limit", type=int, default=0)
    ap.add_argument("--only", default="")
    ap.add_argument("--force", action="store_true")
    args = ap.parse_args()

    chrome = chrome_path()
    if not chrome:
        print("ERROR: chrome.exe not found (set CHROME_PATH)")
        return 1

    videos = sorted(
        f[:-4] for f in os.listdir(OUT_DIR)
        if f.endswith(".mp4") and not f.startswith("."))
    tmap = build_title_map()
    archived = archived_ids()

    state = load_state()
    done = state["thumbs"]

    todo, skipped_done, unmapped, skipped_archived = [], [], [], []
    seen_ids = set()
    only_set = {x.strip() for x in args.only.split(",") if x.strip()}
    for stem in videos:
        vid = resolve_video_id(stem, tmap)
        if not vid:
            unmapped.append(stem)
            continue
        if only_set and vid not in only_set:
            continue
        if vid in archived:
            skipped_archived.append("{} -> {}".format(stem, vid))
            continue
        if vid in seen_ids:
            continue
        seen_ids.add(vid)
        png = os.path.join(THUMB_DIR, vid + ".png")
        st = done.get(vid, {})
        ok_prev = st.get("status") == "done" and os.path.exists(png)
        if ok_prev and not args.force:
            skipped_done.append(vid)
            continue
        mpath = os.path.join(DATA_DIR, vid + ".json")
        if not os.path.exists(mpath):
            unmapped.append(stem)
            continue
        todo.append((vid, mpath))

    print("videos:", len(videos),
          "| already-done(skip):", len(skipped_done),
          "| archived(skip):", len(skipped_archived),
          "| unmapped(no manifest):", len(unmapped),
          "| to render:", len(todo))
    for s in skipped_archived:
        print("  archived:", s)
    for u in unmapped:
        print("  unmapped:", u)

    if args.limit > 0:
        todo = todo[:args.limit]
        print("limit applied -> rendering:", len(todo))

    if not args.apply:
        print("DRY-RUN - first 10:")
        for vid, _ in todo[:10]:
            print("   -", vid)
        print("re-run with --apply to execute")
        return 0

    if todo:
        free_b, need_b = disk_headroom(len(todo))
        if free_b < need_b:
            print("ERROR: insufficient free disk space "
                  "({:.0f} MB free < {:.0f} MB required: 20MB x {} "
                  "renders + 1GB headroom)".format(
                      free_b / 1e6, need_b / 1e6, len(todo)))
            print("       ABORT before any render starts")
            return 1

    ok_n = fail_n = 0
    failed_ids = []
    t_all = time.time()
    cur = [None]
    try:
        for i, (vid, mpath) in enumerate(todo, 1):
            t0 = time.time()
            try:
                import tempfile
                props = {"data": json.load(open(mpath, encoding="utf-8"))}
                fd, ptmp = tempfile.mkstemp(suffix=".json",
                                            dir=os.environ.get(
                                                "TEMP", None))
                with os.fdopen(fd, "w", encoding="utf-8") as f:
                    json.dump(props, f, ensure_ascii=False)
                png_out = os.path.join(THUMB_DIR, vid + ".png")
                cmd = [
                    "node", CLI, "still", "thumbnail-card", png_out,
                    "--props=" + ptmp, "--frame=0",
                    "--browser-executable=" + chrome, "--log=error",
                ]
                proc = subprocess.Popen(cmd, cwd=REMOTION,
                                        stdout=subprocess.PIPE,
                                        stderr=subprocess.PIPE,
                                        text=True, errors="replace",
                                        creationflags=CREATE_NEW_PROCESS_GROUP)
                cur[0] = proc
                try:
                    _out, _err = proc.communicate(timeout=300)
                    r = subprocess.CompletedProcess(
                        cmd, proc.returncode, _out, _err)
                except subprocess.TimeoutExpired:
                    _taskkill(proc.pid)
                    _out, _err = proc.communicate()
                    raise RuntimeError("render timeout (tree killed)")
                finally:
                    cur[0] = None
                try:
                    os.remove(ptmp)
                except OSError:
                    pass
                size = os.path.getsize(png_out) if os.path.exists(png_out) else 0
                if r.returncode == 0 and size >= MIN_PNG_BYTES:
                    done[vid] = {"status": "done", "ts": time.time(),
                                 "bytes": size}
                    save_state({vid: done[vid]})
                    ok_n += 1
                    print("[{}/{}] OK  {} ({:.1f}s, {} KB)".format(
                        i, len(todo), vid, time.time() - t0, size // 1024))
                else:
                    raise RuntimeError("rc={} bytes={}\n{}".format(
                        r.returncode, size, (r.stderr or "")[-500:]))
            except Exception as e:
                done[vid] = {"status": "failed", "ts": time.time(),
                             "error": str(e)[:400]}
                save_state({vid: done[vid]})
                fail_n += 1
                failed_ids.append(vid)
                print("[{}/{}] FAIL {}".format(i, len(todo), vid))
                print("   ", str(e).replace("\n", " | ")[:400])
            time.sleep(0.1)
    except KeyboardInterrupt:
        p_ = cur[0]
        if p_ is not None and p_.poll() is None:
            _taskkill(p_.pid)
        print("\n=== ABORTED (Ctrl+C) - current render tree killed ===")
        return 2

    print("\n=== SUMMARY === {:.1f}s total | OK:{} FAIL:{} "
          "SKIP(done):{} ARCHIVED:{} UNMAPPED:{}".format(
              time.time() - t_all, ok_n, fail_n, len(skipped_done),
              len(skipped_archived), len(unmapped)))
    if failed_ids:
        print("failed ids:", ", ".join(failed_ids))
    return 1 if fail_n else 0


if __name__ == "__main__":
    sys.exit(main())
