import os
import subprocess
import sys
import numpy as np
from typing import List, Optional, Union
from PIL import Image

# Ensure project root is in path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import imageio
import imageio_ffmpeg
from moviepy import VideoFileClip, AudioFileClip, CompositeVideoClip

try:
    import config
except Exception:
    config = None


class VideoBuilder:
    """
    Assembles frames into a video and syncs audio.
    Uses imageio for fast frame writing and moviepy for audio mixing.
    """
    
    def __init__(self, fps: int = 24, resolution: tuple = (1080, 1920)):
        """
        Args:
            fps: Frames per second (YouTube Shorts standard is 24 or 30).
            resolution: (width, height) for output video.
        """
        self.fps = fps
        self.width, self.height = resolution

    def _mux_direct(self, video_path: str, audio_path: str,
                    output_path: str) -> bool:
        """
        AUDIO-001: mux the already-encoded temp video with the final audio
        using the bundled ffmpeg. The video stream is COPIED (-c:v copy), so
        there is no second x264 encode; the audio is encoded once to AAC at
        48 kHz / configurable bitrate. The existing video-vs-audio trim guard
        is preserved.
        """
        try:
            sample_rate = int(getattr(config, "AUDIO_SAMPLE_RATE", 48000))
            bitrate = str(getattr(config, "AUDIO_BITRATE", "192k"))
            ffmpeg = imageio_ffmpeg.get_ffmpeg_exe()

            # Trim guard (matches previous behavior): if lengths differ, the
            # longer stream is trimmed to the shorter one.
            trim_arg = []
            with VideoFileClip(video_path) as vc, AudioFileClip(audio_path) as ac:
                vdur, adur = vc.duration, ac.duration
            if vdur > adur:
                print(f"[VideoBuilder] Trimming video from {vdur:.2f}s "
                      f"to {adur:.2f}s")
                trim_arg = ["-t", f"{adur:.4f}"]
            elif adur > vdur:
                print(f"[VideoBuilder] Trimming audio from {adur:.2f}s "
                      f"to {vdur:.2f}s")
                trim_arg = ["-t", f"{vdur:.4f}"]

            cmd = [
                ffmpeg, "-y", "-hide_banner", "-loglevel", "error",
                "-i", video_path, "-i", audio_path,
            ] + trim_arg + [
                "-map", "0:v:0", "-map", "1:a:0",
                "-c:v", "copy",
                "-c:a", "aac", "-b:a", bitrate,
                "-ar", str(sample_rate), "-ac", "2",
                output_path,
            ]
            result = subprocess.run(
                cmd, capture_output=True, text=True,
                encoding="utf-8", errors="replace", timeout=300,
            )
            if result.returncode != 0 or not os.path.exists(output_path):
                print(f"[VideoBuilder] ffmpeg mux failed: {result.stderr[-500:]}")
                return False
            print(f"[VideoBuilder] Muxed video (video copied, audio {bitrate} "
                  f"{sample_rate} Hz AAC): {output_path}")
            return True
        except Exception as e:
            print(f"[VideoBuilder] Direct mux error: {e}")
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
            print("[VideoBuilder] Error: No frames provided.")
            return False

        try:
            # Step 1: Convert PIL images to numpy arrays if needed
            print(f"[VideoBuilder] Processing {len(frames)} frames...")
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
                        print(f"[VideoBuilder] Warning: Frame {i} shape mismatch. Expected ({self.height}, {self.width}) got {frame.shape[:2]}")
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
            print(f"[VideoBuilder] Writing temporary video: {temp_video_path}")
            with imageio.get_writer(
                temp_video_path, 
                fps=self.fps, 
                format='FFMPEG', 
                codec='libx264', 
                pixelformat='yuv420p',
                macro_block_size=1,
                ffmpeg_params=['-crf', '15', '-b:v', '4000k']
            ) as writer:
                for frame in numpy_frames:
                    writer.append_data(frame)
            
            print(f"[VideoBuilder] Temp video created successfully.")

            # Step 4: Add audio if provided (AUDIO-001 direct mux, no re-encode)
            if audio_path and os.path.exists(audio_path):
                print(f"[VideoBuilder] Adding audio: {audio_path}")
                if not self._mux_direct(temp_video_path, audio_path,
                                        output_path):
                    print("[VideoBuilder] Audio mixing failed. "
                          "Falling back to video without audio.")
                    import shutil
                    shutil.copy2(temp_video_path, output_path)

                # Delete temp video
                if os.path.exists(temp_video_path):
                    os.remove(temp_video_path)
            else:
                # No audio: just rename/move temp file
                import shutil
                print(f"[VideoBuilder] No audio provided. Saving final video: {output_path}")
                shutil.copy2(temp_video_path, output_path)
                if os.path.exists(temp_video_path):
                    os.remove(temp_video_path)

            print(f"[VideoBuilder] [PASS] Video built successfully: {output_path}")
            return True

        except Exception as e:
            print(f"[VideoBuilder] Critical Error: {e}")
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
        except:
            pass
        
        frames = [test_img] * 24  # 1 second at 24fps
        
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
