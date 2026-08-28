import logging
import os
import re
import subprocess
import numpy as np

import imageio_ffmpeg
from moviepy import AudioFileClip, concatenate_audioclips

logger = logging.getLogger(__name__)

try:
    import config
except Exception:
    logger.debug("config not available for audio mixer")
    config = None

# AUDIO-001: 48 kHz PCM/WAV downstream intermediate (lossless; single AAC at end)
# PILLAR 2: broadcast retarget - platform anchor -14 LUFS / -1.0 dBTP
DEFAULT_SAMPLE_RATE = 48000
LOUDNESS_TARGET = -14.0   # LUFS integrated (YouTube Shorts / TikTok anchor)
TRUE_PEAK_TARGET = -1.0   # dBTP ceiling
LRA_TARGET = 11.0


class AudioMixer:
    """
    Handles merging of multiple audio files (Arabic + Urdu) into a single track.
    Currently supports sequential concatenation (Arabic plays first, then Urdu).
    Also computes the VIDEO-002 duration policy (15-25 seconds) from speech audio.
    """
    
    @staticmethod
    def compute_video_timeline(
        speech_duration: float,
        min_duration: float = None,
        max_duration: float = None,
        default_hold: float = 0.5,
    ) -> dict:
        """
        Compute the final video duration and visual hold from spoken audio duration.

        VIDEO-002 duration policy:
          A) speech < min_duration  -> pad with VISUAL hold so final == min_duration
          B) min <= speech+hold <= max -> valid (hold shrinks as speech approaches max)
          C) speech > max_duration  -> hard failure (speech must NEVER be cut)
          D) final outside [min, max]  -> hard failure

        Speech is never stretched, duplicated, or truncated. Padding is visual
        hold only (silence appended to the audio track by the caller via
        pad_to_duration in merge_audio_sequential).

        Args:
            speech_duration: Duration of the merged spoken audio (Arabic+gap+Urdu).
            min_duration: Minimum video duration (default: config VIDEO_MIN_DURATION=15).
            max_duration: Maximum video duration (default: config VIDEO_MAX_DURATION=50).
            default_hold: Preferred visual hold applied when speech is within range.

        Returns:
            dict: {"valid": bool, "final_duration": float|None,
                   "visual_hold": float, "reason": str}
        """
        if min_duration is None:
            min_duration = float(getattr(config, "VIDEO_MIN_DURATION", 15))
        if max_duration is None:
            max_duration = float(getattr(config, "VIDEO_MAX_DURATION", 50))

        if speech_duration < 0:
            return {
                "valid": False, "final_duration": None, "visual_hold": 0.0,
                "reason": f"Invalid speech duration: {speech_duration}",
            }

        # Case C: speech itself exceeds the maximum -> hard failure, never cut speech.
        if speech_duration > max_duration:
            return {
                "valid": False, "final_duration": None, "visual_hold": 0.0,
                "reason": (
                    f"Speech duration {speech_duration:.2f}s exceeds the maximum "
                    f"{max_duration:.2f}s. Spoken audio cannot be cut. "
                    "Shorten the dua text or split it into separate videos."
                ),
            }

        # Case A: speech below minimum -> pad visual hold up to the minimum.
        if speech_duration < min_duration:
            hold = min_duration - speech_duration
            final_duration = min_duration
            reason = (
                f"padded: speech {speech_duration:.2f}s + visual hold {hold:.2f}s "
                f"(final {final_duration:.2f}s)"
            )
        else:
            # Case B: speech within range -> add default hold, but never exceed max.
            hold = min(default_hold, max_duration - speech_duration)
            hold = max(0.0, hold)
            final_duration = speech_duration + hold
            reason = (
                f"speech {speech_duration:.2f}s + visual hold {hold:.2f}s "
                f"(final {final_duration:.2f}s)"
            )

        # Case D: safety net for any float edge cases.
        eps = 1e-6
        if not (min_duration - eps <= final_duration <= max_duration + eps):
            return {
                "valid": False, "final_duration": None, "visual_hold": 0.0,
                "reason": (
                    f"Final duration {final_duration:.2f}s is outside the required "
                    f"{min_duration:.2f}-{max_duration:.2f}s window."
                ),
            }

        return {
            "valid": True,
            "final_duration": round(final_duration, 6),
            "visual_hold": round(hold, 6),
            "reason": reason,
        }
    
    @staticmethod
    def _get_sample_rate(sample_rate):
        if sample_rate:
            return sample_rate
        return int(getattr(config, "AUDIO_SAMPLE_RATE", DEFAULT_SAMPLE_RATE))

    @staticmethod
    def merge_audio_sequential(
        audio_paths: list,
        output_path: str,
        gap_seconds: float = 0.5,
        pad_to_duration: float = None,
        sample_rate: int = None,
    ) -> bool:
        """
        Merges multiple audio files one after another with a small gap.

        AUDIO-001: downstream intermediates are lossless 48 kHz stereo
        PCM/WAV (pcm_s16le). Speech is never stretched, duplicated, or
        re-encoded to a lossy format here.

        Args:
            audio_paths: List of paths to audio files (e.g., ['ar.mp3', 'ur.mp3']).
            output_path: Path for the final merged .wav file.
            gap_seconds: Silence gap between clips (in seconds).
            pad_to_duration: If set, append trailing silence so the merged track
                             reaches exactly this duration (VIDEO-002 visual
                             hold; speech is never stretched or duplicated).
            sample_rate: Target sample rate (default: config AUDIO_SAMPLE_RATE).

        Returns:
            bool: True if successful, False otherwise.
        """
        try:
            sample_rate = AudioMixer._get_sample_rate(sample_rate)

            # Ensure temp directory exists
            os.makedirs(os.path.dirname(output_path), exist_ok=True)
            
            clips = []
            for path in audio_paths:
                if os.path.exists(path):
                    clip = AudioFileClip(path, fps=sample_rate)
                    clips.append(clip)
                    
                    # Add a silent gap after each clip except the last
                    if gap_seconds > 0 and len(clips) < len(audio_paths):
                        clips.append(AudioMixer._make_silence(gap_seconds, sample_rate))
                else:
                    logger.warning(f"Audio file not found: {path}")
            
            if not clips:
                logger.error("No valid audio clips to merge.")
                return False
            
            # VIDEO-002: append trailing silence so the track reaches the target
            # duration. This creates the visual-hold window; speech is unchanged.
            if pad_to_duration is not None:
                speech_duration = sum(c.duration for c in clips)
                if pad_to_duration > speech_duration + 1e-6:
                    hold = pad_to_duration - speech_duration
                    logger.info(f"Padding track with {hold:.2f}s trailing "
                                f"silence (speech {speech_duration:.2f}s -> "
                                f"{pad_to_duration:.2f}s)")
                    clips.append(AudioMixer._make_silence(hold, sample_rate))
                elif pad_to_duration < speech_duration - 1e-6:
                    logger.warning(f"pad_to_duration {pad_to_duration:.2f}s "
                                   f"is shorter than speech {speech_duration:.2f}s; "
                                   "speech will NOT be trimmed.")
            
            # Concatenate all clips
            final_clip = concatenate_audioclips(clips)
            
            # Write lossless PCM/WAV (AUDIO-001: no lossy re-encode here)
            final_clip.write_audiofile(
                output_path,
                codec='pcm_s16le',
                fps=sample_rate,
                logger=None
            )
            
            # Clean up
            for clip in clips:
                clip.close()
            final_clip.close()
            
            logger.info(f"Successfully merged audio to: {output_path}")
            return True
            
        except Exception as e:
            logger.error(f"Error merging audio: {e}")
            import traceback
            traceback.print_exc()
            return False

    @staticmethod
    def measure_loudness(input_path: str) -> dict:
        """
        Measure EBU R128 loudness of an audio file using the bundled ffmpeg
        (loudnorm, print_format=json). Pure measurement; nothing is written.

        Returns:
            dict with input_i (LUFS), input_tp (dBTP), input_lra, input_thresh,
            target_offset, or an empty dict on failure.
        """
        try:
            ffmpeg = imageio_ffmpeg.get_ffmpeg_exe()
            cmd = [
                ffmpeg, "-hide_banner", "-i", input_path,
                "-af", "loudnorm=I=%s:TP=%s:LRA=%s:print_format=json"
                       % (LOUDNESS_TARGET, TRUE_PEAK_TARGET, LRA_TARGET),
                "-f", "null", "-",
            ]
            result = subprocess.run(
                cmd, capture_output=True, text=True,
                encoding="utf-8", errors="replace", timeout=120,
            )
            out = {}
            for key in ("input_i", "input_tp", "input_lra", "input_thresh",
                        "target_offset"):
                m = re.search(r'"%s"\s*:\s*"(-?[\d.]+)"' % key, result.stderr)
                if m:
                    out[key] = float(m.group(1))
            return out
        except Exception as e:
            logger.error(f"Loudness measurement failed: {e}")
            return {}

    @staticmethod
    def normalize_loudness(input_path: str, output_path: str,
                           sample_rate: int = None) -> tuple:
        """
        AUDIO-001: two-pass LINEAR ffmpeg loudnorm.

        Pass 1 measures EBU R128 loudness (print_format=json). Pass 2 applies
        a LINEAR gain (linear=true with measured values) targeting
        LOUDNESS_TARGET (-14 LUFS) integrated and TRUE_PEAK_TARGET (-1 dBTP)
        true peak. Linear mode preserves sample positions exactly, so speech
        duration and WordBoundary timing are unchanged. Dynamic loudnorm is
        never used.

        Returns:
            (bool ok, dict measured_out). measured_out contains the measured
            loudness of the OUTPUT file (input_i/input_tp of the result).
        """
        try:
            sample_rate = AudioMixer._get_sample_rate(sample_rate)
            ffmpeg = imageio_ffmpeg.get_ffmpeg_exe()

            measured = AudioMixer.measure_loudness(input_path)
            if not measured.get("input_i"):
                logger.warning("loudnorm measure failed; skipping normalization.")
                return False, {}

            # Pass 2: linear gain with measured values (no dynamic compression).
            af = (
                "loudnorm=I=%s:TP=%s:LRA=%s:measured_I=%s:measured_TP=%s:"
                "measured_LRA=%s:measured_thresh=%s:offset=%s:linear=true"
                % (LOUDNESS_TARGET, TRUE_PEAK_TARGET, LRA_TARGET,
                   measured["input_i"], measured["input_tp"],
                   measured["input_lra"], measured["input_thresh"],
                   measured.get("target_offset", 0))
            )
            cmd = [
                ffmpeg, "-y", "-hide_banner", "-loglevel", "error",
                "-i", input_path, "-af", af,
                "-ar", str(sample_rate), "-ac", "2",
                "-c:a", "pcm_s16le", output_path,
            ]
            result = subprocess.run(
                cmd, capture_output=True, text=True,
                encoding="utf-8", errors="replace", timeout=300,
            )
            if result.returncode != 0 or not os.path.exists(output_path):
                logger.error(f"loudnorm apply failed: {result.stderr[-400:]}")
                return False, {}

            logger.info(f"Loudness normalized "
                        f"{measured['input_i']:.1f} LUFS -> {LOUDNESS_TARGET:.0f} LUFS")
            return True, AudioMixer.measure_loudness(output_path)
        except Exception as e:
            logger.error(f"Normalization error: {e}")
            return False, {}

    @staticmethod
    def _make_silence(duration: float, sample_rate: int = DEFAULT_SAMPLE_RATE):
        """Create a silent stereo audio clip of the given duration."""
        from moviepy import AudioClip

        def make_silence(t):
            return np.zeros(2)  # Stereo silence

        return AudioClip(
            make_silence,
            duration=duration,
            fps=sample_rate
        )

    @staticmethod
    def test():
        """
        Integration test: Uses previously generated test_ar.mp3 and test_ur.mp3 
        to create a merged audio file.
        """
        print("Testing Audio Mixer...")
        
        ar_path = "temp/test_ar.mp3"
        ur_path = "temp/test_ur.mp3"
        output_path = "temp/test_merged.mp3"
        
        # Check if test files exist
        if not os.path.exists(ar_path):
            print(f"  Error: {ar_path} not found. Run tts_engine.py test first.")
            return False
        if not os.path.exists(ur_path):
            print(f"  Error: {ur_path} not found. Run tts_engine.py test first.")
            return False
        
        # Merge them
        success = AudioMixer.merge_audio_sequential(
            [ar_path, ur_path], 
            output_path,
            gap_seconds=0.5
        )
        
        if success and os.path.exists(output_path):
            size = os.path.getsize(output_path) / 1024
            print(f"  [OK] Merged audio saved: {output_path} ({size:.1f} KB)")
            print("  [CHECK] Play this file. You should hear Arabic, a 0.5s pause, then Urdu.")
        else:
            print("  [FAIL] Merged audio creation failed.")
        
        return success


if __name__ == "__main__":
    AudioMixer.test()
