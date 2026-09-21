import {staticFile} from 'remotion';
import {loadFont} from '@remotion/fonts';

let started = false;

export const ensureFonts = () => {
  if (started) {
    return;
  }
  started = true;
  loadFont({
    family: 'Amiri Quran',
    url: staticFile('fonts/AmiriQuran-Regular.ttf'),
    weight: '400',
  });
  loadFont({
    family: 'Noto Nastaliq Urdu',
    url: staticFile('fonts/NotoNastaliqUrdu.ttf'),
    weight: '400',
  });
  loadFont({
    family: 'Scheherazade New',
    url: staticFile('fonts/ScheherazadeNew-Regular.ttf'),
    weight: '400',
  });
  // V2 - freshly downloaded calligraphy (OFL). Gulzar = decorative Urdu
  // (Nastaliq-influenced display), Katibeh + Rakkas = bold Arabic display.
  loadFont({
    family: 'Gulzar',
    url: staticFile('fonts/v2/Gulzar-Regular.ttf'),
    weight: '400',
  });
  loadFont({
    family: 'Katibeh',
    url: staticFile('fonts/v2/Katibeh-Regular.ttf'),
    weight: '400',
  });
  loadFont({
    family: 'Rakkas',
    url: staticFile('fonts/v2/Rakkas-Regular.ttf'),
    weight: '400',
  });
};

export const ARABIC_FONT =
  "'Amiri Quran', 'Scheherazade New', 'Sakkal Majalla', serif";
export const URDU_FONT =
  "'Noto Nastaliq Urdu', 'Jameel Noori Nastaleeq', 'Urdu Typesetting', serif";
export const UI_FONT = "'Segoe UI', system-ui, sans-serif";
export const EMOJI_FONT = "'Segoe UI Emoji', 'Noto Color Emoji', sans-serif";

// V2 display faces (fresh calligraphy channel for the new looks).
// - Gulzar = decorative Nastaliq-style Urdu, high-contrast, editorial impact
// - Katibeh = tall slanted Arabic display, luminous/wall-art energy
// - Rakkas  = bold rounded Arabic poster face, festival/poster punch
export const ARABIC_DISPLAY_FONT =
  "'Katibeh', 'Rakkas', 'Amiri Quran', 'Scheherazade New', serif";
export const URDU_DISPLAY_FONT =
  "'Gulzar', 'Noto Nastaliq Urdu', 'Jameel Noori Nastaleeq', serif";
export const PLUGIN_NAMES_V2 = ['Gulzar', 'Katibeh', 'Rakkas'] as const;
