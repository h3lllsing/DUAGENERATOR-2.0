import logging
import os
import json
from typing import List, Dict, Optional, Any

logger = logging.getLogger(__name__)

from core.project_info import PROJECT


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
            logger.info(f"Loaded {len(self.duas)} duas from {self.duas_file}")
        except FileNotFoundError:
            logger.warning(f"Duas file not found at {self.duas_file}")
            self.duas = []
        except json.JSONDecodeError as e:
            logger.error(f"Invalid JSON in duas file: {e}")
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
            logger.info(f"Loaded {len(self.categories)} categories from {self.categories_file}")
        except FileNotFoundError:
            logger.warning(f"Categories file not found at {self.categories_file}")
            self.categories = []
        except json.JSONDecodeError as e:
            logger.error(f"Invalid JSON in categories file: {e}")
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


# Create a singleton instance for easy import
DB = DuaDatabase()
