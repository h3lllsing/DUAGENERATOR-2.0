import React from 'react';
import {
  AbsoluteFill,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from 'remotion';
import {noise2D} from '@remotion/noise';
import type {Theme} from './themes';
import {ARABIC_FONT} from './fonts';
import {easeInOut, easeOut} from './easing';

// ==========================================================================
// LOOK VARIANTS - plugin module (MASTER LOOK v3)
// -------------------------------------------------------------------------
// Naya variant add karna ho to: ID array me ek id + neeche switch me ek
// component. DuaVideo/look-spec kuch nahi badalna padta (registry-driven).
// Har dispatcher undefined id par SAFE DEFAULT deta hai => purane look
// files (jisme naye fields missing hain) backward-compatible rehte hain.
// ==========================================================================

// INTRO_FRAMES mirror (DuaVideo se circular import na ho)
const INTRO_END = 66;

// ------------------------------ ORNAMENTS --------------------------------

// deterministic SVG: crescent moon + 8-point star, gentle sway (no spin)
const StarCrescent: React.FC<{
  frame: number;
  fps: number;
  opacity: number;
  scale?: number;
  swayDeg?: number;
}> = ({frame, fps, opacity, scale = 1, swayDeg = 8}) => {
  const t = frame / fps;
  const sway = Math.sin(t * 0.9) * swayDeg;
  const pulse = 1 + 0.05 * Math.sin(t * 2.1);
  const pulseScale = pulse * scale;
  const alpha = 0.65 + 0.35 * Math.sin(t * 2.1);
  const sweepP = ((frame / (fps * 3.5)) % 1) * 2 - 1;
  const pts: string[] = [];
  for (let i = 0; i < 16; i++) {
    const ang = (Math.PI / 8) * i - Math.PI / 2;
    const rad = i % 2 === 0 ? 21 : 12.5;
    pts.push(`${(82 + Math.cos(ang) * rad).toFixed(2)},${(38 + Math.sin(ang) * rad).toFixed(2)}`);
  }
  return (
    <svg
      width="118"
      height="76"
      viewBox="0 0 118 76"
      style={{
        transform: `rotate(${sway}deg) scale(${pulseScale})`,
        transformOrigin: '50% 75%',
        opacity: opacity * alpha,
        filter: 'drop-shadow(0 0 7px rgba(217,173,89,0.55))',
      }}
    >
      <defs>
        <linearGradient
          id="orn-gold"
          x1="0"
          y1="0"
          x2="1"
          y2="0"
          gradientTransform={`translate(${sweepP.toFixed(3)} 0)`}
        >
          <stop offset="0%" stopColor="#6e5212" />
          <stop offset="24%" stopColor="#d4af37" />
          <stop offset="40%" stopColor="#fff3c4" />
          <stop offset="50%" stopColor="#ffe08a" />
          <stop offset="66%" stopColor="#d4af37" />
          <stop offset="100%" stopColor="#8a6a1f" />
        </linearGradient>
        <mask id="orn-cres">
          <rect width="118" height="76" fill="black" />
          <circle cx="34" cy="38" r="19" fill="white" />
          <circle cx="42" cy="33" r="16.5" fill="black" />
        </mask>
      </defs>
      <circle cx="34" cy="38" r="19" fill="url(#orn-gold)" mask="url(#orn-cres)" />
      <polygon
        points={pts.join(' ')}
        fill="none"
        stroke="url(#orn-gold)"
        strokeWidth="2.4"
        strokeLinejoin="round"
      />
      <circle cx="82" cy="38" r="3.2" fill="#fffbe8" />
    </svg>
  );
};

// hanging lantern jhumka pair, soft swing + inner glow pulse
const LanternJhumka: React.FC<{
  frame: number;
  fps: number;
  opacity: number;
  scale?: number;
  swayDeg?: number;
  accent?: string;
}> = ({frame, fps, opacity, scale = 1, swayDeg = 8, accent = '#d4af37'}) => {
  const t = frame / fps;
  const glow = 0.55 + 0.45 * Math.sin(t * 2.4);
  const lantern = (x: number, phase: number): React.ReactNode => (
    <g transform={`translate(${x} 0) rotate(${Math.sin(t * 1.1 + phase) * swayDeg * 0.7} 0 6)`}>
      <line x1="0" y1="0" x2="0" y2="14" stroke={accent} strokeWidth="1.6" opacity={opacity * 0.8} />
      <path
        d="M -9 14 L 9 14 L 12 26 L 4 30 L 4 42 L -4 42 L -4 30 L -12 26 Z"
        fill="none"
        stroke={accent}
        strokeWidth="2"
        strokeLinejoin="round"
        opacity={opacity * (0.75 + 0.25 * glow)}
      />
      <ellipse cx="0" cy="27" rx="4.6" ry="5.4" fill={accent} opacity={opacity * (0.35 + 0.5 * glow)} />
      <circle cx="0" cy="46" r="2.2" fill="#fff3c4" opacity={opacity * glow} />
    </g>
  );
  return (
    <svg
      width="118"
      height="76"
      viewBox="0 0 118 76"
      style={{
        transform: `scale(${scale})`,
        transformOrigin: '50% 10%',
        filter: `drop-shadow(0 0 ${6 + 4 * glow}px ${accent}66)`,
      }}
    >
      {lantern(46, 0)}
      {lantern(72, Math.PI / 3)}
    </svg>
  );
};

// ornamental rosette medallion, slow breathing pulse + rotation
const MedallionOrnament: React.FC<{
  frame: number;
  fps: number;
  opacity: number;
  scale?: number;
  accent?: string;
}> = ({frame, fps, opacity, scale = 1, accent = '#d4af37'}) => {
  const t = frame / fps;
  const breathe = 1 + 0.06 * Math.sin(t * 1.6);
  const rot = ((frame / (fps * 9)) % 1) * 360;
  return (
    <svg
      width="82"
      height="76"
      viewBox="0 0 82 76"
      style={{
        transform: `scale(${breathe * scale})`,
        opacity,
        filter: `drop-shadow(0 0 8px ${accent}55)`,
      }}
    >
      <g transform={`rotate(${rot.toFixed(2)} 41 38)`}>
        {Array.from({length: 8}, (_, i) => {
          const ang = (180 / 8) * i;
          return (
            <ellipse
              key={i}
              cx="41"
              cy="20"
              rx="7"
              ry="15"
              fill="none"
              stroke={accent}
              strokeWidth="1.8"
              transform={`rotate(${ang} 41 38)`}
            />
          );
        })}
      </g>
      <circle cx="41" cy="38" r="7.5" fill="none" stroke={accent} strokeWidth="2" />
      <circle cx="41" cy="38" r="2.6" fill="#fff3c4" />
    </svg>
  );
};

// geometric star lattice ornament (two overlapping squares)
const GeoStarOrnament: React.FC<{
  frame: number;
  fps: number;
  opacity: number;
  scale?: number;
  accent?: string;
}> = ({frame, fps, opacity, scale = 1, accent = '#d4af37'}) => {
  const t = frame / fps;
  const shimmer = 0.7 + 0.3 * Math.sin(t * 2);
  return (
    <svg
      width="96"
      height="76"
      viewBox="0 0 96 76"
      style={{
        transform: `scale(${scale})`,
        opacity: opacity * shimmer,
        filter: `drop-shadow(0 0 7px ${accent}55)`,
      }}
    >
      <rect x="24" y="14" width="48" height="48" fill="none" stroke={accent} strokeWidth="2.2" transform="rotate(45 48 38)" />
      <rect x="24" y="14" width="48" height="48" fill="none" stroke={accent} strokeWidth="2.2" />
      <circle cx="48" cy="38" r="4" fill="#fffbe8" />
    </svg>
  );
};

export const OrnamentLayer: React.FC<{
  id?: string;
  frame: number;
  fps: number;
  opacity: number;
  scale?: number;
  swayDeg?: number;
  accent?: string;
}> = ({id, frame, fps, opacity, scale = 1, swayDeg = 8, accent = '#d4af37'}) => {
  if (!opacity) return null;
  switch (id) {
    case 'lanternjhumka':
      return <LanternJhumka frame={frame} fps={fps} opacity={opacity} scale={scale} swayDeg={swayDeg} accent={accent} />;
    case 'medallion':
      return <MedallionOrnament frame={frame} fps={fps} opacity={opacity} scale={scale} accent={accent} />;
    case 'geostar':
      return <GeoStarOrnament frame={frame} fps={fps} opacity={opacity} scale={scale} accent={accent} />;
    case 'starcrescent':
    default:
      // default = classic look (purane videos jaisa hi)
      return <StarCrescent frame={frame} fps={fps} opacity={opacity} scale={scale} swayDeg={swayDeg} />;
  }
};

// ----------------------------- CAMERA MOVES ------------------------------
const hashDir = (seed?: number): number =>
  ((seed || 12345) % 2 === 0 ? 1 : -1);

// M1 · "koi frame static nahi" — even 'static' gets an imperceptible slow
// push-in + micro organic noise so a scene never reads dead. Extreme premium
// short-form standard. `static` = pure no-move (legacy/backward-safe).
const BASE_DRIFT = 0.030; // ~3.0% total push-in across the clip (M1 depth)
const NOISE_AMP_PX = 5; // sub-pixel organic wander amplitude (slightly livelier)

// Poore visual stack ko cinematic camera move deta hai. Scale hamesha >= 1
// rakha hai taake koi kinaara khali na dikhe. static = purana behavior.
export const CameraMove: React.FC<{
  id?: string;
  seed?: number;
  children: React.ReactNode;
}> = ({id, seed, children}) => {
  const frame = useCurrentFrame();
  const {durationInFrames, fps} = useVideoConfig();
  if (!id || id === 'static') {
    // M1 · base cinematic drift: halka push-in + micro noise. Abhi bhi
    // "nyaa Andar kitna bhi" nahi — negligible motion, premium feel.
    const nd = hashDir(seed);
    const driftScale = 1 + BASE_DRIFT * Math.min(1, frame / 40);
    const nx = noise2D('cam-static-x', frame * 0.004, 7.3) * NOISE_AMP_PX;
    const ny = noise2D('cam-static-y', frame * 0.004, 13.9) * NOISE_AMP_PX;
    return (
      <div
        style={{
          position: 'absolute',
          inset: 0,
          transform: `translate(${nx.toFixed(2)}px, ${ny.toFixed(2)}px) scale(${driftScale.toFixed(4)})`,
          willChange: 'transform',
        }}
      >
        {children}
      </div>
    );
  }
  // M1 · eased cinematic progress (start/end smooth, beech mein flow)
  const raw = Math.min(1, Math.max(0, frame / Math.max(1, durationInFrames)));
  const p = easeInOut(raw);
  const dir = hashDir(seed);
  let tf = 'none';
  if (id === 'zoomin') {
    tf = `scale(${(1 + 0.055 * p).toFixed(4)})`;
  } else if (id === 'panx') {
    // ease + subtle perlin micro-drift on the perpendicular axis
    const sway = noise2D('cam-panx', frame * 0.008, 21.5) * 3;
    tf = `translateX(${(dir * (p - 0.5) * 2.6).toFixed(3)}%) translateY(${sway.toFixed(2)}px) scale(1.045)`;
  } else if (id === 'kenburns') {
    // eased double-axis + slight rotation + micro-drift; scale eases in
    const swayX = noise2D('cam-kb-x', frame * 0.006, 31.2) * 3;
    const swayY = noise2D('cam-kb-y', frame * 0.006, 43.4) * 3;
    tf =
      `translateY(${(-(p - 0.5) * 1.4).toFixed(3)}%) ` +
      `translate(${swayX.toFixed(2)}px, ${swayY.toFixed(2)}px) ` +
      `rotate(${(dir * (p - 0.5) * 0.7).toFixed(3)}deg) ` +
      `scale(${(1.03 + 0.05 * p).toFixed(4)})`;
  } else if (id === 'driftbreathe') {
    const t = frame / fps;
    tf =
      `translateX(${(Math.sin(t * 0.22) * 0.9).toFixed(3)}%) ` +
      `scale(${(1 + 0.02 + 0.016 * Math.sin(t * 0.31)).toFixed(4)})`;
  } else {
    // unknown id => static-safe (with base drift via the static branch above)
    const nd = hashDir(seed);
    const driftScale = 1 + BASE_DRIFT * Math.min(1, frame / 40);
    const nx = noise2D('cam-unk-x', frame * 0.004, 57.8) * NOISE_AMP_PX;
    const ny = noise2D('cam-unk-y', frame * 0.004, 61.1) * NOISE_AMP_PX;
    return (
      <div
        style={{
          position: 'absolute',
          inset: 0,
          transform: `translate(${nx.toFixed(2)}px, ${ny.toFixed(2)}px) scale(${driftScale.toFixed(4)})`,
          willChange: 'transform',
        }}
      >
        {children}
      </div>
    );
  }
  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        transform: tf,
        transformOrigin: '50% 50%',
        willChange: 'transform',
      }}
    >
      {children}
    </div>
  );
};

