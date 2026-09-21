import React from 'react';
import {
  AbsoluteFill,
  Audio,
  Sequence,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from 'remotion';
import type {DuaManifest, WordTiming} from './types';
import {
  ensureFonts,
  ARABIC_FONT,
  UI_FONT,
  URDU_FONT,
  ARABIC_DISPLAY_FONT,
  URDU_DISPLAY_FONT,
} from './fonts';
import {getLuminousTheme} from './themesNext';
import {starGeometry, seedFromId} from './geometryNext';

// NEXT-LEVEL LOOK · DIRECTION A "Luminous Modern" (v1)
// Editorial, typographic-first template: page-based karaoke (one page of words
// on screen at a time, TikTok-style), crossfade phase transitions, procedural
// 8-fold star geometry, thin gold hairline, muted violet ambient glows.
// Legacy particle starfields / god-rays / ornaments are NOT rendered here.
// INTRO_FRAMES / END_FRAMES mirror the legacy slice so durations stay stable.

export const LUM_INTRO_FRAMES = 66;
export const LUM_END_FRAMES = 74;

const ease = (k: number): number => k * k * (3 - 2 * k);
const clamp01 = (n: number): number => Math.min(1, Math.max(0, n));
const NASKH_URDU = `'Scheherazade New', ${URDU_DISPLAY_FONT}`;

// latest-started word index (frame domain, no flicker)
const activeIdxAt = (words: WordTiming[], frame: number, fps: number): number => {
  for (let i = words.length - 1; i >= 0; i--) {
    if (frame >= Math.floor(words[i].start * fps)) return i;
  }
  return -1;
};

const StrokeText: React.FC<{
  children: React.ReactNode;
  px: number;
  color: string;
  stroke: string;
}> = ({children, px, color, stroke}) => (
  <span
    style={{
      color,
      WebkitTextStroke: `${px.toFixed(2)}px ${stroke}`,
      paintOrder: 'stroke fill',
    }}
  >
    {children}
  </span>
);

const GoldHairline: React.FC<{themeLabel: string}> = ({themeLabel}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const t = frame / fps;
  const inK = ease(clamp01(t / 0.5));
  const outK = ease(clamp01((frame - 46) / 20));
  return (
    <AbsoluteFill
      style={{justifyContent: 'flex-start', alignItems: 'center', opacity: inK * (1 - outK)}}
    >
      <div
        style={{
          marginTop: 150,
          height: 160,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <div
          style={{
            width: 60,
            height: 3,
            borderRadius: 99,
            background: 'linear-gradient(90deg, transparent, #D8B25C)',
          }}
        />
        <StrokeText px={1} color="#D8B25C" stroke="rgba(0,0,0,0.6)">
          <span style={{fontSize: 34, fontFamily: UI_FONT}}>✦</span>
        </StrokeText>
        <div
          style={{
            width: 300,
            height: 2,
            borderRadius: 99,
            background:
              'linear-gradient(90deg, transparent, #D8B25C 18%, #D8B25C 82%, transparent)',
          }}
        />
        <div
          style={{
            marginTop: 14,
            fontFamily: UI_FONT,
            fontSize: 24,
            letterSpacing: 6,
            fontWeight: 600,
            color: 'rgba(247,243,233,0.5)',
            textShadow: '0 2px 10px rgba(0,0,0,0.8)',
          }}
        >
          {themeLabel.toUpperCase()}
        </div>
      </div>
    </AbsoluteFill>
  );
};

const StarBackdrop: React.FC<{accent: string; seed: number}> = ({accent, seed}) => {
  const {width} = useVideoConfig();
  const geo = starGeometry(seed, 560);
  const size = 560;
  return (
    <AbsoluteFill
      style={{justifyContent: 'flex-end', alignItems: 'center', overflow: 'hidden'}}
    >
      <div style={{width: size, height: size, position: 'relative', bottom: -size * 0.22}}>
        <div
          style={{
            position: 'absolute',
            inset: 0,
            borderRadius: '50%',
            background: `radial-gradient(50% 50% at 50% 50%, ${accent}14, transparent 70%)`,
          }}
        />
        <svg
          viewBox={`${-size / 2} ${-size / 2} ${size} ${size}`}
          width={size}
          height={size}
          style={{position: 'absolute', inset: 0, transform: `rotate(${geo.octo.rotate}deg)`}}
        >
          <polygon
            points={geo.octo.points}
            fill="none"
            stroke={accent}
            strokeOpacity={0.1}
            strokeWidth={1.2}
          />
          <polygon points={geo.octo.points} fill={accent} fillOpacity={0.02} />
          <polygon
            points={geo.inner.points}
            fill="none"
            stroke={accent}
            strokeOpacity={0.07}
            strokeWidth={1}
          />
        </svg>
      </div>
      <div
        style={{
          position: 'absolute',
          bottom: 0,
          height: 260,
          width,
          background: 'linear-gradient(180deg, transparent, rgba(0,0,0,0.4))',
        }}
      />
    </AbsoluteFill>
  );
};

const PageKaraoke: React.FC<{
  words: WordTiming[];
  startFrame: number;
  fontSize: number;
  fontFamily: string;
  accent: string;
  isPaper: boolean;
}> = ({words, startFrame, fontSize, fontFamily, accent, isPaper}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const local = frame - startFrame;
  const activeIndex = activeIdxAt(words, local, fps);
  const lastEnd = words.length ? words[words.length - 1].end : 0;

  const pageSize = Math.max(2, Math.ceil(words.length / 4));
  const pageCount = Math.max(1, Math.ceil(words.length / pageSize));
  const page =
    activeIndex === -1 ? 0 : Math.min(pageCount - 1, Math.floor(activeIndex / pageSize));
  const pageStartFrame = words[page * pageSize] ? words[page * pageSize].start * fps : 0;
  const pageFade = ease(clamp01((local - pageStartFrame) / 8));

  const strokePx = Math.max(2, fontSize * 0.055);
  const ink = isPaper ? '#221C12' : '#F7F3E9';
  const past = isPaper ? 'rgba(62,91,191,0.95)' : 'rgba(175,192,255,0.95)';
  const future = isPaper ? 'rgba(34,28,18,0.4)' : 'rgba(247,243,233,0.42)';
  const stroke = isPaper ? 'rgba(0,0,0,0.12)' : 'rgba(0,0,0,0.88)';

  return (
    <AbsoluteFill style={{justifyContent: 'center', alignItems: 'center'}}>
      <div
        dir="rtl"
        style={{
          fontFamily,
          fontSize,
          lineHeight: 2.05,
          maxWidth: 860,
          textAlign: 'center',
          wordSpacing: '0.12em',
          opacity: pageFade,
          transition: 'none',
        }}
      >
        {words.slice(page * pageSize, page * pageSize + pageSize).map((w, i) => {
          const abs = page * pageSize + i;
          const isActive = abs === activeIndex;
          const isPast = w.end <= local / fps;
          const txtColor = isActive ? (isPaper ? '#F7F3E9' : '#0B1220') : isPast ? past : future;
          return (
            <span
              key={i}
              style={{
                display: 'inline-block',
                padding: '0 0.18em',
                margin: '0.05em 0.04em',
                borderRadius: fontSize * 0.28,
                position: 'relative',
                whiteSpace: 'pre-wrap',
              }}
            >
              {isActive && (
                <span
                  style={{
                    position: 'absolute',
                    inset: `${fontSize * 0.05}px ${fontSize * 0.06}px`,
                    borderRadius: fontSize * 0.28,
                    background: `linear-gradient(135deg, ${accent}, ${accent}dd)`,
                    boxShadow: `0 0 ${fontSize * 0.5}px ${accent}77`,
                    zIndex: 0,
                  }}
                />
              )}
              <span
                style={{
                  position: 'relative',
                  zIndex: 1,
                  color: txtColor,
                  opacity: isActive ? 1 : isPast ? 0.96 : 0.5,
                  textShadow: `0 2px 12px rgba(0,0,0,0.6)${
                    isActive ? `, 0 0 14px ${accent}66` : ''
                  }`,
                  WebkitTextStroke: `${strokePx.toFixed(2)}px ${stroke}`,
                  paintOrder: 'stroke fill',
                }}
              >
                {w.t}
              </span>
            </span>
          );
        })}
      </div>
    </AbsoluteFill>
  );
};

// chrome computes its own frame so dots + progress track the full timeline
const PhaseChrome: React.FC<{
  arabic: WordTiming[];
  urdu: WordTiming[];
  arabicStart: number;
  urduStart: number;
  contentFrames: number;
  refChip: string;
  brand: string;
  accent: string;
}> = ({arabic, urdu, arabicStart, urduStart, contentFrames, refChip, brand, accent}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();

  const pagesA = Math.max(1, Math.ceil(arabic.length / Math.max(2, Math.ceil(arabic.length / 4))));
  const pagesU = Math.max(1, Math.ceil(urdu.length / Math.max(2, Math.ceil(urdu.length / 4))));
  const totalPages = pagesA + pagesU;

  const aIdx = activeIdxAt(arabic, frame - arabicStart, fps);
  const uIdx = activeIdxAt(urdu, frame - urduStart, fps);
  const pageA = aIdx === -1 ? 0 : Math.min(pagesA - 1, Math.floor(aIdx / Math.max(2, Math.ceil(arabic.length / 4))));
  const pageU = uIdx === -1 ? 0 : Math.min(pagesU - 1, Math.floor(uIdx / Math.max(2, Math.ceil(urdu.length / 4))));
  const page = frame < arabicStart + (arabic.length ? arabic[arabic.length - 1].end * fps : 0) ? pageA : pagesA + pageU;
  const progress = clamp01((frame - arabicStart) / contentFrames);

  return (
    <AbsoluteFill style={{pointerEvents: 'none'}}>
      <AbsoluteFill style={{justifyContent: 'flex-start', alignItems: 'center'}}>
        <div style={{marginTop: 300, display: 'flex', gap: 12, alignItems: 'center'}}>
          {Array.from({length: totalPages}).map((_, i) => (
            <div
              key={i}
              style={{
                width: i === page ? 26 : 10,
                height: 10,
                borderRadius: 99,
                background: i === page ? accent : 'rgba(247,243,233,0.22)',
                boxShadow: i === page ? `0 0 14px ${accent}aa` : 'none',
                transition: 'none',
              }}
            />
          ))}
        </div>
      </AbsoluteFill>

      <div
        style={{
          position: 'absolute',
          bottom: 316,
          left: 72,
          right: 72,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <div
          style={{
            fontFamily: UI_FONT,
            fontSize: 27,
            fontWeight: 700,
            letterSpacing: 1,
            color: 'rgba(247,243,233,0.92)',
            textShadow: '0 2px 10px rgba(0,0,0,0.8)',
          }}
        >
          {refChip}
        </div>
        <div
          style={{
            fontFamily: UI_FONT,
            fontSize: 25,
            fontWeight: 600,
            color: 'rgba(247,243,233,0.55)',
          }}
        >
          {brand}
        </div>
      </div>

      <div
        style={{
          position: 'absolute',
          bottom: 268,
          left: 72,
          right: 72,
          height: 4,
          borderRadius: 99,
          background: 'rgba(255,255,255,0.12)',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            height: '100%',
            width: `${Math.round(progress * 100)}%`,
            borderRadius: 99,
            background: `linear-gradient(90deg, ${accent}, #D8B25C)`,
            boxShadow: `0 0 12px ${accent}88`,
          }}
        />
      </div>
    </AbsoluteFill>
  );
};

const IntroCard: React.FC<{
  data: DuaManifest;
  title: string;
  refChip: string;
  bismillah: WordTiming[];
}> = ({data, title, refChip, bismillah}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const t = frame / fps;
  const inK = ease(clamp01(t / 0.6));
  const titleK = ease(clamp01((t - 0.35) / 0.5));
  const chipK = ease(clamp01((t - 0.7) / 0.4));
  const outK = frame > 44 ? ease(clamp01((frame - 44) / 20)) : 1;

  const bsLine = bismillah.map((w) => w.t).join(' ');

  return (
    <AbsoluteFill style={{justifyContent: 'center', alignItems: 'center'}}>
      <div
        style={{
          opacity: inK * outK,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          transform: `translateY(${(1 - inK) * 26}px)`,
        }}
      >
        {bsLine && (
          <div
            dir="rtl"
            style={{
              fontFamily: ARABIC_DISPLAY_FONT,
              fontSize: 66,
              lineHeight: 2,
              color: '#F7F3E9',
              textAlign: 'center',
              maxWidth: 900,
              marginBottom: 54,
              textShadow: '0 4px 26px rgba(0,0,0,0.85), 0 0 40px rgba(108,140,255,0.35)',
              WebkitTextStroke: '3.5px rgba(0,0,0,0.9)',
              paintOrder: 'stroke fill',
            }}
          >
            {bsLine}
          </div>
        )}
        <div
          dir="rtl"
          style={{
            fontFamily: NASKH_URDU,
            fontSize: 96,
            lineHeight: 1.35,
            color: '#F7F3E9',
            textAlign: 'center',
            maxWidth: 900,
            padding: '0 40px',
            opacity: titleK,
            transform: `translateY(${(1 - titleK) * 20}px)`,
            textShadow: '0 6px 30px rgba(0,0,0,0.9)',
            WebkitTextStroke: '5px rgba(0,0,0,0.9)',
            paintOrder: 'stroke fill',
          }}
        >
          {title}
        </div>
        <div
          style={{
            marginTop: 44,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 26,
            opacity: chipK,
          }}
        >
          <div
            style={{
              width: 240,
              height: 2,
              background: 'linear-gradient(90deg, transparent, #D8B25C, transparent)',
            }}
          />
          <div
            style={{
              fontFamily: UI_FONT,
              fontSize: 34,
              fontWeight: 700,
              letterSpacing: 2,
              color: '#D8B25C',
              textShadow: '0 2px 12px rgba(0,0,0,0.8)',
            }}
          >
            {refChip}
          </div>
          <div
            style={{
              fontFamily: UI_FONT,
              fontSize: 25,
              fontWeight: 600,
              letterSpacing: 4,
              color: 'rgba(247,243,233,0.5)',
            }}
          >
            {(data.channel && data.channel.name) || 'Dua Series'}
          </div>
        </div>
      </div>
    </AbsoluteFill>
  );
};

const Endcard: React.FC<{
  data: DuaManifest;
  title: string;
  refChip: string;
  accent: string;
}> = ({data, title, refChip, accent}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const t = frame / fps;
  const k = ease(clamp01(t / 0.55));
  return (
    <AbsoluteFill
      style={{
        justifyContent: 'center',
        alignItems: 'center',
        opacity: k,
        transform: `scale(${1 + (1 - k) * 0.04})`,
        background: 'rgba(3,6,16,0.35)',
      }}
    >
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 40,
          padding: '0 60px',
        }}
      >
        <div
          style={{
            fontFamily: UI_FONT,
            fontSize: 32,
            fontWeight: 700,
            letterSpacing: 8,
            color: '#D8B25C',
          }}
        >
          TAMAM ✓
        </div>
        <div
          style={{
            width: 300,
            height: 2,
            background: 'linear-gradient(90deg, transparent, #D8B25C, transparent)',
          }}
        />
        <div
          dir="rtl"
          style={{
            fontFamily: NASKH_URDU,
            fontSize: 70,
            lineHeight: 1.4,
            color: '#F7F3E9',
            textAlign: 'center',
            textShadow: '0 4px 24px rgba(0,0,0,0.9)',
            WebkitTextStroke: '4px rgba(0,0,0,0.9)',
            paintOrder: 'stroke fill',
          }}
        >
          {title}
        </div>
        <div
          style={{
            fontFamily: UI_FONT,
            fontSize: 30,
            fontWeight: 600,
            color: 'rgba(247,243,233,0.7)',
            letterSpacing: 1,
          }}
        >
          {refChip}
        </div>
        <div
          style={{
            display: 'flex',
            gap: 18,
            alignItems: 'center',
            background: `linear-gradient(135deg, ${accent}, ${accent}cc)`,
            color: '#0B1220',
            fontFamily: UI_FONT,
            fontWeight: 800,
            fontSize: 38,
            padding: '18px 52px',
            borderRadius: 999,
            boxShadow: `0 8px 34px ${accent}66`,
          }}
        >
          Subscribe{' '}
          <span style={{opacity: 0.75, fontSize: 30, fontWeight: 700}}>
            {(data.channel && data.channel.handle) || ''}
          </span>
        </div>
      </div>
    </AbsoluteFill>
  );
};

export const LuminousVideo: React.FC<{data: DuaManifest}> = ({data}) => {
  ensureFonts();
  const {fps} = useVideoConfig();
  const theme = getLuminousTheme(data.template || 'luminous');
  const isPaper = theme.id === 'parchment';

  const arabicWords: WordTiming[] = data.arabicWords || [];
  const urduWords: WordTiming[] = data.urduWords || [];
  const bismillah = arabicWords.slice(0, 4);
  // content pages skip the bismillah words that the intro already shows
  const contentArabic =
    arabicWords.length > 4 && !isPaper ? arabicWords.slice(4) : arabicWords;

  const arabicStart = LUM_INTRO_FRAMES;
  const contentFrames = Math.ceil((data.totalDuration || 15) * fps);
  const urduPhaseStart = contentArabic.length
    ? Math.round((data.sections && data.sections.urduStart ? data.sections.urduStart : 0) * fps) +
      LUM_INTRO_FRAMES
    : LUM_INTRO_FRAMES;

  return (
    <AbsoluteFill style={{background: theme.bgGradient}}>
      <AbsoluteFill
        style={{
          background: `radial-gradient(62% 40% at 50% 8%, ${theme.glowColor}, transparent 70%)`,
        }}
      />
      <AbsoluteFill
        style={{
          background: `radial-gradient(55% 32% at 50% 104%, ${theme.glowColor}, transparent 72%)`,
        }}
      />
      <AbsoluteFill
        style={{
          background: `radial-gradient(140% 100% at 50% 50%, transparent 58%, ${theme.vignette} 100%)`,
        }}
      />

      {isPaper && (
        <AbsoluteFill
          style={{
            opacity: 0.5,
            background:
              'repeating-linear-gradient(0deg, rgba(62,91,191,0.03) 0px, rgba(62,91,191,0.03) 1px, transparent 1px, transparent 4px)',
          }}
        />
      )}

      <StarBackdrop accent={theme.accent} seed={seedFromId(data.dua_id)} />

      <Sequence from={0} durationInFrames={LUM_INTRO_FRAMES} name="intro-hairline">
        <GoldHairline themeLabel={theme.label} />
      </Sequence>

      <Sequence from={0} durationInFrames={LUM_INTRO_FRAMES} name="intro">
        <IntroCard
          data={data}
          title={data.title || ''}
          refChip={data.reference || ''}
          bismillah={bismillah}
        />
      </Sequence>

      {contentArabic.length > 0 && (
        <Sequence
          from={LUM_INTRO_FRAMES}
          durationInFrames={Math.max(1, urduPhaseStart - LUM_INTRO_FRAMES)}
          name="arabic"
        >
          <PageKaraoke
            words={contentArabic}
            startFrame={0}
            fontSize={isPaper ? 84 : 92}
            fontFamily={ARABIC_DISPLAY_FONT}
            accent={theme.accent}
            isPaper={isPaper}
          />
        </Sequence>
      )}

      {urduWords.length > 0 && (
        <Sequence
          from={urduPhaseStart}
          durationInFrames={Math.max(1, LUM_INTRO_FRAMES + contentFrames - urduPhaseStart)}
          name="urdu"
        >
          <PageKaraoke
            words={urduWords}
            startFrame={0}
            fontSize={isPaper ? 56 : 62}
            fontFamily={NASKH_URDU}
            accent={theme.accent}
            isPaper={isPaper}
          />
        </Sequence>
      )}

      <PhaseChrome
        arabic={contentArabic}
        urdu={urduWords}
        arabicStart={LUM_INTRO_FRAMES}
        urduStart={urduPhaseStart}
        contentFrames={contentFrames}
        refChip={data.reference || ''}
        brand={(data.channel && data.channel.handle) || ''}
        accent={theme.accent}
      />

      <Sequence
        from={LUM_INTRO_FRAMES + contentFrames - 14}
        durationInFrames={LUM_END_FRAMES}
        name="endcard"
      >
        <Endcard
          data={data}
          title={data.title || ''}
          refChip={data.reference || ''}
          accent={theme.accent}
        />
      </Sequence>

      <Audio src={staticFile(data.audioFile)} />
    </AbsoluteFill>
  );
};