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
};

export const ARABIC_FONT =
  "'Amiri Quran', 'Scheherazade New', 'Sakkal Majalla', serif";
export const URDU_FONT =
  "'Noto Nastaliq Urdu', 'Jameel Noori Nastaleeq', 'Urdu Typesetting', serif";
export const UI_FONT = "'Segoe UI', system-ui, sans-serif";
export const EMOJI_FONT = "'Segoe UI Emoji', 'Noto Color Emoji', sans-serif";