// -------------------------------- MOTIFS ---------------------------------
const hashPos = (seed: number | undefined, salt: number): number => {
  let h = (seed || 777) + salt * 131;
  h = (h ^ (h >> 7)) * 137;
  return Math.abs(h % 1000) / 1000;
};

const MotifSvg: React.FC<{kind: string; accent: string}> = ({kind, accent}) => {
  switch (kind) {
    case 'tasbih':
      return (
        <svg width="420" height="420" viewBox="0 0 200 200">
          {Array.from({length: 11}, (_, i) => {
            const ang = Math.PI * (0.18 + (i / 10) * 0.64);
            const x = 100 - Math.cos(ang) * 78;
            const y = 150 - Math.sin(ang) * 78;
            return <circle key={i} cx={x} cy={y} r="8" fill="none" stroke={accent} strokeWidth="2.6" />;
          })}
          <line x1="100" y1="150" x2="100" y2="182" stroke={accent} strokeWidth="2.6" />
          <circle cx="100" cy="188" r="6" fill="none" stroke={accent} strokeWidth="2.6" />
        </svg>
      );
    case 'kaaba':
      return (
        <svg width="420" height="420" viewBox="0 0 200 200">
          <rect x="52" y="58" width="96" height="96" rx="3" fill={accent} fillOpacity="0.14" stroke={accent} strokeWidth="3" />
          <rect x="52" y="84" width="96" height="13" fill={accent} fillOpacity="0.35" />
          <rect x="88" y="112" width="24" height="20" fill="none" stroke={accent} strokeWidth="2.4" />
        </svg>
      );
    case 'rehal':
      return (
        <svg width="420" height="420" viewBox="0 0 200 200">
          <path d="M 60 132 L 100 108 L 140 132" fill="none" stroke={accent} strokeWidth="3" strokeLinecap="round" />
          <path d="M 68 132 L 100 116 L 132 132" fill="none" stroke={accent} strokeWidth="2.4" strokeLinecap="round" />
          <path d="M 56 104 Q 100 84 144 104 L 144 112 Q 100 94 56 112 Z" fill={accent} fillOpacity="0.22" stroke={accent} strokeWidth="2.6" />
          <line x1="100" y1="90" x2="100" y2="102" stroke={accent} strokeWidth="2.2" />
        </svg>
      );
    case 'star8':
      return (
        <svg width="420" height="420" viewBox="0 0 200 200">
          <rect x="62" y="62" width="76" height="76" fill="none" stroke={accent} strokeWidth="2.6" />
          <rect x="62" y="62" width="76" height="76" fill="none" stroke={accent} strokeWidth="2.6" transform="rotate(45 100 100)" />
          <circle cx="100" cy="100" r="10" fill="none" stroke={accent} strokeWidth="2.4" />
        </svg>
      );
    // M5 · 12-point dodecagram: 3 squares @ 0/30/60deg => classic Star of
    // Laylat, universally recognized premium Islamic geometry.
    case 'dodecagram':
      return (
        <svg width="420" height="420" viewBox="0 0 200 200">
          {[0, 30, 60].map((a) => (
            <rect
              key={a}
              x="58"
              y="58"
              width="84"
              height="84"
              fill="none"
              stroke={accent}
              strokeWidth="2.6"
              transform={`rotate(${a} 100 100)`}
            />
          ))}
          <circle cx="100" cy="100" r="12" fill="none" stroke={accent} strokeWidth="2.2" />
          <circle cx="100" cy="100" r="3.4" fill={accent} />
        </svg>
      );
    // M5 · 16-point rosette (Lee construction): n petals radiating from center
    case 'rosette':
      return (
        <svg width="420" height="420" viewBox="0 0 200 200">
          {Array.from({length: 16}, (_, i) => {
            const a = (i / 16) * Math.PI * 2;
            const cx = 100 + Math.cos(a) * 46;
            const cy = 100 + Math.sin(a) * 46;
            return (
              <g key={i}>
                <circle cx={cx} cy={cy} r="15" fill="none" stroke={accent} strokeWidth="2.6" />
                <circle cx={cx} cy={cy} r="5" fill={accent} fillOpacity="0.5" stroke="none" />
              </g>
            );
          })}
          <circle cx="100" cy="100" r="58" fill="none" stroke={accent} strokeWidth="2" />
          <circle cx="100" cy="100" r="26" fill="none" stroke={accent} strokeWidth="2.4" />
        </svg>
      );
    // M5 · 8-fold strapwork: interlaced 8-point star over rotated squares
    case 'strapwork':
      return (
        <svg width="420" height="420" viewBox="0 0 200 200">
          {[0, 45].map((a) => (
            <rect
              key={a}
              x="50"
              y="50"
              width="100"
              height="100"
              fill="none"
              stroke={accent}
              strokeWidth="3"
              transform={`rotate(${a} 100 100)`}
            />
          ))}
          {Array.from({length: 8}, (_, i) => {
            const a = (i / 8) * Math.PI * 2;
            const r1 = 70;
            const r2 = 26;
            const x1 = 100 + Math.cos(a) * r1;
            const y1 = 100 + Math.sin(a) * r1;
            const x2 = 100 + Math.cos(a) * r2;
            const y2 = 100 + Math.sin(a) * r2;
            return <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke={accent} strokeWidth="2.4" />;
          })}
          <circle cx="100" cy="100" r="14" fill="none" stroke={accent} strokeWidth="2.6" />
        </svg>
      );
    default:
      return null;
  }
};

