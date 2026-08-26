"""
Dua Video Generator - Main Orchestrator
End-to-end pipeline for generating dua videos
"""

import os
import re
import sys
import time

# Ensure project root is in path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from core.project_info import PROJECT
from core.dua_database import DB
from core.tts_engine import TTSEngine
from core.audio_mixer import AudioMixer
from core.effects_engine import EffectsEngine as EffectEngine
from core.video_builder import VideoBuilder
from core.revamp_engine import RevampEngine
from core.quality_checker import QualityChecker
from core.metadata_generator import MetadataGenerator
from core.self_trainer import SelfTrainer
from core.video_analyzer import VideoAnalyzer
from core.scene_engine import SceneRenderer
from core.timeline_builder import TimelineBuilder
from core.effect_director import EffectDirector, premium_palette
from moviepy import AudioFileClip


def dua_video_filename(dua) -> str:
    """
    Compute the output MP4 filename for a dua from its title.
    Keeps the file name readable on PC (title based) and strips
    characters that are invalid in Windows file names.
    """
    title = str(dua.get('title') or 'Dua').strip() or 'Dua'
    safe = re.sub(r'[<>:"/\\|?*\x00-\x1f]+', '', title).strip() or 'Dua'
    safe = re.sub(r'\.mp4$', '', safe, flags=re.IGNORECASE).rstrip('. ')
    return f"{safe}.mp4"


