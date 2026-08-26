"""
Asset Registry (VISUAL Phase 1).

Loads the approved background-asset manifest, verifies SHA-256 checksums,
enforces license/approval policy, and provides deterministic category-based
background selection seeded by dua_id. Falls back to a procedural background
when no approved asset is loadable.

Nothing is downloaded, generated, or written here; this is a read-only
approval gate + selector for local background images.
"""

import hashlib
import json
import os
import random
import sys
from dataclasses import dataclass, field
from typing import Dict, List, Optional

# Ensure project root is in path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from core.project_info import PROJECT

try:
    import config
except Exception:
    config = None


# Licenses acceptable for monetization-safe use. Assets with any other
# license (or none) are NEVER loadable regardless of the approved flag.
ALLOWED_LICENSES = frozenset({
    "CC0",
    "CC-BY",
    "CC-BY-SA",
    "PUBLIC DOMAIN",
    "PROJECT-OWNED",
})


def normalize_license(license_name) -> str:
    """Normalize a license string for comparison (uppercase, whitespace-folded)."""
    if not license_name:
        return ""
    return " ".join(str(license_name).strip().upper().split())


def _license_base(license_name: str) -> str:
    """First token of a normalized license (e.g. 'CC-BY' from 'CC-BY 4.0')."""
    return license_name.split()[0] if license_name else ""


@dataclass
class BackgroundAsset:
    """A single background image described by the manifest."""

    id: str
    file: str
    categories: List[str] = field(default_factory=list)
    license: str = ""
    checksum_sha256: str = ""
    approved: bool = False
    resolution_width: int = 0
    resolution_height: int = 0
    source_url: str = ""
    author: str = ""
    notes: str = ""

    @property
    def license_valid(self) -> bool:
        lic = normalize_license(self.license)
        return lic in ALLOWED_LICENSES or _license_base(lic) in ALLOWED_LICENSES

    def resolve_path(self, backgrounds_dir: str) -> str:
        return os.path.join(backgrounds_dir, self.file)