const MotifDrift: React.FC<{driftSec: number; children: React.ReactNode}> = ({
  driftSec,
  children,
}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const t = frame / fps;
  const dx = Math.sin(t / driftSec) * 14;
  const dy = Math.cos(t / (driftSec * 1.3)) * 10;
  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        transform: `translate(${dx.toFixed(2)}px, ${dy.toFixed(2)}px)`,
        pointerEvents: 'none',
      }}
    >
      {children}
    </div>
  );
};

// Halka sa bada Islamic icon background mein dheere-dheere tairta hai.
// Text se BILKUL peeche, opacity ~0.07 => readability zero impact.
export const MotifLayer: React.FC<{
  id?: string;
  seed?: number;
  accent?: string;
  decor?: string;
}> = ({id, seed, accent = '#d4af37', decor}) => {
  if (!id || id === 'none') return null;
  const px = 6 + hashPos(seed, 1) * 22;
  const py = 10 + hashPos(seed, 2) * 18;
  const drift = (1 + hashPos(seed, 3) * 1.4) * 10;
  return (
    <MotifDrift driftSec={drift}>
      <div
        style={{
          position: 'absolute',
          left: `${px}%`,
          top: `${py}%`,
          opacity: decor === 'paper' ? 0.18 : 0.30,
          pointerEvents: 'none',
          // halka glow taake thin strokes dark bg par bhi nazar aayen
          filter: `drop-shadow(0 0 14px ${accent}55)`,
        }}
      >
        <MotifSvg kind={id} accent={accent} />
      </div>
    </MotifDrift>
  );
};

