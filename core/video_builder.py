import logging
import os
import subprocess
import numpy as np
from typing import List, Optional, Union
from PIL import Image

import imageio
import imageio_ffmpeg
from moviepy import VideoFileClip, AudioFileClip, CompositeVideoClip

logger = logging.getLogger(__name__)

try:
    import config
except Exception:
    logger.debug("config not available, using defaults")
    config = None


class VideoBuilder:
    """
    Assembles frames into a video and syncs audio.
    Uses imageio for fast frame writing and moviepy for audio mixing.
    """
    
    def __init__(self, fps: int = 60, resolution: tuple = (1080, 1920)):
        """
        Args:
            fps: Frames per second (60fps for smooth YouTube Shorts playback).
            resolution: (width, height) for output video.
        """
        self.fps = fps
        self.width, self.height = resolution

        # Load FFmpeg encoding config from config.py
        self.crf = getattr(config, "FFMPEG_CRF", 15) if config else 15
        self.preset = getattr(config, "FFMPEG_PRESET", "slow") if config else "slow"
        self.profile = getattr(config, "FFMPEG_PROFILE", "high") if config else "high"
        self.level = getattr(config, "FFMPEG_LEVEL", "4.1") if config else "4.1"
        self.gop = getattr(config, "FFMPEG_GOP", 30) if config else 30
        self.movflags = getattr(config, "FFMPEG_MOVFLAGS", "+faststart") if config else "+faststart"
        self.pix_fmt = getattr(config, "FFMPEG_PIX_FMT", "yuv420p") if config else "yuv420p"
        self.sharpen = getattr(config, "FFMPEG_SHARPEN", True) if config else True
        self.color_grade = getattr(config, "FFMPEG_COLOR_GRADE", True) if config else True
        self.loudness = getattr(config, "FFMPEG_LOUDNESS", True) if config else True

    def _mux_direct(self, video_path: str, audio_path: str,
                    output_path: str) -> bool:
        """
        AUDIO-001 + Phase 2: Mux video + audio with full post-processing.
        Re-encodes video with YouTube-optimized settings + sharpening + 
        color grading + loudness normalization in a single FFmpeg pass.
        """
        try:
            sample_rate = int(getattr(config, "AUDIO_SAMPLE_RATE", 48000))
            bitrate = str(getattr(config, "AUDIO_BITRATE", "192k"))
            ffmpeg = imageio_ffmpeg.get_ffmpeg_exe()

            # Trim guard
            trim_arg = []
            with VideoFileClip(video_path) as vc, AudioFileClip(audio_path) as ac:
                vdur, adur = vc.duration, ac.duration
            if vdur > adur:
                trim_arg = ["-t", f"{adur:.4f}"]
            elif adur > vdur:
                trim_arg = ["-t", f"{vdur:.4f}"]

            # Build video filter chain for post-processing
            vf_parts = []
            if self.sharpen:
                vf_parts.append("unsharp=5:5:0.8:3:3:0.4")
            if self.color_grade:
                vf_parts.append("eq=saturation=1.15:contrast=1.05:brightness=0.02")
            vf_str = ",".join(vf_parts) if vf_parts else None

            # Build audio filter for loudness normalization
            af_str = None
            if self.loudness:
                af_str = "loudnorm=I=-14:TP=-1.5:LRA=11"

            cmd = [
                ffmpeg, "-y", "-hide_banner", "-loglevel", "error",
                "-i", video_path, "-i", audio_path,
            ] + trim_arg + [
                "-map", "0:v:0", "-map", "1:a:0",
            ]

            # Video: re-encode with YouTube-optimized settings
            cmd += [
                "-c:v", "libx264",
                "-crf", str(self.crf),
                "-preset", self.preset,
                "-profile:v", self.profile,
                "-level:v", self.level,
                "-pix_fmt", self.pix_fmt,
                "-g", str(self.gop),
                "-movflags", self.movflags,
                "-bf", "2",
                "-coder", "1",
            ]
            if vf_str:
                cmd += ["-vf", vf_str]

            # Audio: AAC with optional loudness normalization
            cmd += [
                "-c:a", "aac", "-b:a", bitrate,
                "-ar", str(sample_rate), "-ac", "2",
            ]
            if af_str:
                cmd += ["-af", af_str]

            cmd += [output_path]

            result = subprocess.run(
                cmd, capture_output=True, text=True,
                encoding="utf-8", errors="replace", timeout=600,
            )
            if result.returncode != 0 or not os.path.exists(output_path):
                logger.error(f"ffmpeg mux failed: {result.stderr[-500:]}")
                return False
            file_size = os.path.getsize(output_path) / (1024 * 1024)
            logger.info(f"Muxed+enhanced video (CRF {self.crf}, {self.preset}, "
                        f"{self.profile}, {file_size:.1f}MB): {output_path}")
            return True
        except Exception as e:
            logger.error(f"Direct mux error: {e}")
            return False

    def build_video(
        self,
        frames: List[Union[Image.Image, np.ndarray]],
        output_path: str,
        audio_path: Optional[str] = None,
        temp_video_path: Optional[str] = None
    ) -> bool:
        """
        Converts a list of PIL images or numpy arrays into an MP4 video.
        
        Args:
            frames: List of PIL Image objects or numpy arrays (RGB).
            output_path: Full path for the final .mp4 file.
            audio_path: Optional path to .mp3 audio file to add.
            temp_video_path: Optional path for temp video (without audio). 
                             If None, uses output_path with '_temp' suffix.
        
        Returns:
            bool: True if successful, False otherwise.
        """
        if not frames:
            logger.error("No frames provided.")
            return False

        try:
            # Step 1: Convert PIL images to numpy arrays if needed
            logger.info(f"Processing {len(frames)} frames...")
            numpy_frames = []
            for i, frame in enumerate(frames):
                if isinstance(frame, Image.Image):
                    # Ensure RGB and resize to exact dimensions
                    if frame.size != (self.width, self.height):
                        frame = frame.resize((self.width, self.height), Image.Resampling.LANCZOS)
                    numpy_frames.append(np.array(frame))
                elif isinstance(frame, np.ndarray):
                    # Ensure correct shape
                    if frame.shape[:2] != (self.height, self.width):
                        logger.warning(f"Frame {i} shape mismatch. Expected ({self.height}, {self.width}) got {frame.shape[:2]}")
                    numpy_frames.append(frame)
                else:
                    raise TypeError(f"Unsupported frame type: {type(frame)}")
            
            # Step 2: Determine temp video path
            if temp_video_path is None:
                base, ext = os.path.splitext(output_path)
                temp_video_path = f"{base}_temp{ext}"

            # bare filenames have no directory component -> use cwd
            out_dir = os.path.dirname(output_path) or "."
            tmp_dir = os.path.dirname(temp_video_path) or "."
            os.makedirs(out_dir, exist_ok=True)
            os.makedirs(tmp_dir, exist_ok=True)

            # Step 3: Write video WITHOUT audio using imageio
            # Phase 2: Use raw frames, re-encoding happens in _mux_direct
            logger.info(f"Writing temporary video: {temp_video_path}")
            with imageio.get_writer(
                temp_video_path, 
                fps=self.fps, 
                format='FFMPEG', 
                codec='libx264', 
                pixelformat='yuv420p',
                macro_block_size=2,
                ffmpeg_params=[
                    '-crf', '10',        # Near-lossless intermediate (re-encode in mux)
                    '-preset', 'ultrafast',  # Fast intermediate, quality in mux pass
                    '-g', '30',          # GOP = half of 60fps
                ]
            ) as writer:
                for frame in numpy_frames:
                    writer.append_data(frame)
            
            logger.info("Temp video created successfully.")

            # Step 4: Add audio if provided (AUDIO-001 direct mux, no re-encode)
            if audio_path and os.path.exists(audio_path):
                logger.info(f"Adding audio: {audio_path}")
                if not self._mux_direct(temp_video_path, audio_path,
                                        output_path):
                    logger.error("Audio mixing failed. "
                                 "Falling back to video without audio.")
                    import shutil
                    shutil.copy2(temp_video_path, output_path)

                # Delete temp video
                if os.path.exists(temp_video_path):
                    os.remove(temp_video_path)
            else:
                # No audio: just rename/move temp file
                import shutil
                logger.info(f"No audio provided. Saving final video: {output_path}")
                shutil.copy2(temp_video_path, output_path)
                if os.path.exists(temp_video_path):
                    os.remove(temp_video_path)

            logger.info(f"Video built successfully: {output_path}")
            return True

        except Exception as e:
            logger.error(f"Critical error building video: {e}")
            import traceback
            traceback.print_exc()
            return False

    def test(self):
        """
        Full integration test: Creates a dummy video (1 second) with a test frame,
        and attempts to mix it with the previously generated TTS audio.
        """
        print("Testing Video Builder (Full Pipeline)...")
        os.makedirs("temp", exist_ok=True)
        
        # 1. Create a dummy frame (1080x1920 dark background with some text)
        test_img = Image.new('RGB', (1080, 1920), color=(20, 25, 35))
        from PIL import ImageDraw, ImageFont
        draw = ImageDraw.Draw(test_img)
        try:
            font_path = os.path.join("assets", "fonts", "NotoNaskhArabic-Regular.ttf")
            if os.path.exists(font_path):
                font = ImageFont.truetype(font_path, 100)
            else:
                font = ImageFont.load_default()
            draw.text((540, 960), "Test Video", font=font, fill=(255, 215, 0), anchor="mm")
        except Exception:
            logger.debug("Font load skipped, using default")
            pass
        
        frames = [test_img] * 60  # 1 second at 60fps
        
        # 2. Paths
        video_path = "temp/test_video.mp4"
        audio_path = "temp/test_ar.mp3"  # Arabic test audio from TASK 2
        
        # 3. Build video
        success = self.build_video(frames, video_path, audio_path)
        
        if success and os.path.exists(video_path):
            size = os.path.getsize(video_path) / 1024
            print(f"[PASS] Test Video generated successfully: temp/test_video.mp4 ({size:.1f} KB)")
        else:
            print("[FAIL] Test Video generation failed.")
        
        return success


if __name__ == "__main__":
    builder = VideoBuilder()
    builder.test()
