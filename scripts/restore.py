"""
Restore Script for Dua Video Generator
Restores vault, salt, tokens, and critical config files from backup.
"""

import json
import shutil
import sys
from datetime import datetime
from pathlib import Path

PROJECT = Path(__file__).resolve().parent.parent
BACKUP_DIR = PROJECT / "backups"

def auto_backup():
    """Create automatic backup before restore."""
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    backup_path = BACKUP_DIR / f"pre_restore_{timestamp}"
    backup_path.mkdir(parents=True, exist_ok=True)

    # Import backup files list from backup module
    sys.path.insert(0, str(PROJECT / "scripts"))
    try:
        from backup import BACKUP_FILES
    except ImportError:
        BACKUP_FILES = [
            ("security/salt.bin", "Security salt"),
            ("remotion/dashboard/auth.json", "Dashboard auth token"),
            ("remotion/dashboard/config.json", "Dashboard config"),
            ("data/duas.json", "Duas database"),
        ]

    backed_up = 0
    for rel_path, description in BACKUP_FILES:
        src = PROJECT / rel_path
        if src.exists():
            dst = backup_path / rel_path
            dst.parent.mkdir(parents=True, exist_ok=True)
            shutil.copy2(src, dst)
            backed_up += 1

    # Save manifest
    manifest = {
        "timestamp": timestamp,
        "type": "pre_restore",
        "files_count": backed_up
    }
    (backup_path / "manifest.json").write_text(
        json.dumps(manifest, indent=2), encoding="utf-8"
    )

    print(f"Auto-backup created: {backup_path.name} ({backed_up} files)")
    return backup_path

def restore_backup(backup_name=None, force=False):
    """Restore from a backup. If no name given, restore latest."""
    if not BACKUP_DIR.exists():
        print("No backups directory found.")
        return False

    if backup_name:
        backup_path = BACKUP_DIR / backup_name
    else:
        # Find latest backup
        backups = sorted([d for d in BACKUP_DIR.iterdir() if d.is_dir()])
        if not backups:
            print("No backups found.")
            return False
        backup_path = backups[-1]

    if not backup_path.exists():
        print(f"Backup not found: {backup_path}")
        return False

    # Load manifest
    manifest_path = backup_path / "manifest.json"
    files_to_restore = []
    if manifest_path.exists():
        manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
        print(f"Restoring from: {manifest['timestamp']}")
        files_to_restore = manifest.get("files", [])
        for item in files_to_restore:
            print(f"  - {item}")
    else:
        print(f"Restoring from: {backup_path.name}")

    # Confirmation prompt
    if not force:
        file_count = len([f for f in backup_path.rglob("*") if f.is_file() and f.name != "manifest.json"])
        print(f"\nThis will overwrite {file_count} files in the project.")
        confirm = input("Are you sure? (y/N): ").strip().lower()
        if confirm != 'y':
            print("Restore cancelled.")
            return False

    # Auto-backup current state before restore
    print("\nCreating auto-backup of current state...")
    auto_backup()

    # Restore files
    restored = 0
    for item in backup_path.rglob("*"):
        if item.is_file() and item.name != "manifest.json":
            rel = item.relative_to(backup_path)
            dst = PROJECT / rel
            dst.parent.mkdir(parents=True, exist_ok=True)
            shutil.copy2(item, dst)
            restored += 1
            print(f"  Restored: {rel}")

    print(f"\nRestored {restored} files.")
    return True

def list_backups():
    """List available backups."""
    if not BACKUP_DIR.exists():
        print("No backups found.")
        return

    backups = sorted([d for d in BACKUP_DIR.iterdir() if d.is_dir()])
    if not backups:
        print("No backups found.")
        return

    print("Available backups:")
    for backup in backups:
        manifest = backup / "manifest.json"
        if manifest.exists():
            data = json.loads(manifest.read_text(encoding="utf-8"))
            print(f"  {backup.name} - {data['timestamp']}")
        else:
            print(f"  {backup.name}")

if __name__ == "__main__":
    if len(sys.argv) > 1 and sys.argv[1] == "list":
        list_backups()
    elif len(sys.argv) > 2 and sys.argv[1] == "restore":
        restore_backup(sys.argv[2], force="--yes" in sys.argv)
    elif len(sys.argv) > 1 and sys.argv[1] == "restore":
        restore_backup(force="--yes" in sys.argv)
    else:
        print("Usage:")
        print("  python restore.py list           - List available backups")
        print("  python restore.py restore [name] - Restore from backup")
        print("  python restore.py restore        - Restore latest backup")
        print("  python restore.py restore --yes  - Restore without confirmation")
