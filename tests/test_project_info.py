"""
Tests for core.project_info module
"""

import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from core.project_info import PROJECT, ProjectInfo


class TestProjectInfo:
    """Test ProjectInfo dataclass and PROJECT singleton."""

    def test_default_dimensions(self):
        assert PROJECT.VIDEO_WIDTH == 1080
        assert PROJECT.VIDEO_HEIGHT == 1920

    def test_fps(self):
        assert PROJECT.FPS == 30

    def test_directories_exist(self):
        assert os.path.isdir(PROJECT.OUTPUT_DIR)
        assert os.path.isdir(PROJECT.TEMP_DIR)
        assert os.path.isdir(PROJECT.ASSETS_DIR)
        assert os.path.isdir(PROJECT.DATA_DIR)
        assert os.path.isdir(PROJECT.FONTS_DIR)
        assert os.path.isdir(PROJECT.LOGS_DIR)

    def test_directories_are_absolute(self):
        assert os.path.isabs(PROJECT.OUTPUT_DIR)
        assert os.path.isabs(PROJECT.TEMP_DIR)
        assert os.path.isabs(PROJECT.ASSETS_DIR)
        assert os.path.isabs(PROJECT.DATA_DIR)
        assert os.path.isabs(PROJECT.FONTS_DIR)
        assert os.path.isabs(PROJECT.LOGS_DIR)

    def test_project_root_is_absolute(self):
        assert os.path.isabs(PROJECT.PROJECT_ROOT)

    def test_abs_path_resolves(self):
        relative = "output"
        result = PROJECT._abs_path(relative)
        assert os.path.isabs(result)
        assert result.endswith("output")

    def test_absolute_path_passthrough(self):
        absolute = "/tmp/test/output"
        result = PROJECT._abs_path(absolute)
        assert result == absolute

    def test_get_summary_contains_fields(self):
        summary = PROJECT.get_summary()
        assert "Dua Video Generator" in summary
        assert "0.10.0" in summary
        assert "1080" in summary
        assert "1920" in summary
        assert "30" in summary

    def test_singleton_consistency(self):
        # PROJECT is a module-level instance, not a true singleton
        # Just verify it exists and has correct values
        assert PROJECT.VIDEO_WIDTH == 1080
        assert PROJECT.FPS == 30

    def test_custom_dimensions(self):
        custom = ProjectInfo(VIDEO_WIDTH=720, VIDEO_HEIGHT=1280, FPS=30)
        assert custom.VIDEO_WIDTH == 720
        assert custom.VIDEO_HEIGHT == 1280
        assert custom.FPS == 30

    def test_voices(self):
        assert PROJECT.VOICE_AR == "ar-SA-HamedNeural"
        assert PROJECT.VOICE_UR == "ur-PK-AsadNeural"

    def test_channel_name(self):
        assert PROJECT.CHANNEL_NAME == "@bushranasir1075"
