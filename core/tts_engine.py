import asyncio
import json
import logging
import os
import time
from typing import List, Optional, Tuple

try:
    import edge_tts
except ImportError:
    edge_tts = None
from moviepy import AudioFileClip  # Audio duration nikalne ke liye

logger = logging.getLogger(__name__)


class TTSEngine:
    """
    Text-to-Speech Engine using Microsoft Edge TTS.
    Arabic Voice: ar-SA-HamedNeural
    Urdu Voice: ur-PK-AsadNeural
    """
    
    VOICES = {
        'ar': 'ar-SA-HamedNeural',  # Arabic
        'ur': 'ur-PK-AsadNeural'    # Urdu
    }

    # Solemn tilawat feel (user-approved "2+4 combo"):
    # thora slow + thora deep. Timing sidecars iske sath hi banti hain
    # is liye karaoke sync perfect rehta hai.
    PROSODY = {
        'ar': {'rate': '-8%', 'pitch': '-2Hz'},
        'ur': {'rate': '-5%', 'pitch': '-1Hz'},
    }

    # STYLE-ROTATION (2026-08-23): deterministic per-dua voice variation.
    # All pool members are solemn "General/Friendly" neural voices so the
    # tilawat feel stays consistent. PROSODY remains language-wide, hence
    # word-boundary timing sidecars and karaoke sync are unaffected.
    #
    # GENDER_POOLS: gender-matched jodi system. For each dua the SAME
    # gender bit selects from both languages, so a video is either fully
    # male-voiced or fully female-voiced. Regional slots mirror 1:1
    # (Hamed<->Zariyah SA, Hamdan<->Fatima AE, Laith<->Amany SY,
    # Saleh<->Maryam YE, Asad<->Uzma PK, Salman<->Gul IN).
    VOICE_POOLS = {
        'ar': ('ar-SA-HamedNeural',    # SA male (primary)
               'ar-AE-HamdanNeural',   # AE male
               'ar-SY-LaithNeural',    # SY male
               'ar-YE-SalehNeural'),   # YE male
        'ur': ('ur-PK-AsadNeural',     # PK male (primary)
               'ur-IN-SalmanNeural'),  # IN male
    }

    GENDER_POOLS = {
        'ar': (('ar-SA-HamedNeural', 'ar-AE-HamdanNeural',
                'ar-SY-LaithNeural', 'ar-YE-SalehNeural'),
               ('ar-SA-ZariyahNeural', 'ar-AE-FatimaNeural',
                'ar-SY-AmanyNeural', 'ar-YE-MaryamNeural')),
        'ur': (('ur-PK-AsadNeural', 'ur-IN-SalmanNeural'),
               ('ur-PK-UzmaNeural', 'ur-IN-GulNeural')),
    }

    @staticmethod
    def pick_voice(dua_id: str, language: str) -> str:
        """Deterministic pool rotation keyed by dua id (stable on re-render).

        Gender bit (bit-3 of the id hash) picks the male or female bank;
        regional index (low bits) stays shared across languages so a dua's
        Arabi+Urdu jodi always matches in gender. Explicit per-dua overrides
        (voice_arabic / voice_urdu fields) always win.
        """
        banks = TTSEngine.GENDER_POOLS.get(language)
        if not banks:
            return TTSEngine.VOICES.get(language, '')
        h = sum(map(ord, str(dua_id)))
        g = (h >> 3) & 1
        return banks[g][h % len(banks[0])]

    MAX_RETRIES = 3
    RETRY_DELAY_BASE = 2  # seconds
    SAVE_TIMEOUT = 25  # seconds; abort a hung edge-tts connection

    @staticmethod
    async def _save_with_timeout(communicate, output_file, **kwargs):
        try:
            return await asyncio.wait_for(
                communicate.save(output_file, **kwargs), timeout=TTSEngine.SAVE_TIMEOUT)
        except asyncio.TimeoutError:
            logger.error("edge-tts save timed out")
            raise

    @staticmethod
    async def _async_generate(text: str, voice: str, output_file: str,
                              timing_path: Optional[str] = None,
                              rate: Optional[str] = None,
                              pitch: Optional[str] = None) -> bool:
        """Internal async helper to generate TTS audio.

        When timing_path is provided, WordBoundary metadata is captured as a
        JSONL sidecar (edge-tts save() metadata_fname) to prepare future
        audio-synchronized word highlighting. If metadata capture fails for any
        reason, audio generation falls back to plain synthesis so the audio is
        never lost because of optional metadata.
        """
        if edge_tts is None:
            logger.error("edge-tts not installed. Run: pip install edge-tts")
            return False
        try:
            if timing_path:
                try:
                    communicate = edge_tts.Communicate(
                        text, voice, boundary="WordBoundary",
                        rate=rate, pitch=pitch)
                    await TTSEngine._save_with_timeout(
                        communicate, output_file, metadata_fname=timing_path)
                    return True
                except Exception as e:
                    logger.warning(f"Word boundary capture failed ({e}); "
                                   "retrying without metadata.")
                    if timing_path and os.path.exists(timing_path):
                        try:
                            os.remove(timing_path)
                        except OSError:
                            pass
            communicate = edge_tts.Communicate(
                text, voice, rate=rate, pitch=pitch)
            await TTSEngine._save_with_timeout(communicate, output_file)
            return True
        except Exception as e:
            logger.error(f"{e}")
            return False

    @staticmethod
    def generate_audio(text: str, language: str, output_path: str,
                       timing_path: Optional[str] = None,
                       voice: Optional[str] = None) -> bool:
        """
        Synchronous wrapper to generate MP3 audio with retry logic.

        ENGINE ROUTING (2026-08-23): when data/tts_engine.json says "gemini"
        and an API key exists, synthesis is delegated to Gemini TTS with
        proportional word-timing sidecars. Explicit voice overrides or any
        Gemini failure fall back to the edge-tts path below, which stays
        fully intact.

        Args:
            text (str): The text to convert.
            language (str): 'ar' for Arabic, 'ur' for Urdu.
            output_path (str): Full path for the .mp3 file (e.g., temp/ar_voice.mp3).
            timing_path (str, optional): Path for the WordBoundary JSONL sidecar.
                When omitted, audio generation behaves exactly as before.
            voice (str, optional): PILLAR 2 · explicit edge-tts voice override
                (e.g., dua['voice_arabic']). Falls back to VOICES[language].
                When set, forces the edge-tts engine.

        Returns:
            bool: True if successful, False otherwise.
        """
        if language not in TTSEngine.VOICES:
            raise ValueError(f"Unsupported language: {language}. Use 'ar' or 'ur'.")

        # ENGINE ROUTING: edge-tts (primary).
        voice = (voice or "").strip() or TTSEngine.VOICES[language]
        prosody = TTSEngine.PROSODY.get(language, {})
        rate = prosody.get('rate')
        pitch = prosody.get('pitch')
        # Ensure the temp folder exists
        os.makedirs(os.path.dirname(os.path.abspath(output_path)), exist_ok=True)
        
        # Retry logic with exponential backoff
        for attempt in range(TTSEngine.MAX_RETRIES):
            try:
                # Async function ko sync mein run karna
                loop = asyncio.new_event_loop()
                try:
                    asyncio.set_event_loop(loop)
                    result = loop.run_until_complete(
                        TTSEngine._async_generate(text, voice, output_path,
                                                  timing_path, rate, pitch)
                    )
                finally:
                    loop.close()
                asyncio.set_event_loop(None)
                
                if result:
                    return True
                    
                # If we got here, generation failed
                if attempt < TTSEngine.MAX_RETRIES - 1:
                    delay = TTSEngine.RETRY_DELAY_BASE ** (attempt + 1)
                    logger.info(f"Attempt {attempt + 1} failed, retrying in {delay}s...")
                    time.sleep(delay)
                    
            except Exception as e:
                logger.error(f"Attempt {attempt + 1}: {e}")
                if attempt < TTSEngine.MAX_RETRIES - 1:
                    delay = TTSEngine.RETRY_DELAY_BASE ** (attempt + 1)
                    logger.info(f"Retrying in {delay}s...")
                    time.sleep(delay)
        
        logger.error(f"All {TTSEngine.MAX_RETRIES} attempts failed")
        return False

    @staticmethod
    def parse_word_boundaries(timing_path: str) -> List[dict]:
        """
        Parse an edge-tts WordBoundary JSONL sidecar into a structured list.

        Each line is a JSON object with type, offset, duration, and text.
        Offsets/durations are reported in 100-nanosecond ticks; they are
        converted to seconds here.

        Args:
            timing_path: Path to the JSONL metadata file (may be missing/invalid).

        Returns:
            list of {"word", "offset", "duration", "end"} (seconds).
            Returns an empty list if the file is absent or unparseable.
        """
        words: List[dict] = []
        if not timing_path or not os.path.exists(timing_path):
            return words
        try:
            with open(timing_path, "r", encoding="utf-8") as f:
                for line in f:
                    line = line.strip()
                    if not line:
                        continue
                    try:
                        entry = json.loads(line)
                    except json.JSONDecodeError:
                        continue
                    if entry.get("type") != "WordBoundary":
                        continue
                    offset_s = float(entry.get("offset", 0)) / 10_000_000.0
                    duration_s = float(entry.get("duration", 0)) / 10_000_000.0
                    words.append({
                        "word": entry.get("text", ""),
                        "offset": round(offset_s, 6),
                        "duration": round(duration_s, 6),
                        "end": round(offset_s + duration_s, 6),
                    })
        except Exception as e:
            logger.error(f"Failed to parse word boundaries: {e}")
            return []
        return words

    @staticmethod
    def get_audio_duration(file_path: str) -> float:
        """
        Returns duration in seconds using moviepy.
        Agar file nahi milti toh 0.0 return karega.
        """
        try:
            with AudioFileClip(file_path) as clip:
                return clip.duration
        except Exception as e:
            logger.error(f"Failed to get audio duration: {e}")
            return 0.0

    @staticmethod
    def test():
        """Quick test function to verify TTS is working perfectly."""
        print("Testing TTS Engine...")
        
        # Ensure temp folder exists
        os.makedirs("temp", exist_ok=True)
        
        # 1. Arabic Test
        ar_text = "السلام عليكم ورحمة الله"
        ar_file = "temp/test_ar.mp3"
        if TTSEngine.generate_audio(ar_text, 'ar', ar_file):
            dur = TTSEngine.get_audio_duration(ar_file)
            print(f"Arabic TTS works! Duration: {dur:.2f} seconds")
        else:
            print("Arabic TTS failed.")
            
        # 2. Urdu Test
        ur_text = "آپ کیسے ہیں؟"
        ur_file = "temp/test_ur.mp3"
        if TTSEngine.generate_audio(ur_text, 'ur', ur_file):
            dur = TTSEngine.get_audio_duration(ur_file)
            print(f"Urdu TTS works! Duration: {dur:.2f} seconds")
        else:
            print("Urdu TTS failed.")
            
        print("\nTest complete. Please check the 'temp/' folder for MP3 files.")


if __name__ == "__main__":
    TTSEngine.test()