class DuaVideoPipeline:
    """
    End-to-end pipeline to generate a Dua video from start to finish.
    """
    
    def __init__(self):
        """Initialize pipeline components."""
        self.tts = TTSEngine()
        self.effect_engine = EffectEngine()
        self.director = EffectDirector(fps=PROJECT.FPS,
                                       canvas=(PROJECT.VIDEO_WIDTH,
                                               PROJECT.VIDEO_HEIGHT))
        self.video_builder = VideoBuilder()
        self.revamp_engine = RevampEngine()
        self.quality_checker = QualityChecker()
        self.metadata_generator = MetadataGenerator()
        self.self_trainer = SelfTrainer()
        self.video_analyzer = VideoAnalyzer()
        self.temp_dir = PROJECT.TEMP_DIR
        self.output_dir = PROJECT.OUTPUT_DIR
        self._cancel_requested = False
        os.makedirs(self.temp_dir, exist_ok=True)
        os.makedirs(self.output_dir, exist_ok=True)

    def _prepare_audio_track(self, ar_audio: str, ur_audio: str,
                             merged_audio: str, gap_seconds: float = 0.3):
        """
        Merge spoken audio, apply the VIDEO-002 duration policy (15-25s), and
        pad the audio track with trailing silence to match the final video
        duration so the video builder never trims visual hold time.

        AUDIO-001: downstream audio is lossless 48 kHz WAV; the SPEECH-ONLY
        track is loudness-normalized (two-pass LINEAR loudnorm, -16 LUFS /
        -1.5 dBTP) BEFORE VIDEO-002 padding, so the hold silence is never
        normalized and speech timing is preserved.

        Speech is never stretched, duplicated, or truncated.

        Returns:
            dict {"final_duration", "visual_hold", "reason"} on success, or
            None on hard failure (speech exceeding the maximum duration).
        """
        if not AudioMixer.merge_audio_sequential(
                [ar_audio, ur_audio], merged_audio, gap_seconds=gap_seconds):
            print("Failed to merge audio.")
            return None

        speech_clip = AudioFileClip(merged_audio)
        speech_duration = speech_clip.duration
        speech_clip.close()

        timeline = AudioMixer.compute_video_timeline(speech_duration)
        if not timeline["valid"]:
            print(f"Error: {timeline['reason']}")
            return None

        final_duration = timeline["final_duration"]

        # AUDIO-001: normalize speech BEFORE padding (never the hold silence).
        base, ext = os.path.splitext(merged_audio)
        normalized_audio = f"{base}.normalized{ext}"
        if AudioMixer.normalize_loudness(merged_audio, normalized_audio):
            src = [normalized_audio]
            gap = 0.0
        else:
            print("[AUDIO-001] Loudness normalization unavailable; "
                  "proceeding with unnormalized audio.")
            src = [ar_audio, ur_audio]
            gap = gap_seconds

        if not AudioMixer.merge_audio_sequential(
                src, merged_audio, gap_seconds=gap,
                pad_to_duration=final_duration):
            print("Failed to pad audio track with visual hold.")
            return None

        if os.path.exists(normalized_audio):
            try:
                os.remove(normalized_audio)
            except OSError:
                pass

        print(f"[2/5] Audio ready. {timeline['reason']}")
        return timeline

    def _enforce_quality_gate(self, quality_results: dict) -> bool:
        """
        VIDEO-002 hard gate. Resolution (VIDEO-001), duration (15-25s), and
        FPS (exactly 24) failures abort generation. Other checks (e.g. file
        size) remain advisory.
        """
        if quality_results["valid"]:
            print("Quality check passed!")
            return True

        print("Quality check failed:")
        for issue in quality_results["issues"]:
            print(f"  - {issue}")
        info = quality_results.get("video_info", {})
        width = info.get("width", 0)
        height = info.get("height", 0)
        duration = info.get("duration", 0)
        fps = info.get("fps", 0)

        if not self.quality_checker.validate_resolution(width, height):
            print("Error: Video resolution is not exactly 1080x1920. "
                  "Generation FAILED.")
            return False
        if not self.quality_checker.validate_duration(duration):
            print(f"Error: Video duration {duration:.1f}s is outside the required "
                  f"15-25 second window. Generation FAILED.")
            return False
        if not self.quality_checker.validate_fps(fps):
            print(f"Error: Video FPS {fps:.1f} is not exactly 24. "
                  "Generation FAILED.")
            return False
        return True

    def generate_video(self, dua_id: str, theme: str = "dark",
                       effect: str = "auto") -> bool:
        """
        Main entry point: Takes a Dua ID and generates the final MP4.
        """
        print(f"\n{'='*50}")
        print(f"STARTING GENERATION FOR: {dua_id}")
        print(f"{'='*50}\n")
        start_time = time.time()
        self._cancel_requested = False

        # 1. Fetch Dua Data
        dua_data = DB.get_dua_by_id(dua_id)
        if not dua_data:
            print(f"Error: Dua with ID '{dua_id}' not found in database.")
            return False
        
        category = dua_data.get('category', 'general')
        arabic_text = dua_data.get('arabic', '')
        urdu_text = dua_data.get('urdu', '')
        title = dua_data.get('title', 'Dua')
        
        print(f"Category    : {category}")
        print(f"Title       : {title}")
        print(f"Arabic      : [Arabic text loaded]")
        print(f"Urdu        : [Urdu text loaded]")

        # 2. Generate TTS (Arabic + Urdu)
        # Word-boundary timing is captured (optional, backward compatible) to
        # prepare future audio-synchronized highlighting; it never blocks audio.
        print("\n[1/5] Generating TTS...")
        ar_audio = os.path.join(self.temp_dir, f"{dua_id}_ar.mp3")
        ur_audio = os.path.join(self.temp_dir, f"{dua_id}_ur.mp3")
        ar_timing = os.path.join(self.temp_dir, f"{dua_id}_ar_timing.jsonl")
        ur_timing = os.path.join(self.temp_dir, f"{dua_id}_ur_timing.jsonl")

        # STYLE-ROTATION: explicit per-dua override wins, else pool rotation
        ar_voice = dua_data.get('voice_arabic') or self.tts.pick_voice(dua_id, 'ar')
        ur_voice = dua_data.get('voice_urdu') or self.tts.pick_voice(dua_id, 'ur')
        print(f"Arabic voice : {ar_voice}")
        print(f"Urdu voice   : {ur_voice}")

        if not self.tts.generate_audio(arabic_text, 'ar', ar_audio,
                                       timing_path=ar_timing, voice=ar_voice):
            print("Failed to generate Arabic TTS.")
            return False
        if not self.tts.generate_audio(urdu_text, 'ur', ur_audio,
                                       timing_path=ur_timing, voice=ur_voice):
            print("Failed to generate Urdu TTS.")
            return False
        print("[1/5] TTS Generated.")
        if self._cancel_requested:
            print("Generation cancelled by user.")
            return False

        # 3. Merge Audio + apply VIDEO-002 duration policy (15-25s, padded hold)
        print("\n[2/5] Merging Audio...")
        merged_audio = os.path.join(self.temp_dir, f"{dua_id}_merged.wav")
        timeline = self._prepare_audio_track(ar_audio, ur_audio, merged_audio,
                                             gap_seconds=0.3)
        if timeline is None:
            return False
        duration_seconds = timeline["final_duration"]
        print(f"[2/5] Video duration target: {duration_seconds:.2f}s")
        if self._cancel_requested:
            print("Generation cancelled by user.")
            return False

        # 4. Generate Frames (TimelineBuilder + SceneEngine, VISUAL Phase 3)
        #    Audio is immutable; the visual timeline adapts to measured TTS
        #    durations + VIDEO-002 final_duration. Speech text is never altered.
        print("\n[3/5] Generating frames (this takes time)...")
        ar_dur = TTSEngine.get_audio_duration(ar_audio)
        ur_dur = TTSEngine.get_audio_duration(ur_audio)

        # VISUAL Phase 4: WordBoundary sidecars drive word highlighting.
        # Missing/corrupt sidecars simply disable highlighting (never blocks).
        ar_words = TTSEngine.parse_word_boundaries(ar_timing)
        ur_words = TTSEngine.parse_word_boundaries(ur_timing)

        plan = TimelineBuilder(fps=PROJECT.FPS).build(
            dua_id=dua_id,
            arabic_text=arabic_text,
            urdu_text=urdu_text,
            title=title,
            arabic_duration=ar_dur,
            urdu_duration=ur_dur,
            final_duration=duration_seconds,
            category=category,
            palette=premium_palette(dua_id),
            word_events={"arabic": ar_words, "urdu": ur_words},
        )
        if not plan["valid"]:
            print(f"Error: TimelineBuilder failed: {plan['reason']}")
            return False

        frames = SceneRenderer(fps=PROJECT.FPS).render(
            plan["timeline"], seed=dua_id)
        print(f"[3/5] Frames generated: {len(frames)}")

        # Optional visual effect post-processing (frame-level).
        # "auto" + the new AI effects use the EffectDirector brain; legacy
        # effect names keep the original frame-level path for compatibility.
        if effect and effect != "none":
            if effect in ("auto", "bloom_glow", "gold_shimmer", "breathing",
                          "rtl_reveal", "glitch_v2", "word_pulse"):
                fxplan = self.director.plan(
                    dua_data, plan,
                    {"arabic": ar_words, "urdu": ur_words},
                    effect_request=effect, dua_id=dua_id)
                frames = self.effect_engine.apply_plan(frames, fxplan["frame_plan"])
                print(f"[3/5] Effect applied: {effect}")
                print(f"      {fxplan['summary']}")
            else:
                frames = self.effect_engine.apply_to_frames(frames, effect)
                print(f"[3/5] Effect applied: {effect}")
        if self._cancel_requested:
            print("Generation cancelled by user.")
            return False

        # 5. Build Video
        print("\n[4/5] Assembling video...")
        output_category_dir = os.path.join(self.output_dir, category)
        os.makedirs(output_category_dir, exist_ok=True)
        output_path = os.path.join(output_category_dir, dua_video_filename(dua_data))
        
        success = self.video_builder.build_video(
            frames=frames,
            output_path=output_path,
            audio_path=merged_audio
        )
        
        if not success:
            print("Failed to build video.")
            return False
        print(f"[4/5] Video assembled.")
        if self._cancel_requested:
            print("Generation cancelled by user.")
            return False

        # 6. Quality Check (VIDEO-002 hard gate: resolution + duration + FPS)
        print("\n[5/5] Quality check...")
        quality_results = self.quality_checker.check_video(output_path)
        
        if not self._enforce_quality_gate(quality_results):
            return False
        
        # 7. Generate Metadata
        metadata = self.metadata_generator.generate(arabic_text, urdu_text, category)
        
        elapsed = time.time() - start_time
        print(f"\n{'='*50}")
        print(f"[SUCCESS] Video saved to:")
        print(f"   {output_path}")
        print(f"   Duration: {duration_seconds:.2f}s")
        print(f"   Size: {os.path.getsize(output_path) / 1024:.1f} KB")
        print(f"   Time Taken: {elapsed:.1f}s")
        print(f"\nYouTube Metadata:")
        print(f"   Title: {metadata['title']}")
        print(f"   Tags: {len(metadata['tags'])} tags")
        print(f"{'='*50}\n")
        return True

    def generate_custom_video(self, arabic_text: str, urdu_text: str,
                              title: str = "", effect: str = "neon_glow") -> bool:
        """
        Generate video from custom dua input.
        
        Args:
            arabic_text: Arabic dua text
            urdu_text: Urdu translation
            title: Optional title
            effect: Effect to use
            
        Returns:
            True if successful
        """
        print(f"\n{'='*50}")
        print(f"GENERATING CUSTOM DUA VIDEO")
        print(f"{'='*50}\n")
        start_time = time.time()
        
        # Local AI agent removed: category uses the deterministic safe default.
        category = "general"
        
        # Generate TTS
        print("\n[1/5] Generating TTS...")
        ar_audio = os.path.join(self.temp_dir, "custom_ar.mp3")
        ur_audio = os.path.join(self.temp_dir, "custom_ur.mp3")
        ar_timing = os.path.join(self.temp_dir, "custom_ar_timing.jsonl")
        ur_timing = os.path.join(self.temp_dir, "custom_ur_timing.jsonl")
        
        if not self.tts.generate_audio(arabic_text, 'ar', ar_audio, timing_path=ar_timing):
            print("Failed to generate Arabic TTS.")
            return False
        if not self.tts.generate_audio(urdu_text, 'ur', ur_audio, timing_path=ur_timing):
            print("Failed to generate Urdu TTS.")
            return False
        print("[1/5] TTS Generated.")
        
        # Merge Audio + apply VIDEO-002 duration policy (15-25s, padded hold)
        print("\n[2/5] Merging Audio...")
        merged_audio = os.path.join(self.temp_dir, "custom_merged.wav")
        timeline = self._prepare_audio_track(ar_audio, ur_audio, merged_audio,
                                             gap_seconds=0.3)
        if timeline is None:
            return False
        duration_seconds = timeline["final_duration"]
        print(f"[2/5] Video duration target: {duration_seconds:.2f}s")
        
        # Generate Frames (TimelineBuilder + SceneEngine, VISUAL Phase 3)
        #    Audio is immutable; the visual timeline adapts to measured TTS
        #    durations + VIDEO-002 final_duration. Speech text is never altered.
        print("\n[3/5] Generating frames (this takes time)...")
        ar_dur = TTSEngine.get_audio_duration(ar_audio)
        ur_dur = TTSEngine.get_audio_duration(ur_audio)

        # VISUAL Phase 4: WordBoundary sidecars drive word highlighting.
        # Missing/corrupt sidecars simply disable highlighting (never blocks).
        ar_words = TTSEngine.parse_word_boundaries(ar_timing)
        ur_words = TTSEngine.parse_word_boundaries(ur_timing)

        plan = TimelineBuilder(fps=PROJECT.FPS).build(
            dua_id="custom",
            arabic_text=arabic_text,
            urdu_text=urdu_text,
            title=title,
            arabic_duration=ar_dur,
            urdu_duration=ur_dur,
            final_duration=duration_seconds,
            category=category,
            palette=premium_palette("custom"),
            word_events={"arabic": ar_words, "urdu": ur_words},
        )
        if not plan["valid"]:
            print(f"Error: TimelineBuilder failed: {plan['reason']}")
            return False

        frames = SceneRenderer(fps=PROJECT.FPS).render(
            plan["timeline"], seed="custom")
        print(f"[3/5] Frames generated: {len(frames)}")

        # Optional visual effect post-processing (frame-level).
        if effect and effect != "none":
            dua_data = {"id": "custom", "category": category,
                        "arabic": arabic_text, "urdu": urdu_text,
                        "title": title or "Custom Dua"}
            if effect in ("auto", "bloom_glow", "gold_shimmer", "breathing",
                          "rtl_reveal", "glitch_v2", "word_pulse"):
                fxplan = self.director.plan(
                    dua_data, plan,
                    {"arabic": ar_words, "urdu": ur_words},
                    effect_request=effect, dua_id="custom")
                frames = self.effect_engine.apply_plan(frames, fxplan["frame_plan"])
                print(f"[3/5] Effect applied: {effect}")
                print(f"      {fxplan['summary']}")
            else:
                frames = self.effect_engine.apply_to_frames(frames, effect)
                print(f"[3/5] Effect applied: {effect}")
        
        # Build Video
        print("\n[4/5] Assembling video...")
        custom_dir = os.path.join(self.output_dir, "custom")
        os.makedirs(custom_dir, exist_ok=True)
        
        import datetime
        timestamp = datetime.datetime.now().strftime("%Y%m%d_%H%M%S")
        output_path = os.path.join(custom_dir, f"custom_{timestamp}.mp4")
        
        success = self.video_builder.build_video(
            frames=frames,
            output_path=output_path,
            audio_path=merged_audio
        )
        
        if not success:
            print("Failed to build video.")
            return False
        print(f"[4/5] Video assembled.")
        
        # Quality Check (VIDEO-002 hard gate: resolution + duration + FPS)
        print("\n[5/5] Quality check...")
        quality_results = self.quality_checker.check_video(output_path)
        
        if not self._enforce_quality_gate(quality_results):
            return False
        
        # Generate Metadata
        metadata = self.metadata_generator.generate(arabic_text, urdu_text, category)
        
        # Save metadata
        metadata_path = os.path.join(custom_dir, f"metadata_{timestamp}.json")
        self.metadata_generator.save_metadata(metadata, metadata_path)
        
        elapsed = time.time() - start_time
        print(f"\n{'='*50}")
        print(f"[SUCCESS] Video saved to:")
        print(f"   {output_path}")
        print(f"   Duration: {duration_seconds:.2f}s")
        print(f"   Size: {os.path.getsize(output_path) / 1024:.1f} KB")
        print(f"   Time Taken: {elapsed:.1f}s")
        print(f"\nYouTube Metadata:")
        print(f"   Title: {metadata['title']}")
        print(f"   Tags: {len(metadata['tags'])} tags generated")
        print(f"   Hashtags: {len(metadata['hashtags'])} hashtags generated")
        print(f"\nMetadata saved to: {metadata_path}")
        print(f"{'='*50}\n")
        return True

    def scan_sample_videos(self):
        """Scan sample videos to learn visual styles."""
        print(f"\n{'='*50}")
        print("SCANNING SAMPLE VIDEOS")
        print(f"{'='*50}")
        print(f"\nPlace your sample videos in: {self.video_analyzer.samples_dir}")
        print("Supported formats: .mp4, .avi, .mov, .mkv, .webm")
        print()
        
        styles = self.video_analyzer.scan_all_samples()
        
        if styles:
            print(f"\nScanning complete!")
            print(f"Total styles learned: {len(styles)}")
        else:
            print("\nNo styles learned. Please add sample videos.")

    def show_learning_stats(self):
        """Show AI learning statistics."""
        print(f"\n{'='*50}")
        print("AI LEARNING STATISTICS")
        print(f"{'='*50}")
        
        stats = self.self_trainer.get_learning_stats()
        
        print(f"\nTotal Feedback: {stats['total_feedback']}")
        print(f"Average Rating: {stats['average_rating']:.1f}/5")
        print(f"Best Effect: {stats['best_effect']}")
        print(f"Best Color: {stats['best_color']}")
        
        if stats['effect_averages']:
            print("\nEffect Ratings:")
            for effect, rating in stats['effect_averages'].items():
                print(f"  {effect}: {rating:.1f}/5")
        
        if stats['color_averages']:
            print("\nColor Ratings:")
            for color, rating in stats['color_averages'].items():
                print(f"  {color}: {rating:.1f}/5")
        
        print(f"{'='*50}\n")

    def interactive_menu(self):
        """
        Shows a menu to the user and handles selection.
        """
        while True:
            print("\n" + "="*50)
            print("     DUA VIDEO GENERATOR - INTERACTIVE MODE")
            print("     Author: MASOOD NASIR")
            print("     Channel: @bushranasir1075")
            print("="*50)
            
            print("\nAvailable Options:")
            print("-" * 40)
            print(" 1. Select Dua from Database")
            print(" 2. Enter Custom Dua")
            print(" 3. Generate ALL Duas (Batch)")
            print(" 4. AI Mode (Process custom dua)")
            print(" 5. Scan Sample Videos")
            print(" 6. Learning Statistics")
            print(" 7. Settings")
            print(" 0. Exit")
            print("-" * 40)
            
            choice = input("\nSelect an option (0-7): ").strip()
            
            if choice == "0":
                print("Exiting. Goodbye!")
                return
            
            elif choice == "1":
                self._select_from_database()
            
            elif choice == "2":
                self._enter_custom_dua()
            
            elif choice == "3":
                self._batch_mode()
            
            elif choice == "4":
                self._ai_mode()
            
            elif choice == "5":
                self.scan_sample_videos()
            
            elif choice == "6":
                self.show_learning_stats()
            
            elif choice == "7":
                self._show_settings()
            
            else:
                print("Invalid option. Please enter 0-7.")
    
    def _select_from_database(self):
        """Select dua from database."""
        duas = DB.get_all_duas()
        if not duas:
            print("No Duas found in the database.")
            return
        
        print("\nAvailable Duas:")
        print("-" * 40)
        for idx, dua in enumerate(duas, 1):
            title = dua.get('title', 'Unknown')
            category = dua.get('category', 'general')
            print(f"{idx:3}. {title}  [{category}]")
        
        print("-" * 40)
        print(" 0. Back to Main Menu")
        
        while True:
            try:
                choice = input("\nSelect a Dua (enter number): ").strip()
                if choice == "0":
                    return
                
                idx = int(choice)
                if 1 <= idx <= len(duas):
                    selected = duas[idx-1]
                    dua_id = selected.get('id')
                    if dua_id:
                        self.generate_video(dua_id)
                    else:
                        print("Error: Selected Dua has no ID.")
                else:
                    print(f"Please enter a number between 1 and {len(duas)}.")
            except ValueError:
                print("Invalid input. Please enter a number.")
    
    def _enter_custom_dua(self):
        """Enter custom dua text."""
        print("\n" + "="*50)
        print("ENTER CUSTOM DUA")
        print("="*50)
        
        arabic_text = input("\nEnter Arabic text: ").strip()
        if not arabic_text:
            print("Error: Arabic text is required!")
            return
        
        urdu_text = input("Enter Urdu translation: ").strip()
        if not urdu_text:
            print("Error: Urdu translation is required!")
            return
        
        title = input("Enter Title (optional): ").strip()
        
        self.generate_custom_video(arabic_text, urdu_text, title)
    
    def _batch_mode(self):
        """Generate all duas in batch mode."""
        duas = DB.get_all_duas()
        if not duas:
            print("No Duas found in the database.")
            return
        
        print("\n" + "="*50)
        print("BATCH MODE: Generating all Duas...")
        print("="*50)
        
        total = len(duas)
        success_count = 0
        
        for idx, dua in enumerate(duas, 1):
            dua_id = dua.get('id')
            title = dua.get('title', 'Unknown')
            print(f"\n[{idx}/{total}] Processing: {title} ({dua_id})")
            print("-" * 30)
            
            if self.generate_video(dua_id):
                success_count += 1
            else:
                print(f"[{idx}/{total}] Failed for {title}")
        
        print("\n" + "="*50)
        print(f"BATCH COMPLETE! Successfully generated {success_count}/{total} videos.")
        print("="*50)
    
    def _ai_mode(self):
        """AI mode for processing custom dua with advanced features."""
        print("\n" + "="*50)
        print("AI MODE - ADVANCED DUA PROCESSING")
        print("="*50)
        
        arabic_text = input("\nEnter Arabic text: ").strip()
        if not arabic_text:
            print("Error: Arabic text is required!")
            return
        
        urdu_text = input("Enter Urdu/Roman Urdu/English translation: ").strip()
        if not urdu_text:
            print("Error: Translation is required!")
            return
        
        title = input("Enter Title (optional): ").strip()
        
        # Ask for effect selection
        effects = self.revamp_engine.get_available_effects()
        colors = self.revamp_engine.get_available_colors()
        
        print("\nAvailable Effects:")
        for idx, effect in enumerate(effects, 1):
            print(f"  {idx}. {effect}")
        
        print("\nAvailable Colors:")
        for idx, color in enumerate(colors, 1):
            print(f"  {idx}. {color}")
        
        effect_choice = input("\nSelect effect (number or 'ai' for recommendation): ").strip()
        
        if effect_choice.lower() == "ai":
            recommendation = self.self_trainer.get_recommendation()
            effect = recommendation.get("best_effect", "neon_glow")
            color = recommendation.get("best_color", "gold")
            print(f"\nAI recommends: {effect} effect with {color} colors")
        else:
            try:
                effect_idx = int(effect_choice) - 1
                effect = effects[effect_idx]
            except (ValueError, IndexError):
                effect = "neon_glow"
            
            color_choice = input("Select color (number): ").strip()
            try:
                color_idx = int(color_choice) - 1
                color = colors[color_idx]
            except (ValueError, IndexError):
                color = "gold"
        
        # Generate video
        self.generate_custom_video(arabic_text, urdu_text, title, effect)
        
        # Ask for feedback
        print("\nRate this video (1-5 stars):")
        try:
            rating = int(input("Rating: ").strip())
            if 1 <= rating <= 5:
                video_data = {
                    "id": f"custom_{int(time.time())}",
                    "effect": effect,
                    "color": color,
                    "duration": 0  # Will be updated
                }
                self.self_trainer.save_feedback(video_data, rating)
                print("Thank you for your feedback!")
        except ValueError:
            print("Invalid rating. Skipping.")
    
    def _show_settings(self):
        """Show settings menu."""
        print("\n" + "="*50)
        print("SETTINGS")
        print("="*50)
        
        print("\n1. View Project Info")
        print("2. View Security Info")
        print("3. Back to Main Menu")
        
        choice = input("\nSelect (1-3): ").strip()
        
        if choice == "1":
            print(PROJECT.get_summary())
        elif choice == "2":
            print("\nSecurity: AES-128-CBC Encryption (Fernet)")
            print("Key Derivation: PBKDF2-HMAC-SHA256")
            print("Iterations: 100,000")
        elif choice == "3":
            return
        else:
            print("Invalid option.")


if __name__ == "__main__":
    pipeline = DuaVideoPipeline()
    pipeline.interactive_menu()
