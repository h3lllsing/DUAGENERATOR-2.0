"""
Restore Script for Dua Video Generator
Restores vault, salt, tokens, and critical config files from backup.
"""

import shutil
import json
from pathlib import Path

PROJECT = Path(__file__).resolve().parent.parent
BACKUP_DIR = PROJECT / "backups"

def restore_backup(backup_name=None):
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
    if manifest_path.exists():
        manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
        print(f"Restoring from: {manifest['timestamp']}")
        for item in manifest.get("files", []):
            print(item)
    else:
        print(f"Restoring from: {backup_path.name}")
    
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
    import sys
    
    if len(sys.argv) > 1 and sys.argv[1] == "list":
        list_backups()
    elif len(sys.argv) > 2 and sys.argv[1] == "restore":
        restore_backup(sys.argv[2])
    else:
        print("Usage:")
        print("  python restore.py list           - List available backups")
        print("  python restore.py restore [name] - Restore from backup")
        print("  python restore.py restore        - Restore latest backup")