// M5 · full-frame ambient geometric backdrop. A tiled interlace rendered
// behind the text at very low opacity + slow rotate = premium "lattice
// light" depth with zero readability impact. Pure background decor.
export const GeometricBackdrop: React.FC<{
  kind?: string;
  accent?: string;
  opacity?: number;
}> = ({kind, accent = '#d4af37', opacity = 0.06}) => {
  const frame = useCurrentFrame();
  if (!kind || kind === 'none') return null;
  const rot = ((frame / 600) % 1) * 360;
  const steps =
    kind === 'rosette'
      ? {petals: 16, r1: 70, r2: 24}
      : kind === 'dodecagram'
      ? {petals: 0, r1: 0, r2: 0}
      : {petals: 8, r1: 62, r2: 20}; // strapwork
  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        opacity,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        pointerEvents: 'none',
        willChange: 'transform',
      }}
    >
      <svg
        width="1600"
        height="1600"
        viewBox="0 0 400 400"
        style={{
          transform: `scale(1.35) rotate(${rot.toFixed(2)}deg)`,
          filter: `drop-shadow(0 0 20px ${accent}44)`,
        }}
      >
        <rect x="30" y="30" width="340" height="340" fill="none" stroke={accent} strokeWidth="1.4" />
        <rect x="30" y="30" width="340" height="340" fill="none" stroke={accent} strokeWidth="1.4" transform="rotate(45 200 200)" />
        {steps.petals > 0 &&
          Array.from({length: steps.petals}, (_, i) => {
            const a = (i / steps.petals) * Math.PI * 2;
            const x = 200 + Math.cos(a) * ((steps.r1 + steps.r2) / 2);
            const y = 200 + Math.sin(a) * ((steps.r1 + steps.r2) / 2);
            return <circle key={i} cx={x} cy={y} r={(steps.r1 - steps.r2) / 4} fill="none" stroke={accent} strokeWidth="1.2" />;
          })}
        {steps.r1 > 0 && (
          <>
            <circle cx="200" cy="200" r={(steps.r1 + steps.r2) / 2 + 26} fill="none" stroke={accent} strokeWidth="1.2" />
            <circle cx="200" cy="200" r={steps.r2} fill="none" stroke={accent} strokeWidth="1.2" />
          </>
        )}
      </svg>
    </div>
  );
};

