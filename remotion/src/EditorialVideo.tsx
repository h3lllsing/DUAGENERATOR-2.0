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
  UI_FONT,
  URDU_DISPLAY_FONT,
  ARABIC_DISPLAY_FONT,
} from './fonts';
import {getLuminousTheme} from './themesNext';
import {VerseBlock, ThinRule, ease, clamp01, fitFont} from './editorialShared';

// NEXT-LEVEL LOOK · FORMAT "EDITORIAL" - skeleton is GUTTED vs old portal.
// No intro-card. No pill karaoke. No page dots / progress bar / footer
// ref+brand strips. No sparkle endcard. Four quiet acts instead:
//   I   bismillah poster (thin rules only, no card)
//   II  whole Arabic verse as calligraphy (color cue only + ornate brackets)
//   III Urdu meaning as one clean fitted block
//   IV  closing panel (Ameen + channel), no subscribe button
// Duration math stays identical: 66 intro / +content / 74 end (same formula).

const L_INTRO = 66;
export const EDIT_END_FRAMES = 74;

const NASKH_URDU = `'Scheherazade New', ${URDU_DISPLAY_FONT}`;
const BS_BASE = 76;
const BS_MIN = 50;

const ActBismillah: React.FC<{bsLine: string}> = ({bsLine}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const t = frame / fps;
  const inK = ease(clamp01(t / 0.6));
  const outK = frame > 52 ? ease(clamp01((frame - 52) / 14)) : 1;
  const size = fitFont({
    text: bsLine,
    fontFamily: ARABIC_DISPLAY_FONT,
    base: BS_BASE,
    min: BS_MIN,
    maxWidth: 840,
    maxLines: 1,
  });
  return (
    <AbsoluteFill
      style={{
        justifyContent: 'center',
        alignItems: 'center',
        opacity: inK * outK,
        transform: `scale(${1 + (1 - inK) * 0.02})`,
      }}
    >
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 44,
        }}
      >
        <ThinRule width={300} />
        <div
          dir="rtl"
          style={{
            fontFamily: ARABIC_DISPLAY_FONT,
            fontSize: size,
            lineHeight: 1.9,
            color: '#F7F3E9',
            textAlign: 'center',
            maxWidth: 840,
            textShadow:
              '0 4px 30px rgba(0,0,0,0.85), 0 0 44px rgba(216,178,92,0.22)',
          }}
        >
          {bsLine}
        </div>
        <ThinRule width={300} />
      </div>
    </AbsoluteFill>
  );
};

const ActArabic: React.FC<{
  words: WordTiming[];
  startFrame: number;
  accent: string;
  refLabel: string;
}> = ({words, startFrame, accent, refLabel}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const local = frame - startFrame;
  const inK = ease(clamp01(local / 12));
  const refIn = ease(clamp01((local - 6) / 10));
  const refOut = local > 118 ? ease(clamp01((local - 118) / 10)) : 1;
  return (
    <AbsoluteFill style={{justifyContent: 'center', alignItems: 'center'}}>
      <div
        dir="rtl"
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 66,
          opacity: inK,
        }}
      >
        <div
          style={{
            fontFamily: UI_FONT,
            fontSize: 30,
            letterSpacing: 5,
            fontWeight: 600,
            color: '#D8B25C',
            opacity: refIn * refOut,
            textShadow: '0 2px 12px rgba(0,0,0,0.8)',
          }}
        >
          {refLabel}
        </div>
        <div style={{opacity: 1}}>
          <VerseBlock
            words={words}
            startFrame={startFrame}
            fontFamily={ARABIC_DISPLAY_FONT}
            baseSize={126}
            minSize={70}
            accent={accent}
            dimColor="#C9A57B"
            brightColor="#FFFFFF"
            withBrackets
            maxLines={3}
          />
        </div>
      </div>
    </AbsoluteFill>
  );
};

const ActUrdu: React.FC<{
  words: WordTiming[];
  startFrame: number;
  accent: string;
}> = ({words, startFrame, accent}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const local = frame - startFrame;
  const inK = ease(clamp01(local / 10));
  const linesNote = words.length > 10 ? 5 : words.length > 5 ? 4 : 3;
  void linesNote;
  return (
    <AbsoluteFill
      style={{
        justifyContent: 'flex-start',
        alignItems: 'center',
        paddingTop: 520,
        opacity: inK,
      }}
    >
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 50,
        }}
      >
        <ThinRule width={240} />
        <div style={{transform: 'translateY(-8px)'}}>
          <VerseBlock
            words={words}
            startFrame={startFrame}
            fontFamily={NASKH_URDU}
            baseSize={88}
            minSize={54}
            accent={accent}
            dimColor="rgba(201,165,123,0.95)"
            brightColor="#FFFFFF"
            maxLines={5}
          />
        </div>
      </div>
    </AbsoluteFill>
  );
};

