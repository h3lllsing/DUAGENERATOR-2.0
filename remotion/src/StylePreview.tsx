import React from 'react';
import {AbsoluteFill} from 'remotion';
import {Background} from './Background';
import {ARABIC_FONT, ensureFonts, UI_FONT, URDU_FONT} from './fonts';
import {getTheme} from './themes';

export const StylePreview: React.FC<{template: string}> = ({template}) => {
  const theme = getTheme(template);
  ensureFonts();
  return (
    <AbsoluteFill>
      <Background theme={theme} />
      <AbsoluteFill
        style={{
          justifyContent: 'center',
          alignItems: 'center',
          gap: 26,
        }}
      >
        <div
          dir="rtl"
          style={{
            fontFamily: ARABIC_FONT,
            fontSize: 72,
            color: theme.arabicColor,
            textShadow: `0 4px 30px ${theme.glowColor}`,
          }}
        >
          {'الْحَمْدُ لِلَّهِ رَبِّ الْعَالَمِينَ'}
        </div>
        <div
          style={{
            width: 200,
            height: 2,
            background: `linear-gradient(90deg, transparent, ${theme.accent}, transparent)`,
          }}
        />
        <div
          dir="rtl"
          style={{
            fontFamily: URDU_FONT,
            fontSize: 40,
            color: theme.urduColor,
          }}
        >
          {'تمام تعریف اللہ کے لیے'}
        </div>
        <div
          style={{
            fontFamily: UI_FONT,
            fontSize: 22,
            letterSpacing: '0.3em',
            color: theme.accent,
            marginTop: 8,
          }}
        >
          {theme.label.toUpperCase()}
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
