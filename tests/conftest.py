"""
Shared pytest fixtures for DuaVideoGenerator test suite.
"""

import sys
import os
import pytest

# Add project root to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from core.project_info import PROJECT


@pytest.fixture
def project():
    """Return the PROJECT singleton instance."""
    return PROJECT


@pytest.fixture
def tmp_dir(tmp_path):
    """Return a temporary directory for test artifacts."""
    return tmp_path


@pytest.fixture
def sample_image():
    """Return a 1080x1920 RGB test image."""
    from PIL import Image
    return Image.new('RGB', (1080, 1920), (20, 25, 35))


@pytest.fixture
def sample_rgba_image():
    """Return a 1080x1920 RGBA test image with transparency."""
    from PIL import Image
    return Image.new('RGBA', (1080, 1920), (20, 25, 35, 200))


@pytest.fixture
def sample_frames(sample_image):
    """Return a list of 10 test frames."""
    return [sample_image.copy() for _ in range(10)]


@pytest.fixture
def sample_dua_data():
    """Return sample dua data for testing."""
    return {
        "id": "test_dua_001",
        "category": "morning",
        "arabic": "بِسْمِ اللَّهِ الرَّحْمَنِ الرَّحِيمِ",
        "urdu": "اللہ کے نام سے شروع جو بڑا مہربان نہایت رحم والا ہے",
        "title": "Bismillah",
        "translation": "In the name of Allah, the Most Gracious, the Most Merciful"
    }