class AssetRegistry:
    """
    Manifest loader + approval gate + deterministic selector.

    An asset is LOADABLE only when ALL of the following hold:
      - approved == True in the manifest
      - license is non-empty and in ALLOWED_LICENSES
      - checksum_sha256 is present and matches the file's SHA-256
      - the referenced file exists on disk
    """

    MANIFEST_NAME = "manifest.json"
    SCHEMA_VERSION = 1

    def __init__(self, manifest_path: Optional[str] = None,
                 backgrounds_dir: Optional[str] = None):
        if backgrounds_dir is None:
            backgrounds_dir = (
                getattr(config, "BACKGROUNDS_DIR", None)
                or os.path.join(PROJECT.ASSETS_DIR, "backgrounds")
            )
        if manifest_path is None:
            manifest_path = os.path.join(backgrounds_dir, self.MANIFEST_NAME)
        self.backgrounds_dir = os.path.abspath(backgrounds_dir)
        self.manifest_path = os.path.abspath(manifest_path)
        self.manifest_error: Optional[str] = None
        self._raw: Optional[dict] = None
        self._assets: List[BackgroundAsset] = []
        self.load_manifest()

    # ------------------------------------------------------------------
    # Manifest loading / parsing
    # ------------------------------------------------------------------
    def load_manifest(self) -> None:
        """Load and parse the manifest. Never raises; failures are recorded."""
        self._assets = []
        self._raw = None
        self.manifest_error = None

        if not os.path.exists(self.manifest_path):
            self.manifest_error = f"Manifest not found: {self.manifest_path}"
            return

        try:
            with open(self.manifest_path, "r", encoding="utf-8") as f:
                self._raw = json.load(f)
        except Exception as e:
            self.manifest_error = f"Manifest parse failed: {e}"
            return

        if not isinstance(self._raw, dict):
            self.manifest_error = "Manifest root must be a JSON object."
            return

        items = self._raw.get("assets", [])
        if not isinstance(items, list):
            self.manifest_error = "Manifest 'assets' must be a list."
            return

        for entry in items:
            asset = self._parse_entry(entry)
            if asset is not None:
                self._assets.append(asset)

    @staticmethod
    def _parse_entry(entry) -> Optional[BackgroundAsset]:
        """Parse one manifest entry into a BackgroundAsset (skip if invalid)."""
        if not isinstance(entry, dict):
            return None
        asset_id = str(entry.get("id", "")).strip()
        file_name = str(entry.get("file", "")).strip()
        if not asset_id or not file_name:
            return None

        categories = entry.get("categories", [])
        if isinstance(categories, str):
            categories = [categories]
        categories = [str(c).strip() for c in categories if str(c).strip()]

        resolution = entry.get("resolution", {})
        res_w = int(resolution.get("width", 0)) if isinstance(resolution, dict) else 0
        res_h = int(resolution.get("height", 0)) if isinstance(resolution, dict) else 0

        return BackgroundAsset(
            id=asset_id,
            file=file_name,
            categories=categories,
            license=str(entry.get("license", "")).strip(),
            checksum_sha256=str(entry.get("checksum_sha256", "")).strip().lower(),
            approved=bool(entry.get("approved", False)),
            resolution_width=res_w,
            resolution_height=res_h,
            source_url=str(entry.get("source_url", "")).strip(),
            author=str(entry.get("author", "")).strip(),
            notes=str(entry.get("notes", "")).strip(),
        )

    # ------------------------------------------------------------------
    # Asset listing / verification
    # ------------------------------------------------------------------
    def get_assets(self) -> List[BackgroundAsset]:
        """All parsed assets (regardless of approval)."""
        return list(self._assets)

    def checksum(self, asset: BackgroundAsset) -> str:
        """SHA-256 (lowercase hex) of the asset file, or '' if unreadable."""
        path = asset.resolve_path(self.backgrounds_dir)
        try:
            digest = hashlib.sha256()
            with open(path, "rb") as f:
                for chunk in iter(lambda: f.read(65536), b""):
                    digest.update(chunk)
            return digest.hexdigest().lower()
        except OSError:
            return ""

    def verify_checksum(self, asset: BackgroundAsset) -> bool:
        """True only when the manifest checksum matches the on-disk file."""
        if not asset.checksum_sha256:
            return False
        return self.checksum(asset) == asset.checksum_sha256

    def is_loadable(self, asset: BackgroundAsset) -> bool:
        """
        Approval gate: approved + valid license + present checksum +
        existing file + checksum match. Only assets passing ALL of these
        are ever selectable.
        """
        if not asset.approved:
            return False
        if not asset.license_valid:
            return False
        if not asset.checksum_sha256:
            return False
        path = asset.resolve_path(self.backgrounds_dir)
        if not os.path.isfile(path):
            return False
        return self.verify_checksum(asset)

    def get_loadable_assets(self) -> List[BackgroundAsset]:
        """Only assets that pass the full approval gate."""
        return [a for a in self._assets if self.is_loadable(a)]

    # ------------------------------------------------------------------
    # Deterministic category-based selection
    # ------------------------------------------------------------------
    @staticmethod
    def _category_score(asset: BackgroundAsset, category: Optional[str]) -> int:
        cat = (category or "").strip().lower()
        asset_cats = {c.lower() for c in asset.categories}
        if not cat:
            return 1  # no category constraint: any approved asset is eligible
        score = 0
        if cat in asset_cats:
            score += 3
        if "general" in asset_cats:
            score += 1
        return score

    def select_background(self, dua_id: str, category: Optional[str] = None,
                          exclude_ids=(), preferred_theme: Optional[str] = None) -> dict:
        """
        Deterministically choose a background for a dua.

        - Seed is derived from dua_id (reproducible across runs).
        - Assets are scored by category match (specific > general).
        - Among the best-scoring loadable assets, one is picked by the seed.
        - If no loadable asset matches (or none exists), returns a
          procedural fallback with a deterministic theme.

        Returns:
            dict with kind "asset"  -> {kind, asset_id, path, license, reason}
            dict with kind "procedural" -> {kind, theme, reason}
        """
        dua_id = (dua_id or "default").strip()
        excluded = set(exclude_ids or ())

        candidates = [a for a in self.get_loadable_assets()
                      if a.id not in excluded]

        if candidates:
            scored = [(self._category_score(a, category), a) for a in candidates]
            best_score = max(score for score, _ in scored)
            if best_score > 0:
                pool = [a for score, a in scored if score == best_score]
                rng = random.Random(dua_id)
                rng.shuffle(pool)
                chosen = pool[0]
                return {
                    "kind": "asset",
                    "asset_id": chosen.id,
                    "path": chosen.resolve_path(self.backgrounds_dir),
                    "license": chosen.license,
                    "reason": (
                        f"Selected approved background '{chosen.id}' "
                        f"(category score {best_score})."
                    ),
                }
            reason = (
                f"No approved background matches the dua category "
                f"'{category or 'general'}'; using procedural fallback."
            )
        else:
            reason = ("No approved background assets are loadable; "
                      "using procedural fallback.")

        theme = self._pick_theme(dua_id, preferred_theme)
        return {"kind": "procedural", "theme": theme, "reason": reason}

    def _pick_theme(self, dua_id: str, preferred_theme: Optional[str] = None) -> str:
        """Deterministically pick a procedural theme seeded by dua_id."""
        themes = list(getattr(config, "THEMES", {}) or {})
        if preferred_theme and preferred_theme in themes:
            return preferred_theme
        if not themes:
            return "dark"
        rng = random.Random(f"{dua_id}:theme")
        rng.shuffle(themes)
        return themes[0]