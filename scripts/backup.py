"""
Backup Script for Dua Video Generator
Backs up vault, salt, tokens, and critical config files.
"""

import hashlib
import json
import shutil
from datetime import datetime
from pathlib import Path

PROJECT = Path(__file__).resolve().parent.parent
BACKUP_DIR = PROJECT / "backups"
DATA_DIR = PROJECT / "data"
SECURITY_DIR = PROJECT / "security"
REMOTION_DIR = PROJECT / "remotion"

# Files to backup
BACKUP_FILES = [
    # Security
    ("security/salt.bin", "Security salt"),
    ("remotion/dashboard/auth.json", "Dashboard auth token"),
    ("remotion/dashboard/config.json", "Dashboard config"),
    # YouTube tokens (if exist)
    ("data/yt_token_main.json", "YouTube main token"),
    ("data/yt_token_secondary.json", "YouTube secondary token"),
    # Data
    ("data/duas.json", "Duas database"),
    ("data/categories.json", "Categories database"),
]

def compute_checksum(file_path):
    """Compute SHA-256 checksum of a file."""
    sha256_hash = hashlib.sha256()
    try:
        with open(file_path, "rb") as f:
            for byte_block in iter(lambda: f.read(4096), b""):
                sha256_hash.update(byte_block)
        return sha256_hash.hexdigest()
    except Exception:
        return None

def create_backup():
    """Create timestamped backup."""
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    backup_path = BACKUP_DIR / f"backup_{timestamp}"
    backup_path.mkdir(parents=True, exist_ok=True)

    backed_up = []
    checksums = {}
    for rel_path, description in BACKUP_FILES:
        src = PROJECT / rel_path
        if src.exists():
            dst = backup_path / rel_path
            dst.parent.mkdir(parents=True, exist_ok=True)
            shutil.copy2(src, dst)
            checksum = compute_checksum(dst)
            checksums[rel_path] = checksum
            backed_up.append(f"  ✓ {description}: {rel_path}")
        else:
            backed_up.append(f"  - {description}: {rel_path} (not found)")

    # Save backup manifest
    manifest = {
        "timestamp": timestamp,
        "files": backed_up,
        "checksums": checksums,
        "project": str(PROJECT)
    }
    (backup_path / "manifest.json").write_text(
        json.dumps(manifest, indent=2), encoding="utf-8"
    )

    print(f"Backup created: {backup_path}")
    print("Files backed up:")
    for item in backed_up:
        print(item)

    return backup_path

def list_backups():
    """List available backups."""
    if not BACKUP_DIR.exists():
        print("No backups found.")
        return

    backups = sorted(BACKUP_DIR.iterdir())
    if not backups:
        print("No backups found.")
        return

    print("Available backups:")
    for backup in backups:
        if backup.is_dir():
            manifest = backup / "manifest.json"
            if manifest.exists():
                data = json.loads(manifest.read_text(encoding="utf-8"))
                print(f"  {backup.name} - {data['timestamp']}")
            else:
                print(f"  {backup.name}")

def rotate_backups(max_backups=10):
    """Keep only the most recent backups."""
    if not BACKUP_DIR.exists():
        return

    backups = sorted([d for d in BACKUP_DIR.iterdir() if d.is_dir()])
    if len(backups) <= max_backups:
        return

    to_delete = backups[:len(backups) - max_backups]
    for backup in to_delete:
        shutil.rmtree(backup)
        print(f"  Rotated old backup: {backup.name}")

if __name__ == "__main__":
    import sys

    if len(sys.argv) > 1 and sys.argv[1] == "list":
        list_backups()
    else:
        create_backup()
        rotate_backups()
