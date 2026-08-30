import React from 'react';
import {
  AbsoluteFill,
  Audio,
  Easing,
  Sequence,
  interpolate,
  spring,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from 'remotion';
import {measureText} from '@remotion/layout-utils';
import {Background} from './Background';
import {GradeLayer} from './GradeLayer';
import {KaraokeText} from './KaraokeText';
import {ARABIC_FONT, EMOJI_FONT, ensureFonts, UI_FONT, URDU_FONT} from './fonts';
import type {DuaManifest} from './types';
import {accentTint, getTheme, type Theme} from './themes';
import {resolveStyle, type ResolvedStyle} from './stylePresets';
import {ArtFxLayer} from './ArtFx';
import {SkyFxLayer} from './SkyFx';
import {BorderFxLayer} from './BorderFx';
import {LookTint} from './FrameStyles';
import {
  CameraMove,
  GeometricBackdrop,
  IntroCard,
  MotifLayer,
  OrnamentLayer,
} from './LookVariants';

export const INTRO_FRAMES = 66;
export const END_FRAMES = 74;

// auto-fit: shrink font size until wrapped text block fits the safe area
const fitFontSize = (opts: {
  text: string;
  fontFamily: string;
  baseSize: number;
  minSize: number;
  maxWidth: number;
  maxHeight: number;
  lineHeight: number;
}): number => {
  let size = opts.baseSize;
  for (let i = 0; i < 6; i++) {
    const {width} = measureText({
      text: opts.text,
      fontFamily: opts.fontFamily,
      fontWeight: '400',
      fontSize: size,
    });
    const lines = Math.max(1, Math.ceil(width / opts.maxWidth));
    const blockHeight = lines * size * opts.lineHeight;
    if (blockHeight <= opts.maxHeight || size <= opts.minSize) break;
    size = Math.max(
      opts.minSize,
      Math.floor(size * Math.sqrt(opts.maxHeight / blockHeight)),
    );
  }
  return size;
};

const SparkleBurst: React.FC<{accent: string}> = ({accent}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const sparkles = React.useMemo(
    () =>
      Array.from({length: 16}, (_, i) => ({
        ang: (i / 16) * Math.PI * 2 + (i % 3) * 0.2,
        dist: 150 + ((i * 53) % 90),
        size: 5 + (i % 4) * 2.5,
        delay: i % 4,
      })),
    [],
  );
  return (
    <div style={{position: 'absolute', inset: 0, pointerEvents: 'none'}}>
      {sparkles.map((s, i) => {
        const op = interpolate(frame, [6 + s.delay, 14 + s.delay, 40 + s.delay, 54], [0, 1, 1, 0], {
          extrapolateLeft: 'clamp',
          extrapolateRight: 'clamp',
        });
        const d = spring({
          frame: frame - s.delay,
          fps,
          config: {damping: 14, stiffness: 60},
        });
        const x = Math.cos(s.ang) * s.dist * d;
        const y = Math.sin(s.ang) * s.dist * d;
        return (
          <div
            key={i}
            style={{
              position: 'absolute',
              left: '50%',
              top: '34%',
              width: s.size,
              height: s.size,
              borderRadius: '50%',
              background: i % 2 ? '#fff8e0' : accent,
              opacity: op,
              transform: `translate(${x}px, ${y}px)`,
              boxShadow: `0 0 ${s.size * 2.5}px ${i % 2 ? '#ffe9a0' : accent}`,
            }}
          />
        );
      })}
    </div>
  );
};

const CTA_VARIANTS = [
  {label: 'SUBSCRIBE ▶', bg: 'linear-gradient(135deg, #e03131, #b02525)', shadow: 'rgba(224,49,49,0.45)', color: '#ffffff'},
  {label: 'LIKE 👍', bg: 'linear-gradient(135deg, #1971c2, #1864ab)', shadow: 'rgba(25,113,196,0.45)', color: '#ffffff'},
  {label: 'SHARE ↗', bg: 'linear-gradient(135deg, #2f9e44, #2b8a3e)', shadow: 'rgba(47,158,68,0.45)', color: '#ffffff'},
  {label: 'FOLLOW ✦', bg: 'linear-gradient(135deg, #d4af37, #b8912e)', shadow: 'rgba(212,175,55,0.45)', color: '#171204'},
];

const ctaFor = (duaId: string) => {
  let h = 0;
  for (let i = 0; i < duaId.length; i++) h += duaId.charCodeAt(i);
  return CTA_VARIANTS[h % CTA_VARIANTS.length];
};

const EndCard: React.FC<{data: DuaManifest; theme: Theme}> = ({data, theme}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const cta = ctaFor(data.dua_id);

  const fadeIn = interpolate(frame, [4, 20], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const emojiPop = spring({frame: frame - 6, fps, config: {damping: 10}});
  const btnPop = spring({
    frame: frame - 22,
    fps,
    config: {damping: 12, stiffness: 160},
  });

  return (
    <AbsoluteFill
      style={{
        justifyContent: 'center',
        alignItems: 'center',
        opacity: fadeIn,
      }}
    >
      <SparkleBurst accent={theme.accent} />
      <div style={{textAlign: 'center', padding: '0 100px'}}>
        <div
          style={{
            fontFamily: EMOJI_FONT,
            fontSize: 110,
            transform: `scale(${emojiPop})`,
            marginBottom: 26,
          }}
        >
          🤲✨
        </div>
        <div
          style={{
            fontFamily: UI_FONT,
            fontSize: 58,
            fontWeight: 700,
            color: theme.arabicColor,
            textShadow: `0 4px 24px rgba(0,0,0,0.35), 0 0 10px ${theme.accent}33`,
            lineHeight: 1.35,
          }}
        >
          {data.title}
        </div>
        <div
          style={{
            fontFamily: UI_FONT,
            fontSize: 32,
            letterSpacing: '0.24em',
            color: theme.accent,
            marginTop: 20,
          }}
        >
          {data.reference.toUpperCase()}
        </div>
        <div
          style={{
            width: 180,
            height: 2,
            margin: '30px auto',
            background:
              `linear-gradient(90deg, transparent, ${theme.accent}, transparent)`,
          }}
        />
        <div
          style={{
            display: 'inline-block',
            fontFamily: UI_FONT,
            fontSize: 36,
            fontWeight: 700,
            letterSpacing: '0.08em',
            color: cta.color,
            background: cta.bg,
            borderRadius: 60,
            padding: '18px 58px',
            boxShadow: `0 10px 40px ${cta.shadow}`,
            transform: `scale(${Math.max(0, btnPop)})`,
          }}
        >
          {cta.label}
        </div>
        {data.channel && (data.channel.name || data.channel.handle) ? (
          <div
            style={{
              fontFamily: UI_FONT,
              fontSize: 28,
              fontWeight: 600,
              color: theme.accent,
              marginTop: 34,
              opacity: interpolate(frame, [30, 44], [0, 1], {
                extrapolateLeft: 'clamp',
                extrapolateRight: 'clamp',
              }),
            }}
          >
            {data.channel.name}
            {data.channel.name && data.channel.handle ? '  •  ' : ''}
            {data.channel.handle}
          </div>
        ) : null}
      </div>
    </AbsoluteFill>
  );
};

// RANDOM LOOK MODE (2026-08-23): server har render se pehle poora look
// chunta hai (temp/<id>_look.json -> --props). Video ke andar sab isi se
// chalta hai => retry/thumb hamesha match. Remotion me koi randomness nahi.
//
// MASTER LOOK v3: naye dimensions (textFx/motif/gradeFx/camera/introFx/
// ornament) LookVariants.tsx + fx-guardrails LOOK_DIMENSIONS registry se
// aate hain - plugin architecture, naya idea = ek entry.
export interface LookSpec {
  seed?: number;
  preset?: string;
  borderFx?: string;
  skyFx?: string;
  artFx?: string;
  // MASTER LOOK v2: frame design + canvas color harmony
  frame?: string;
  tint?: {c1: string; c2: string; a: number};
  // MASTER LOOK v3: plugin dimensions (sab optional => backward-safe)
  textFx?: string;
  motif?: string;
  gradeFx?: string;
  camera?: string;
  introFx?: string;
  ornament?: string;
}

export const DuaVideo: React.FC<{
  data: DuaManifest;
  stylePreset?: string;
  lookSpec?: LookSpec | null;
  // legacy flat look fields (purane server files top-level bhejte the)
  seed?: number;
  preset?: string;
  borderFx?: string;
  skyFx?: string;
  artFx?: string;
  frame?: string;
  tint?: LookSpec['tint'];
  textFx?: string;
  motif?: string;
  gradeFx?: string;
  camera?: string;
  introFx?: string;
  ornament?: string;
}> = ({data, stylePreset, lookSpec: lsRaw, ...flat}) => {
  ensureFonts();
  // MASTER LOOK robustness: lookSpec nested bhi aa sakta hai (naya server)
  // aur flat top-level bhi (legacy files). Dono ko ek shape me le lo.
  const lookSpec: LookSpec | null =
    lsRaw ||
    (typeof flat.preset === 'string'
      ? {
          seed: typeof flat.seed === 'number' ? flat.seed : undefined,
          preset: flat.preset as string,
          borderFx: flat.borderFx as string | undefined,
          skyFx: flat.skyFx as string | undefined,
          artFx: flat.artFx as string | undefined,
          frame: flat.frame as string | undefined,
          tint: flat.tint as LookSpec['tint'],
          textFx: flat.textFx as string | undefined,
          motif: flat.motif as string | undefined,
          gradeFx: flat.gradeFx as string | undefined,
          camera: flat.camera as string | undefined,
          introFx: flat.introFx as string | undefined,
          ornament: flat.ornament as string | undefined,
        }
      : null);
  const frame = useCurrentFrame();
  const {fps, height, durationInFrames} = useVideoConfig();

  // AUTO preset rotation (2026-08-23): jab dashboard koi specific preset na
  // bheje (auto mode), har dua ko apna deterministic preset milta hai -
  // same id => same preset, re-render par stable. Hash convention wahi hai
  // jo themes/voices use karti hain (charCode sum % pool).
  // BATCH-2: 5 -> 15 presets (CGI/VFX extension).
  const AUTO_PRESETS = [
    'classic', 'royal', 'minimal', 'cinematic', 'masterpiece',
    'volumetric', 'raytrace', 'embernight', 'glitterroyal',
    'desertmirage', 'waterripple', 'silkmarble', 'cinemafocus',
    'auroranova', 'qadrtilt',
  ];
  const autoPresetFor = (id?: string): string =>
    AUTO_PRESETS[
      String(id || '')
        .split('')
        .reduce((a, c) => a + c.charCodeAt(0), 0) % AUTO_PRESETS.length
    ];

  const theme = getTheme(data.template);
  // masterpiece flag -> hidden preset force (dashboard setting override);
  // ya user ne settings me masterpiece select kiya -> sab videos pe FX
  // Resolution order: masterpiece flag > lookSpec.preset (random mode) >
  // explicit stylePreset prop > deterministic hash rotation (legacy auto).
  const presetFinal = data.masterpiece
    ? 'masterpiece'
    : (lookSpec && lookSpec.preset) || stylePreset ||
      autoPresetFor(data.dua_id);
  const S: ResolvedStyle = resolveStyle(presetFinal);

  const contentFrames = Math.ceil(data.totalDuration * data.fps);
  const localFrame = frame - INTRO_FRAMES;
  const t = localFrame / fps;

  const {urduStart} = data.sections;
  const urduStartFrame = urduStart * fps + INTRO_FRAMES;

  // auto-fit font sizes (long duas shrink instead of overflowing)
  const {arSize, urSize} = React.useMemo(() => {
    const arabicPlain = data.arabicWords.map((w) => w.t).join(' ');
    const urduPlain = data.urduWords.map((w) => w.t).join(' ');
    return {
      arSize: fitFontSize({
        text: arabicPlain,
        fontFamily: ARABIC_FONT,
        baseSize: 104,
        minSize: 58,
        maxWidth: 850,
        maxHeight: 1150,
        lineHeight: 1.95,
      }),
      urSize: fitFontSize({
        text: urduPlain,
        fontFamily: URDU_FONT,
        baseSize: 50,
        minSize: 32,
        maxWidth: 850,
        maxHeight: 1250,
        lineHeight: 2.3,
      }),
    };
  }, [data]);

  // light sweep window around phase change (bright pulse)
  const sweepProgress = interpolate(
    frame,
    [urduStartFrame - 10, urduStartFrame + 16],
    [-70, 70],
    {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'},
  );

  // continuous ambient sweeps: preset cycle length, direction alternate
  const SWEEP_CYCLE = Math.round(fps * S.sweepCycleSec);
  const cycleIdx = Math.floor(frame / SWEEP_CYCLE);
  const cyclePos = (frame % SWEEP_CYCLE) / SWEEP_CYCLE;
  const ambDir = cycleIdx % 2 === 0 ? 1 : -1;
  const ambProgress = ambDir === 1
    ? -70 + cyclePos * 140
    : 70 - cyclePos * 140;
  // edges pe fade, mid-pass full strength (preset alpha scale)
  const ambAlpha = Math.sin(cyclePos * Math.PI) * S.sweepAmbientAlpha;

  // clock-wipe reveal for Urdu phase (visual only, audio sync untouched)
  // NOTE: 400 tak jana ZARURI hai - soft edge (wipeDeg-40) ko poora
  // 360deg cross karwane ke liye. Warna 330-370 ka wedge hamesha
  // invisible reh jata tha (bottom-left = RTL urdu lines ka tail cut!)
  // clock-wipe reveal for Urdu phase (visual only, audio sync untouched)
  // NOTE: 400 tak jana ZARURI hai - soft edge (wipeDeg-40) ko poora
  // 360deg cross karwane ke liye. Warna 330-370 ka wedge hamesha
  // invisible reh jata tha (bottom-left = RTL urdu lines ka tail cut!)
  const wipeDeg = interpolate(
    frame,
    [urduStartFrame - 3, urduStartFrame + 20],
    [0, 400],
    {extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: Easing.out(Easing.cubic)},
  );
  const clockWipeMask =
    wipeDeg >= 400
      ? undefined
      : `conic-gradient(from -90deg, rgba(0,0,0,1) 0deg, rgba(0,0,0,1) ` +
        `${Math.max(0, wipeDeg - 40)}deg, rgba(0,0,0,0) ${Math.max(0, wipeDeg)}deg, ` +
        `rgba(0,0,0,0) 360deg)`;

  const arIn = interpolate(localFrame, [4, 20], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const arOut = interpolate(
    localFrame,
    [urduStart * fps - 8, urduStart * fps + 6],
    [1, 0],
    {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'},
  );
  const arabicOpacity = Math.min(arIn, arOut);
  const arabicY = interpolate(arIn, [0, 1], [46, 0]);

  const urIn = interpolate(
    localFrame,
    [urduStart * fps - 2, urduStart * fps + 14],
    [0, 1],
    {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'},
  );
  const urduOpacity = urIn;
  const urduY = interpolate(urIn, [0, 1], [46, 0]);

  const titleIn = interpolate(localFrame, [2, 16], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const titleOut = interpolate(
    frame,
    [durationInFrames - END_FRAMES - 6, durationInFrames - END_FRAMES + 6],
    [1, 0],
    {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'},
  );

  // BATCH 3 · camera scale-punch + bloom at both phase boundaries
  const phasePunchFrames = React.useMemo(
    () => [INTRO_FRAMES, urduStartFrame],
    [urduStartFrame],
  );

  // BATCH 3 · restrained specular edge bleed for typography (paper = ink tone)
  const accentGlow =
    theme.decor === 'paper' ? 'rgba(110,80,30,0.30)' : `${theme.accent}59`;

  // VFX: blur at phase change; text-layer zoom resynced to the same 18-frame
  // bell as the camera punch (camera carries the main 3.5%, text adds 2%)
  // PHASE 1 P0: snap to discrete 1px steps + floor at 0.5px. Eliminates
  // per-frame fractional blur radii -> fewer GPU context switches, identical
  // visual outcome at full strength (5px at the phase boundary).
  const dPhase = Math.abs(localFrame - urduStart * fps);
  const phaseBlurRaw = interpolate(dPhase, [0, 10], [5, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const phaseBlur = phaseBlurRaw < 0.5 ? 0 : Math.ceil(phaseBlurRaw);
  const zpT = (localFrame - (urduStart * fps - 9)) / 18;
  const zoomPunch =
    zpT > 0 && zpT < 1 ? 1 + 0.02 * Math.sin(Math.PI * zpT) : 1;

  return (
    <AbsoluteFill
      style={{
        background: theme.bgGradient,
        // per-theme color treatment (dark lift / light highlight control)
        filter:
          `brightness(${theme.grade.brightness}) ` +
          `contrast(${theme.grade.contrast}) saturate(${theme.grade.saturate})`,
      }}
    >
      {/* MASTER LOOK v3: cinematic camera move (static = purana behavior) */}
      <CameraMove id={lookSpec?.camera} seed={lookSpec?.seed}>
        <Background
          theme={theme}
          stylePreset={S}
          presetId={presetFinal}
          masterpiece={!!data.masterpiece || presetFinal === 'masterpiece'}
          punchFrames={phasePunchFrames}
          lookFrame={lookSpec?.frame}
          bgOverride={data.background}
          bgKind={data.backgroundKind as 'image' | 'video' | undefined}
        />
    {/* MASTER LOOK v2: canvas color harmony veil (preset mood ke hisab se) */}
    <LookTint tint={lookSpec?.tint} />

    {/* MASTER LOOK v3: floating Islamic motif (tasbih/kaaba/rehal/star8) */}
    <MotifLayer
      id={lookSpec?.motif}
      seed={lookSpec?.seed}
      accent={theme.accent}
      decor={theme.decor}
    />

    {/* MASTER LOOK v3: full-frame geometric lattice backdrop (M5) */}
    <GeometricBackdrop
      kind={lookSpec?.motif}
      accent={theme.accent}
      opacity={0.06}
    />

      {/* PHASE A: Border FX (kinare/sky-zone) */}
      <BorderFxLayer
        fx={lookSpec?.borderFx}
        seed={lookSpec?.seed}
        theme={theme}
      />

      {/* PHASE C: Islamic Art FX overlay (random-look artFx se chalta hai) */}
      <ArtFxLayer
        fx={lookSpec?.artFx}
        seed={lookSpec?.seed}
        theme={theme}
      />

      {/* PHASE B: Sky/Weather FX (sab se upar, text se neeche) */}
      <SkyFxLayer
        fx={lookSpec?.skyFx}
        seed={lookSpec?.seed}
      />

      <Sequence from={0} durationInFrames={INTRO_FRAMES}>
        <IntroCard theme={theme} variant={lookSpec?.introFx} />
      </Sequence>

      <Sequence
        from={INTRO_FRAMES}
        durationInFrames={contentFrames}
      >
        <div
          style={{
            position: 'absolute',
            top: 150,
            left: 0,
            right: 0,
            textAlign: 'center',
            opacity: Math.min(titleIn, titleOut),
          }}
        >
          <div
            style={{
              fontFamily: UI_FONT,
              fontSize: 34,
              letterSpacing: '0.22em',
              color: theme.accent,
              // luminous gold on dark scenes, soft shadow on light paper
              textShadow:
                theme.decor === 'paper'
                  ? '0 2px 10px rgba(90,60,20,0.25)'
                  : `0px 4px 12px rgba(0,0,0,0.85), 0px 0px 8px ${theme.accent}44`,
            }}
          >
            {data.reference.toUpperCase()}
          </div>
          <div
            style={{
              width: 120,
              height: 2,
              margin: '12px auto 0',
              background:
                `linear-gradient(90deg, transparent, ${theme.accent}, transparent)`,
            }}
          />
        </div>

        <AbsoluteFill
          style={{
            justifyContent: 'center',
            alignItems: 'center',
            padding: '0 115px',
            opacity: arabicOpacity,
            transform: `translateY(${arabicY}px) scale(${zoomPunch})`,
            filter: phaseBlur > 0 ? `blur(${phaseBlur.toFixed(2)}px)` : undefined,
          }}
        >
          <div
            style={{
              position: 'absolute',
              inset: 0,
              background: `radial-gradient(ellipse 60% 46% at 50% 50%, ${
                theme.decor === 'paper'
                  ? 'rgba(90,60,20,0.30)'
                  : 'rgba(0,0,0,0.42)'
              } 0%, transparent 72%)`,
              pointerEvents: 'none',
            }}
          />
          <div
            style={{
              position: 'absolute',
              inset: 0,
              background: `radial-gradient(ellipse 55% 42% at 50% 50%, ${accentGlow} 0%, transparent 68%)`,
              opacity: 0.5,
              pointerEvents: 'none',
            }}
          />
          <KaraokeText
            words={data.arabicWords}
            fontSize={arSize}
            fontFamily={ARABIC_FONT}
            color={theme.arabicColor}
            pastColor={theme.pastColor}
            futureColor={theme.futureColor}
            activeColor={theme.activeText}
            pillColor={theme.pillFrom}
            pillTo={theme.pillTo}
            lineHeight={1.95}
            accentGlow={accentGlow}
            mode={lookSpec?.textFx || 'glide'}
          />
        </AbsoluteFill>

        <AbsoluteFill
          style={{
            justifyContent: 'center',
            alignItems: 'center',
            padding: `0 115px ${Math.round(height * 0.09)}px 115px`,
            opacity: urduOpacity,
            transform: `translateY(${urduY}px) scale(${zoomPunch})`,
            filter: phaseBlur > 0 ? `blur(${phaseBlur.toFixed(2)}px)` : undefined,
            maskImage: clockWipeMask,
            WebkitMaskImage: clockWipeMask,
          }}
        >
          <div
            style={{
              position: 'absolute',
              inset: 0,
              background: `radial-gradient(ellipse 60% 46% at 50% 50%, ${
                theme.decor === 'paper'
                  ? 'rgba(90,60,20,0.30)'
                  : 'rgba(0,0,0,0.42)'
              } 0%, transparent 72%)`,
              pointerEvents: 'none',
            }}
          />
          <div
            style={{
              position: 'absolute',
              inset: 0,
              background: `radial-gradient(ellipse 55% 42% at 50% 50%, ${accentGlow} 0%, transparent 68%)`,
              opacity: 0.5,
              pointerEvents: 'none',
            }}
          />
          <KaraokeText
            words={data.urduWords}
            fontSize={urSize}
            fontFamily={URDU_FONT}
            color={theme.urduColor}
            pastColor={theme.pastColor}
            futureColor={theme.futureColor}
            activeColor={theme.activeText}
            pillColor={theme.pillFrom}
            pillTo={theme.pillTo}
            lineHeight={2.3}
            accentGlow={accentGlow}
            mode={lookSpec?.textFx || 'glide'}
          />
        </AbsoluteFill>

        <div
          style={{
            position: 'absolute',
            top: 66,
            left: 0,
            right: 0,
            display: 'flex',
            justifyContent: 'center',
            pointerEvents: 'none',
          }}
        >
          <OrnamentLayer
            id={lookSpec?.ornament || 'starcrescent'}
            frame={frame}
            fps={fps}
            opacity={Math.min(titleIn, titleOut)}
            scale={S.ornamentScale}
            swayDeg={S.ornamentSwayDeg}
            accent={theme.accent}
          />
        </div>

        {/* phase-change bright sweep (preset alpha, theme-adaptive tint) */}
        <div
          style={{
            position: 'absolute',
            inset: '-20%',
            background: `linear-gradient(105deg, transparent 42%, ${accentTint(
              theme.accent,
              S.sweepPhaseAlpha,
            )} 50%, transparent 58%)`,
            transform: `translateX(${sweepProgress}%)`,
            pointerEvents: 'none',
          }}
        />

        {/* continuous ambient sweep (alternating L->R / R->L) */}
        <div
          style={{
            position: 'absolute',
            inset: '-20%',
            background: `linear-gradient(105deg, transparent 43%, ${accentTint(
              theme.accent,
              0.13,
            )} 50%, transparent 57%)`,
            transform: `translateX(${ambProgress}%)`,
            opacity: ambAlpha,
            pointerEvents: 'none',
          }}
        />
      </Sequence>

      {/* progress bar — lifted + inset into the platform-safe band so it
          never collides with Shorts/Reels/TikTok bottom UI or gesture bars */}
      <div
        style={{
          position: 'absolute',
          bottom: 18,
          left: 28,
          right: 28,
          height: 4,
          borderRadius: 999,
          background: 'rgba(255,255,255,0.14)',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            height: '100%',
            width: `${(frame / durationInFrames) * 100}%`,
            background: `linear-gradient(90deg, ${theme.pillFrom}, ${theme.pillTo})`,
            boxShadow: `0 0 10px ${theme.accent}`,
            borderRadius: 999,
          }}
        />
      </div>

      <Sequence
        from={INTRO_FRAMES + contentFrames - 14}
        durationInFrames={END_FRAMES}
      >
        <EndCard data={data} theme={theme} />
      </Sequence>
      </CameraMove>

      <Sequence from={INTRO_FRAMES} durationInFrames={contentFrames}>
        <Audio src={staticFile(data.audioFile)} />
      </Sequence>

      {data.sfx?.whoosh ? (
        <Sequence from={urduStartFrame - 8} durationInFrames={30}>
          <Audio src={staticFile(data.sfx.whoosh)} volume={0.22} playbackRate={0.9} />
        </Sequence>
      ) : null}
      {data.sfx?.riser ? (
        <Sequence from={durationInFrames - END_FRAMES - 40} durationInFrames={48}>
          <RampAudio src={data.sfx.riser} dur={48} rate={0.68} />
        </Sequence>
      ) : null}
      {data.sfx?.tick ? (
        <Sequence from={INTRO_FRAMES + contentFrames + 20} durationInFrames={12}>
          <Audio src={staticFile(data.sfx.tick)} volume={0.14} playbackRate={0.8} />
        </Sequence>
      ) : null}

      <GradeLayer themeId={data.template} moodId={lookSpec?.gradeFx} />
    </AbsoluteFill>
  );
};

const RampAudio: React.FC<{src: string; dur: number; rate?: number}> = ({src, dur, rate = 1}) => {
  const f = useCurrentFrame();
  return (
    <Audio
      src={staticFile(src)}
      playbackRate={rate}
      volume={interpolate(f, [0, dur], [0.01, 0.08], {
        extrapolateLeft: 'clamp',
        extrapolateRight: 'clamp',
      })}
    />
  );
};
