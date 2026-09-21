import React from 'react';
import {AbsoluteFill} from 'remotion';
import {getTheme} from './themes';
import {ensureFonts, ARABIC_FONT, UI_FONT, URDU_FONT} from './fonts';
import {getLuminousTheme} from './themesNext';
import type {DuaManifest} from './types';

// NEXT-LEVEL LOOK · Direction-A thumbnail (clean editorial, no double frame)
const LuminousThumb: React.FC<{data: DuaManifest}> = ({data}) => {
  const theme = getLuminousTheme(data.template || 'luminous');
  const isPaper = theme.id === 'parchment';
  const ink = isPaper ? '#221C12' : '#F7F3E9';
  const sub = isPaper ? 'rgba(34,28,18,0.55)' : 'rgba(247,243,233,0.6)';
  const NASKH_URDU = `'Scheherazade New', ${URDU_FONT}`;

  const arabicHeadline = (data.arabicWords || [])
    .slice(0, 6)
    .map((w) => w.t)
    .join(' ');
  const partMatch = data.dua_id.match(/_part(\d+)$/);
  const partLabel = partMatch ? 'Part '.concat(partMatch[1], ' of 2') : null;

  return (
    <AbsoluteFill style={{background: theme.bgGradient}}>
      <AbsoluteFill
        style={{
          background: `radial-gradient(60% 40% at 50% 6%, ${theme.glowColor}, transparent 70%)`,
        }}
      />
      <AbsoluteFill
        style={{
          background: `radial-gradient(140% 90% at 50% 50%, transparent 55%, ${theme.vignette} 100%)`,
        }}
      />

      {/* brand hairline - top */}
      <div
        style={{
          position: 'absolute',
          top: 210,
          left: 0,
          right: 0,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 14,
        }}
      >
        <div
          style={{
            width: 300,
            height: 2,
            background: 'linear-gradient(90deg, transparent, #D8B25C 18%, #D8B25C 82%, transparent)',
          }}
        />
        <div
          style={{
            fontFamily: UI_FONT,
            fontSize: 30,
            fontWeight: 700,
            letterSpacing: 8,
            color: '#D8B25C',
            textShadow: '0 2px 12px rgba(0,0,0,0.8)',
          }}
        >
          {(data.channel && data.channel.name) || 'Dua Series'}
        </div>
      </div>

      {/* ref chip - top-left corner */}
      <div
        style={{
          position: 'absolute',
          top: 410,
          left: 90,
          display: 'flex',
          alignItems: 'center',
          gap: 18,
        }}
      >
        <div
          style={{
            border: `1.5px solid ${theme.accent}aa`,
            color: theme.accent,
            fontFamily: UI_FONT,
            fontWeight: 700,
            fontSize: 28,
            padding: '10px 26px',
            borderRadius: 99,
            background: isPaper ? 'rgba(255,255,255,0.55)' : 'rgba(5,8,18,0.5)',
          }}
        >
          {data.reference}
        </div>
        {partLabel ? (
          <div
            style={{
              fontFamily: UI_FONT,
              fontWeight: 600,
              fontSize: 26,
              color: sub,
            }}
          >
            {partLabel}
          </div>
        ) : null}
      </div>

      {/* center content (inside Shorts safe zone) */}
      <AbsoluteFill
        style={{
          justifyContent: 'center',
          alignItems: 'center',
          paddingTop: 200,
          paddingBottom: 260,
        }}
      >
        {data.arabicWords && data.arabicWords.length ? (
          <div
            dir="rtl"
            style={{
              fontFamily: ARABIC_FONT,
              fontSize: 92,
              lineHeight: 1.8,
              color: ink,
              textAlign: 'center',
              maxWidth: 880,
              textShadow: isPaper
                ? '0 3px 20px rgba(70,56,30,0.3)'
                : '0 4px 26px rgba(0,0,0,0.85), 0 0 34px rgba(108,140,255,0.3)',
              WebkitTextStroke: isPaper ? '1px rgba(0,0,0,0.08)' : '4px rgba(0,0,0,0.9)',
              paintOrder: 'stroke fill',
            }}
          >
            {arabicHeadline}
          </div>
        ) : null}

        <div
          style={{
            width: 360,
            height: 2,
            margin: '46px 0',
            background: 'linear-gradient(90deg, transparent, #D8B25C, transparent)',
          }}
        />

        <div
          dir="rtl"
          style={{
            fontFamily: NASKH_URDU,
            fontSize: 78,
            lineHeight: 1.4,
            fontWeight: 600,
            color: ink,
            textAlign: 'center',
            maxWidth: 860,
            padding: '0 40px',
            textShadow: isPaper
              ? '0 3px 18px rgba(70,56,30,0.3)'
              : '0 6px 30px rgba(0,0,0,0.92)',
            WebkitTextStroke: isPaper ? '1px rgba(0,0,0,0.08)' : '4.5px rgba(0,0,0,0.9)',
            paintOrder: 'stroke fill',
          }}
        >
          {data.title}
        </div>
      </AbsoluteFill>

      {/* subscribe CTA - above Shorts bottom overlay zone */}
      <AbsoluteFill
        style={{
          justifyContent: 'flex-end',
          alignItems: 'center',
          paddingBottom: 320,
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 16,
            background: `linear-gradient(135deg, ${theme.accent}, ${theme.accent}cc)`,
            color: isPaper ? '#F7F3E9' : '#0B1220',
            fontFamily: UI_FONT,
            fontWeight: 800,
            fontSize: 40,
            padding: '18px 56px',
            borderRadius: 999,
            boxShadow: `0 10px 40px ${theme.accent}66`,
          }}
        >
          Subscribe{' '}
          <span style={{opacity: 0.72, fontSize: 30, fontWeight: 700}}>
            {(data.channel && data.channel.handle) || ''}
          </span>
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

// PILLAR 3 · dedicated high-CTR thumbnail composition.
// Rendered via `remotion still thumbnail-card --props=<manifest json>`.
// Layout respects YouTube Shorts UI safe zones: nothing critical inside
// the top 150px (status bar) or bottom 350px (caption/action overlays).
// NEXT-LEVEL LOOK · Direction-A editorial poster thumbnail (no pill/box/frames)
const EditorialThumb: React.FC<{data: DuaManifest}> = ({data}) => {
  const theme = getLuminousTheme(data.template || 'luminous');
  const isPaper = theme.id === 'parchment';
  const ink = isPaper ? '#221C12' : '#F7F3E9';
  const NASKH_URDU = `'Scheherazade New', ${URDU_FONT}`;

  const verse = (data.arabicWords || [])
    .slice(0, 6)
    .map((w) => w.t)
    .join(' ');

  return (
    <AbsoluteFill style={{background: theme.bgGradient}}>
      <AbsoluteFill
        style={{
          background: `radial-gradient(58% 38% at 50% 8%, ${theme.glowColor}, transparent 70%)`,
        }}
      />
      <AbsoluteFill
        style={{
          background: `radial-gradient(140% 90% at 50% 50%, transparent 54%, ${theme.vignette} 100%)`,
        }}
      />

      {/* brand - letterspaced, no banner */}
      <div
        style={{
          position: 'absolute',
          top: 212,
          left: 0,
          right: 0,
          textAlign: 'center',
          fontFamily: UI_FONT,
          fontSize: 30,
          fontWeight: 700,
          letterSpacing: 10,
          color: '#D8B25C',
          textShadow: '0 2px 12px rgba(0,0,0,0.8)',
        }}
      >
        {(data.channel && data.channel.name) || 'Dua Series'}
      </div>

      {/* center poster block */}
      <AbsoluteFill
        style={{
          justifyContent: 'center',
          alignItems: 'center',
          paddingTop: 220,
          paddingBottom: 300,
        }}
      >
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 52,
          }}
        >
          {verse ? (
            <div
              dir="rtl"
              style={{
                fontFamily: ARABIC_FONT,
                fontSize: 104,
                lineHeight: 1.9,
                color: ink,
                textAlign: 'center',
                maxWidth: 860,
                textShadow: isPaper
                  ? '0 3px 20px rgba(70,56,30,0.3)'
                  : '0 4px 26px rgba(0,0,0,0.85), 0 0 38px rgba(108,140,255,0.28)',
                WebkitTextStroke: isPaper
                  ? '1px rgba(0,0,0,0.08)'
                  : '4px rgba(0,0,0,0.9)',
                paintOrder: 'stroke fill',
              }}
            >
              <span style={{color: theme.accent, opacity: 0.55}}>&#xFD3E;</span>{' '}
              {verse}{' '}
              <span style={{color: theme.accent, opacity: 0.55}}>&#xFD3F;</span>
            </div>
          ) : null}

          <div
            style={{
              width: 320,
              height: 2,
              background:
                'linear-gradient(90deg, transparent, #D8B25C 25%, #D8B25C 75%, transparent)',
            }}
          />

          <div
            dir="rtl"
            style={{
              fontFamily: NASKH_URDU,
              fontSize: 74,
              lineHeight: 1.5,
              color: ink,
              textAlign: 'center',
              maxWidth: 840,
              padding: '0 40px',
              textShadow: isPaper
                ? '0 3px 18px rgba(70,56,30,0.3)'
                : '0 6px 30px rgba(0,0,0,0.92)',
              WebkitTextStroke: isPaper
                ? '1px rgba(0,0,0,0.08)'
                : '4.5px rgba(0,0,0,0.9)',
              paintOrder: 'stroke fill',
            }}
          >
            {data.title}
          </div>
        </div>
      </AbsoluteFill>

      {/* footer - ref + handle, no CTA pill */}
      <div
        style={{
          position: 'absolute',
          bottom: 300,
          left: 0,
          right: 0,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 18,
        }}
      >
        <div
          style={{
            fontFamily: UI_FONT,
            fontSize: 30,
            fontWeight: 700,
            letterSpacing: 3,
            color: theme.accent,
            textShadow: '0 2px 12px rgba(0,0,0,0.8)',
          }}
        >
          {data.reference}
        </div>
        <div
          style={{
            fontFamily: UI_FONT,
            fontSize: 26,
            fontWeight: 600,
            letterSpacing: 2,
            color: 'rgba(247,243,233,0.5)',
            textShadow: '0 2px 10px rgba(0,0,0,0.8)',
          }}
        >
          {(data.channel && data.channel.handle) || ''}
        </div>
      </div>
    </AbsoluteFill>
  );
};

export const ThumbCard: React.FC<{data: DuaManifest}> = ({data}) => {
  ensureFonts();
  if (data.visualDirection === 'editorial') {
    return <EditorialThumb data={data} />;
  }
  if (data.visualDirection === 'luminous') {
    return <LuminousThumb data={data} />;
  }
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
