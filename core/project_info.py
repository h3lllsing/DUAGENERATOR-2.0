import os
import sys
from dataclasses import dataclass
from typing import Optional

# Ensure project root is in path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

try:
    import config
except ImportError:
    config = None


@dataclass
class ProjectInfo:
    """
    Centralized metadata and configuration for the Dua Video Generator.
    Loads settings from config.py if available, otherwise uses defaults.
    """
    
    # Core Metadata
    PROJECT_NAME: str = "Dua Video Generator"
    VERSION: str = "1.0.0"
    CHANNEL_NAME: str = "@bushranasir1075"
    AUTHOR: str = "MASOOD NASIR"
    
    # Video Standards
    VIDEO_WIDTH: int = 1080
    VIDEO_HEIGHT: int = 1920
    FPS: int = 24
    
    # Folder Paths (Relative to project root)
    PROJECT_ROOT: str = ""
    OUTPUT_DIR: str = "output"
    TEMP_DIR: str = "temp"
    ASSETS_DIR: str = "assets"
    DATA_DIR: str = "data"
    FONTS_DIR: str = "assets/fonts"
    LOGS_DIR: str = "logs"
    
    # TTS Voices
    VOICE_AR: str = "ar-SA-HamedNeural"
    VOICE_UR: str = "ur-PK-AsadNeural"
    
    def __post_init__(self):
        """Auto-calculate absolute paths relative to project root."""
        if not self.PROJECT_ROOT:
            # Get the directory where this file is located (core folder), then go up one level
            self.PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
        
        # Convert relative paths to absolute
        self.OUTPUT_DIR = self._abs_path(self.OUTPUT_DIR)
        self.TEMP_DIR = self._abs_path(self.TEMP_DIR)
        self.ASSETS_DIR = self._abs_path(self.ASSETS_DIR)
        self.DATA_DIR = self._abs_path(self.DATA_DIR)
        self.FONTS_DIR = self._abs_path(self.FONTS_DIR)
        self.LOGS_DIR = self._abs_path(self.LOGS_DIR)
        
        # Create all directories if they don't exist
        for dir_path in [self.OUTPUT_DIR, self.TEMP_DIR, self.ASSETS_DIR, 
                         self.DATA_DIR, self.FONTS_DIR, self.LOGS_DIR]:
            os.makedirs(dir_path, exist_ok=True)

    def _abs_path(self, relative_path: str) -> str:
        """Convert a relative path to absolute based on PROJECT_ROOT."""
        if os.path.isabs(relative_path):
            return relative_path
        return os.path.join(self.PROJECT_ROOT, relative_path)

    def get_summary(self) -> str:
        """Return a human-readable summary of the project settings."""
        lines = [
            "=" * 50,
            f"Project   : {self.PROJECT_NAME}",
            f"Version   : {self.VERSION}",
            f"Channel   : {self.CHANNEL_NAME}",
            f"Author    : {self.AUTHOR}",
            f"Video     : {self.VIDEO_WIDTH}x{self.VIDEO_HEIGHT} @ {self.FPS}fps",
            f"Voices    : Arabic({self.VOICE_AR}), Urdu({self.VOICE_UR})",
            f"Root      : {self.PROJECT_ROOT}",
            f"Output    : {self.OUTPUT_DIR}",
            f"Temp      : {self.TEMP_DIR}",
            "=" * 50
        ]
        return "\n".join(lines)

    def test(self):
        """Simple test to verify metadata and paths are correct."""
        print("Testing Project Info...")
        
        # Print summary
        print(self.get_summary())
        
        # Verify critical directories
        missing_dirs = []
        for dir_name, dir_path in [
            ("Output", self.OUTPUT_DIR),
            ("Temp", self.TEMP_DIR),
            ("Fonts", self.FONTS_DIR),
            ("Data", self.DATA_DIR)
        ]:
            if os.path.exists(dir_path):
                print(f"  [OK] {dir_name}: {dir_path}")
            else:
                print(f"  [MISSING] {dir_name}: {dir_path}")
                missing_dirs.append(dir_name)
        
        if missing_dirs:
            print(f"Warning: Directories missing: {', '.join(missing_dirs)}")
        else:
            print("All directories verified successfully.")

        # Check config integration
        if config:
            print("Config module loaded successfully.")
        else:
            print("Config module not found. Using built-in defaults.")


# Create a singleton instance for easy import
PROJECT = ProjectInfo()

if __name__ == "__main__":
    PROJECT.test()
