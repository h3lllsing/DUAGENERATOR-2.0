import React from 'react';
import {AbsoluteFill} from 'remotion';
import {getTheme} from './themes';
import {ensureFonts, ARABIC_FONT, UI_FONT} from './fonts';
import type {DuaManifest} from './types';

// PILLAR 3 · dedicated high-CTR thumbnail composition.
// Rendered via `remotion still thumbnail-card --props=<manifest json>`.
// Layout respects YouTube Shorts UI safe zones: nothing critical inside
// the top 150px (status bar) or bottom 350px (caption/action overlays).
export const ThumbCard: React.FC<{data: DuaManifest}> = ({data}) => {
  ensureFonts();
  const theme = getTheme(data.template || 'dark');
  const isPaper = theme.decor === 'paper';

  const arabicHeadline = (data.arabicWords || [])
    .slice(0, 6)
    .map((w) => w.t)
    .join(' ');

  const partMatch = data.dua_id.match(/_part(\d+)$/);
  const partLabel = partMatch
    ? 'Part '.concat(partMatch[1], ' of 2')
    : null;

  return (
    <AbsoluteFill style={{background: theme.bgGradient}}>
      {/* accent bloom + vignette */}
      <AbsoluteFill
        style={{
          background: `radial-gradient(58% 38% at 50% 20%, ${theme.glowColor}, transparent 70%)`,
        }}
      />
      <AbsoluteFill
        style={{
          background: `radial-gradient(120% 90% at 50% 45%, transparent 55%, ${theme.vignette} 100%)`,
        }}
      />
      {/* contrast scrim: guarantees text pop on every theme */}
      <AbsoluteFill
        style={{
          background: isPaper
            ? 'linear-gradient(180deg, rgba(30,22,10,0.42) 0%, rgba(30,22,10,0.18) 46%, rgba(30,22,10,0.52) 100%)'
            : 'linear-gradient(180deg, rgba(5,7,11,0.52) 0%, rgba(5,7,11,0.22) 46%, rgba(5,7,11,0.60) 100%)',
        }}
      />

      {/* ornamental frame */}
      <div
        style={{
          position: 'absolute',
          inset: 40,
          border: `2px solid ${theme.accent}66`,
          borderRadius: 26,
          pointerEvents: 'none',
        }}
      />
      <div
        style={{
          position: 'absolute',
          inset: 50,
          border: `1px solid ${theme.accent}33`,
          borderRadius: 20,
          pointerEvents: 'none',
        }}
      />
      {[
        {top: 58, left: 58},
        {top: 58, right: 58},
        {bottom: 58, left: 58},
        {bottom: 58, right: 58},
      ].map((pos, i) => (
        <div
          key={i}
          style={{
            position: 'absolute',
            ...pos,
            color: theme.accent,
            fontFamily: UI_FONT,
            fontSize: 44,
            textShadow: `0 0 18px ${theme.accent}99`,
          }}
        >
          {'\u2726'}
        </div>
      ))}

      {/* content block inside safe zone */}
      <AbsoluteFill
        style={{
          justifyContent: 'center',
          alignItems: 'center',
          paddingTop: 120,
          paddingBottom: 300,
        }}
      >
        <div
          style={{
            width: 900,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 34,
          }}
        >
          {arabicHeadline ? (
            <div
              dir="rtl"
              style={{
                fontFamily: ARABIC_FONT,
                fontSize: 86,
                lineHeight: 1.75,
                color: theme.arabicColor,
                textAlign: 'center',
                textShadow: `0 4px 28px rgba(0,0,0,0.85), 0 0 26px ${theme.accent}66`,
              }}
            >
              {arabicHeadline}
            </div>
          ) : null}

          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 18,
              width: 720,
            }}
          >
            <div
              style={{
                flex: 1,
                height: 3,
                background: `linear-gradient(90deg, transparent, ${theme.accent})`,
              }}
            />
            <div
              style={{color: theme.accent, fontSize: 40, fontFamily: UI_FONT}}
            >
              {'\u2726'}
            </div>
            <div
              style={{
                flex: 1,
                height: 3,
                background: `linear-gradient(270deg, transparent, ${theme.accent})`,
              }}
            />
          </div>

          <div
            style={{
              fontFamily: UI_FONT,
              fontWeight: 800,
              fontSize: 74,
              lineHeight: 1.22,
              color: '#ffffff',
              textAlign: 'center',
              letterSpacing: 0.5,
              textShadow: `0 6px 30px rgba(0,0,0,0.95), 0 2px 8px rgba(0,0,0,0.9), 0 0 40px ${theme.accent}44`,
            }}
          >
            {data.title}
          </div>

          <div
            style={{
              display: 'flex',
              flexDirection: 'row',
              gap: 16,
              alignItems: 'center',
            }}
          >
            <div
              style={{
                background: `linear-gradient(135deg, ${theme.pillFrom}, ${theme.pillTo})`,
                color: '#241a08',
                fontFamily: UI_FONT,
                fontWeight: 700,
                fontSize: 29,
                padding: '12px 38px',
                borderRadius: 999,
                boxShadow: `0 4px 18px ${theme.accent}55`,
              }}
            >
              {data.reference}
            </div>
            {partLabel ? (
              <div
                style={{
                  border: `2px solid ${theme.accent}`,
                  color: theme.accent,
                  fontFamily: UI_FONT,
                  fontWeight: 700,
                  fontSize: 29,
                  padding: '10px 32px',
                  borderRadius: 999,
                  background: 'rgba(0,0,0,0.35)',
                }}
              >
                {partLabel}
              </div>
            ) : null}
          </div>
        </div>
      </AbsoluteFill>

      {/* channel line - kept above the Shorts bottom overlay zone */}
      <div
        style={{
          position: 'absolute',
          bottom: 320,
          left: 0,
          right: 0,
          textAlign: 'center',
          fontFamily: UI_FONT,
          fontSize: 27,
          fontWeight: 600,
          letterSpacing: 2,
          color: 'rgba(255,255,255,0.62)',
          textShadow: '0 2px 8px rgba(0,0,0,0.8)',
        }}
      >
        {(data.channel && data.channel.name) || ''}
      </div>
    </AbsoluteFill>
  );
};
