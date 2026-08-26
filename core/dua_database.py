import os
import sys
import json
from typing import List, Dict, Optional, Any

# Ensure project root is in path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from core.project_info import PROJECT

# PILLAR 1 · additive optional schema fields. Legacy entries may omit them
# entirely; every consumer must treat absence as "use legacy behaviour".
OPTIONAL_SCHEMA_FIELDS = (
    'transliteration',    # roman pronunciation line (EndCard/kicker slot)
    'reference_source',   # e.g. 'Sahih Bukhari' | 'Quran'
    'reference_no',       # e.g. 375 | '2:152' (number or surah:ayah string)
)

# PILLAR 1 · expanded taxonomy ids. Legacy 8 category ids remain fully valid.
TAXONOMY_V2 = (
    'protection', 'rizq', 'forgiveness', 'morning_evening', 'guidance',
    'health', 'anxiety_relief', 'gratitude', 'family', 'occasions',
)
LEGACY_CATEGORIES = (
    'bathroom', 'sleep', 'food', 'travel', 'prayer', 'morning', 'evening',
    'general',
)


class DuaDatabase:
    """
    Handles loading and querying of Dua data from JSON files.
    Provides a clean interface for the CLI and GUI layers.
    """
    
    def __init__(self):
        """Loads duas.json and categories.json from the data directory."""
        self.data_dir = PROJECT.DATA_DIR
        self.duas_file = os.path.join(self.data_dir, "duas.json")
        self.categories_file = os.path.join(self.data_dir, "categories.json")
        
        self.duas: List[Dict[str, Any]] = []
        self.categories: List[Dict[str, Any]] = []
        
        self._load_data()
    
    def _load_data(self):
        """Internal method to load both JSON files."""
        # Load Duas
        try:
            with open(self.duas_file, 'r', encoding='utf-8') as f:
                data = json.load(f)
                # Handle nested format: {"duas": [...]}
                if isinstance(data, dict) and 'duas' in data:
                    self.duas = data['duas']
                else:
                    self.duas = data
            print(f"[DuaDatabase] Loaded {len(self.duas)} duas from {self.duas_file}")
        except FileNotFoundError:
            print(f"[DuaDatabase] Warning: Duas file not found at {self.duas_file}")
            self.duas = []
        except json.JSONDecodeError as e:
            print(f"[DuaDatabase] Error: Invalid JSON in duas file: {e}")
            self.duas = []
        
        # Load Categories
        try:
            with open(self.categories_file, 'r', encoding='utf-8') as f:
                data = json.load(f)
                # Handle nested format: {"categories": [...]}
                if isinstance(data, dict) and 'categories' in data:
                    self.categories = data['categories']
                else:
                    self.categories = data
            print(f"[DuaDatabase] Loaded {len(self.categories)} categories from {self.categories_file}")
        except FileNotFoundError:
            print(f"[DuaDatabase] Warning: Categories file not found at {self.categories_file}")
            self.categories = []
        except json.JSONDecodeError as e:
            print(f"[DuaDatabase] Error: Invalid JSON in categories file: {e}")
            self.categories = []

    def get_all_duas(self) -> List[Dict[str, Any]]:
        """Returns the list of all duas."""
        return self.duas

    def get_dua_by_id(self, dua_id: str) -> Optional[Dict[str, Any]]:
        """
        Finds a dua by its 'id' field.
        
        Args:
            dua_id: The unique identifier (e.g., 'bathroom_exit').
            
        Returns:
            Dua dict if found, else None.
        """
        for dua in self.duas:
            if dua.get('id') == dua_id:
                return dua
        return None

    def get_duas_by_category(self, category: str) -> List[Dict[str, Any]]:
        """
        Filters duas by category name.
        
        Args:
            category: Category name (e.g., 'bathroom', 'prayer').
            
        Returns:
            List of duas matching the category.
        """
        return [dua for dua in self.duas if dua.get('category') == category]

    def get_categories(self) -> List[Dict[str, Any]]:
        """Returns the list of all categories."""
        return self.categories

    def get_optional_field_coverage(self) -> Dict[str, int]:
        """
        PILLAR 1 · counts how many duas carry each additive optional field.
        Useful for migration progress reporting; always safe on legacy data.
        """
        return {
            field: sum(1 for d in self.duas if d.get(field))
            for field in OPTIONAL_SCHEMA_FIELDS
        }

    def get_category_names(self) -> List[str]:
        """Returns a simple list of category names (strings)."""
        return [cat.get('name') for cat in self.categories if cat.get('name')]

    def get_dua_summary(self) -> str:
        """
        Returns a human-readable summary of loaded data.
        Useful for CLI menus.
        """
        lines = [
            "=" * 50,
            "DUA DATABASE SUMMARY",
            "=" * 50,
            f"Total Duas      : {len(self.duas)}",
            f"Total Categories: {len(self.categories)}",
            "\nCategories & Counts:"
        ]
        
        for cat in self.categories:
            cat_id = cat.get('id', 'unknown')
            count = len(self.get_duas_by_category(cat_id))
            cat_name = cat.get('name', cat_id)
            lines.append(f"  - {cat_name}: {count} duas")
        
        lines.append("=" * 50)
        return "\n".join(lines)

    def test(self):
        """Runs a comprehensive test of the database."""
        print("Testing Dua Database...")
        
        # 1. Check loaded counts
        print(f"Loaded {len(self.duas)} duas and {len(self.categories)} categories.")
        
        # 2. Print summary
        print(self.get_dua_summary())
        
        # 3. Test get_by_id
        if self.duas:
            first_dua = self.duas[0]
            dua_id = first_dua.get('id')
            if dua_id:
                found = self.get_dua_by_id(dua_id)
                if found:
                    print(f"  [OK] get_dua_by_id('{dua_id}') -> Found")
                else:
                    print(f"  [FAIL] get_dua_by_id('{dua_id}') -> Not Found")
        
        # 4. Test category filter
        if self.categories:
            first_cat_id = self.categories[0].get('id')
            if first_cat_id:
                filtered = self.get_duas_by_category(first_cat_id)
                print(f"  [OK] get_duas_by_category('{first_cat_id}') -> {len(filtered)} duas found")
        
        # 5. Verify path integrity
        print(f"  [INFO] Data directory: {self.data_dir}")
        print("  [OK] Test complete.")


# Create a singleton instance for easy import
DB = DuaDatabase()

if __name__ == "__main__":
    DB.test()