// ----------------------------- INTRO VARIANTS ----------------------------
const BISMILLAH =
  '\u0628\u0650\u0633\u0652\u0645\u0650 \u0627\u0644\u0644\u0651\u064e\u0647\u0650 \u0627\u0644\u0631\u0651\u064e\u062d\u0652\u0645\u064e\u0670\u0646\u0650 \u0627\u0644\u0631\u0651\u064e\u062d\u0650\u064a\u0645\u0650';

const DrawOnBismillah: React.FC<{theme: Theme}> = ({theme}) => {
  const frame = useCurrentFrame();
  const drawProgress = interpolate(frame, [3, 38], [0, 100], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const fillIn = interpolate(frame, [28, 46], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const dashLen = 3000;
  return (
    <>
      <svg width={1000} height={260} viewBox="0 0 1000 260" style={{maxWidth: '92%'}}>
        <defs>
          <filter id="bisGlow" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="7" result="b" />
            <feMerge>
              <feMergeNode in="b" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>
        <text
          x={500}
          y={150}
          textAnchor="middle"
          direction="rtl"
          fontFamily={ARABIC_FONT}
          fontSize={96}
          fill={theme.arabicColor}
          fillOpacity={fillIn}
          stroke={theme.accent}
          strokeWidth={1.6}
          strokeDasharray={dashLen}
          strokeDashoffset={dashLen - (dashLen * drawProgress) / 100}
          filter="url(#bisGlow)"
        >
          {BISMILLAH}
        </text>
      </svg>
    </>
  );
};

// crescent fade variant: chaand pop hota hai, bismillah neeche fade-up
const CrescentFadeIntro: React.FC<{theme: Theme}> = ({theme}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const moonPop = spring({frame, fps, config: {damping: 12, stiffness: 70}});
  const textIn = interpolate(frame, [16, 36], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const textY = interpolate(frame, [16, 36], [34, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  return (
    <>
      <svg
        width="150"
        height="120"
        viewBox="0 0 150 120"
        style={{
          transform: `scale(${moonPop})`,
          marginBottom: 18,
          filter: `drop-shadow(0 0 16px ${theme.accent}88)`,
        }}
      >
        <mask id="intro-cres-mask">
          <rect width="150" height="120" fill="black" />
          <circle cx="75" cy="60" r="44" fill="white" />
          <circle cx="93" cy="48" r="38" fill="black" />
        </mask>
        <circle cx="75" cy="60" r="44" fill={theme.accent} mask="url(#intro-cres-mask)" />
      </svg>
      <div
        style={{
          fontFamily: ARABIC_FONT,
          fontSize: 92,
          color: theme.arabicColor,
          direction: 'rtl',
          opacity: textIn,
          transform: `translateY(${textY}px)`,
          textShadow: `0 0 24px ${theme.accent}66`,
        }}
      >
        {BISMILLAH}
      </div>
    </>
  );
};

// pattern wipe variant: geometric pattern disc se bismillah wipe-reveal
const PatternWipeIntro: React.FC<{theme: Theme}> = ({theme}) => {
  const frame = useCurrentFrame();
  const wipe = interpolate(frame, [2, 34], [0, 130], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const patRot = ((frame / 240) % 1) * 360;
  return (
    <div style={{position: 'relative', display: 'flex', justifyContent: 'center'}}>
      <svg
        width="360"
        height="360"
        viewBox="0 0 200 200"
        style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: `translate(-50%, -54%) rotate(${patRot.toFixed(2)}deg)`,
          opacity: 0.14,
        }}
      >
        <rect x="52" y="52" width="96" height="96" fill="none" stroke={theme.accent} strokeWidth="1.2" />
        <rect x="52" y="52" width="96" height="96" fill="none" stroke={theme.accent} strokeWidth="1.2" transform="rotate(45 100 100)" />
        <rect x="52" y="52" width="96" height="96" fill="none" stroke={theme.accent} strokeWidth="1.2" transform="rotate(67.5 100 100)" />
      </svg>
      <div
        style={{
          fontFamily: ARABIC_FONT,
          fontSize: 92,
          color: theme.arabicColor,
          direction: 'rtl',
          clipPath: `circle(${wipe.toFixed(1)}% at 50% 50%)`,
          textShadow: `0 0 24px ${theme.accent}66`,
        }}
      >
        {BISMILLAH}
      </div>
    </div>
  );
};

export const IntroCard: React.FC<{theme: Theme; variant?: string}> = ({
  theme,
  variant,
}) => {
  const frame = useCurrentFrame();
  const opacityOut = interpolate(frame, [INTRO_END - 14, INTRO_END - 2], [1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const lineGrow = interpolate(frame, [8, 30], [0, 220], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  return (
    <AbsoluteFill
      style={{
        justifyContent: 'center',
        alignItems: 'center',
        opacity: opacityOut,
      }}
    >
      <div style={{textAlign: 'center'}}>
        {(!variant || variant === 'classic') && <DrawOnBismillah theme={theme} />}
        {variant === 'crescentfade' && <CrescentFadeIntro theme={theme} />}
        {variant === 'patternwipe' && <PatternWipeIntro theme={theme} />}
        <div
          style={{
            width: lineGrow,
            height: 2,
            margin: '34px auto 0',
            background: `linear-gradient(90deg, transparent, ${theme.accent}, transparent)`,
          }}
        />
      </div>
    </AbsoluteFill>
  );
};