const Closing: React.FC<{
  data: DuaManifest;
  accent: string;
}> = ({data, accent}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const t = frame / fps;
  const k = ease(clamp01(t / 0.5));
  return (
    <AbsoluteFill
      style={{
        justifyContent: 'center',
        alignItems: 'center',
        opacity: k,
        transform: `scale(${1 + (1 - k) * 0.03})`,
        background: 'rgba(2,4,9,0.42)',
      }}
    >
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 40,
        }}
      >
        <ThinRule width={220} />
        <div
          dir="rtl"
          style={{
            fontFamily: ARABIC_DISPLAY_FONT,
            fontSize: 76,
            lineHeight: 1.9,
            color: '#F7F3E9',
            textAlign: 'center',
            textShadow: '0 4px 28px rgba(0,0,0,0.9)',
          }}
        >
          آمین یا رَبَّ العالَمين
        </div>
        <ThinRule width={220} />
        <div
          style={{
            fontFamily: UI_FONT,
            fontSize: 27,
            letterSpacing: 6,
            fontWeight: 600,
            color: 'rgba(247,243,233,0.72)',
          }}
        >
          {(data.channel && data.channel.name) || 'Dua Series'}
        </div>
        <div
          style={{
            fontFamily: UI_FONT,
            fontSize: 24,
            letterSpacing: 4,
            fontWeight: 700,
            color: accent,
          }}
        >
          SUBSCRIBE
        </div>
      </div>
    </AbsoluteFill>
  );
};

export const EditorialVideo: React.FC<{data: DuaManifest}> = ({data}) => {
  ensureFonts();
  const {fps} = useVideoConfig();
  const theme = getLuminousTheme(data.template || 'luminous');

  const arabicWords: WordTiming[] = data.arabicWords || [];
  const urduWords: WordTiming[] = data.urduWords || [];
  const bismillah = arabicWords.slice(0, 4).map((w) => w.t).join(' ');
  const verseWords = arabicWords.length > 4 ? arabicWords.slice(4) : arabicWords;

  const urduPhaseStart =
    (data.sections && data.sections.urduStart ? data.sections.urduStart : 0) * fps +
    L_INTRO;
  const contentFrames = Math.ceil((data.totalDuration || 15) * fps);
  const refLabel = data.reference || '';

  return (
    <AbsoluteFill style={{background: theme.bgGradient}}>
      {/* quiet ambient - no starfield, no geometry, no particles */}
      <AbsoluteFill
        style={{
          background: `radial-gradient(60% 38% at 50% 10%, ${theme.glowColor}, transparent 70%)`,
        }}
      />
      <AbsoluteFill
        style={{
          background: `radial-gradient(140% 100% at 50% 50%, transparent 60%, ${theme.vignette} 100%)`,
        }}
      />

      {/* ACT I - bismillah poster */}
      <Sequence from={0} durationInFrames={L_INTRO} name="act-bismillah">
        <ActBismillah bsLine={bismillah} />
      </Sequence>

      {/* ACT II - whole arabic verse calligraphy */}
      {verseWords.length > 0 && (
        <Sequence
          from={56}
          durationInFrames={Math.max(1, urduPhaseStart - 56)}
          name="act-arabic"
        >
          <ActArabic
            words={verseWords}
            startFrame={56}
            accent={theme.accent}
            refLabel={refLabel}
          />
        </Sequence>
      )}

      {/* ACT III - urdu meaning block */}
      {urduWords.length > 0 && (
        <Sequence
          from={urduPhaseStart}
          durationInFrames={Math.max(1, L_INTRO + contentFrames - urduPhaseStart)}
          name="act-urdu"
        >
          <ActUrdu words={urduWords} startFrame={urduPhaseStart} accent={theme.accent} />
        </Sequence>
      )}

      {/* ACT IV - closing panel */}
      <Sequence
        from={L_INTRO + contentFrames - 14}
        durationInFrames={EDIT_END_FRAMES}
        name="closing"
      >
        <Closing data={data} accent={theme.accent} />
      </Sequence>

      <Audio src={staticFile(data.audioFile)} />
    </AbsoluteFill>
  );
};