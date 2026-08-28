import React from 'react';
import {AbsoluteFill, useCurrentFrame, useVideoConfig} from 'remotion';
import type {Theme} from './themes';

// PHASE C: ISLAMIC ART FX (2026-08-23)
// Har effect deterministic hai - lookSpec.seed se mulberry32 RNG.
// Koi randomness render ke waqt nahi => re-render identical frames.

const mulberry32 = (a: number) => () => {
  a |= 0;
  a = (a + 0x6d2b79f5) | 0;
  let t = Math.imul(a ^ (a >>> 15), 1 | a);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

const clamp01 = (v: number) => Math.max(0, Math.min(1, v));
const easeOut = (p: number) => 1 - Math.pow(1 - clamp01(p), 3);

// 8-point star (do overlapping squares) - classic rosette seed shape
const star8 = (cx: number, cy: number, r: number): string => {
  const pts: string[] = [];
  for (let i = 0; i < 16; i++) {
    const ang = (Math.PI / 8) * i - Math.PI / 2;
    const rad = i % 2 === 0 ? r : r * 0.42;
    pts.push(`${(cx + Math.cos(ang) * rad).toFixed(1)},${(cy + Math.sin(ang) * rad).toFixed(1)}`);
  }
  return `M${pts.join('L')}Z`;
};

// ---- 1) ROSETTE: kono par 8-point medallions + kinari band draw-on ----
const RosetteBorder: React.FC<{theme: Theme}> = ({theme}) => {
  const frame = useCurrentFrame();
  const {durationInFrames: dur} = useVideoConfig();
  const W = 1080;
  const H = 1920;
  const m = 74;
  const drawP = easeOut(frame / 110);
  const outFade = clamp01((dur - frame) / 30);
  const breathe = 1 + 0.012 * Math.sin(frame * 0.05);
  const corners: Array<[number, number]> = [
    [m, m],
    [W - m, m],
    [m, H - m],
    [W - m, H - m],
  ];
  const bandL = 2 * (W - 2 * m) + 2 * (H - 2 * m);
  return (
    <AbsoluteFill style={{opacity: 0.85 * outFade}}>
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" height="100%">
        <defs>
          <linearGradient id="rsGold" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor={theme.accent} />
            <stop offset="100%" stopColor="#fff2c9" />
          </linearGradient>
        </defs>
        {/* kinari band - charo taraf draw-on */}
        <rect
          x={m} y={m} width={W - 2 * m} height={H - 2 * m}
          fill="none" stroke={`url(#rsGold)`}
          strokeWidth={2.5} opacity={0.5}
          strokeDasharray={bandL}
          strokeDashoffset={(1 - drawP) * bandL}
        />
        {corners.map(([cx, cy], i) => {
          const localP = easeOut((frame - i * 8) / 90);
          const spin = frame > 110 ? Math.sin(frame * 0.04 + i) * 2 : 0;
          return (
            <g key={i} transform={`rotate(${spin} ${cx} ${cy}) scale(${breathe})`}
               style={{transformOrigin: `${cx}px ${cy}px`, opacity: localP}}>
              <path d={star8(cx, cy, 56)} fill="none"
                    stroke={`url(#rsGold)`} strokeWidth={3}
                    strokeDasharray={420} strokeDashoffset={(1 - localP) * 420} />
              <path d={star8(cx, cy, 34)} fill={`${theme.accent}22`}
                    stroke={theme.accent} strokeWidth={1.5}
                    strokeDasharray={260} strokeDashoffset={(1 - localP) * 260} />
              <circle cx={cx} cy={cy} r={7 + 2 * Math.sin(frame * 0.09 + i)}
                      fill={theme.accent} opacity={localP * 0.9} />
            </g>
          );
        })}
      </svg>
    </AbsoluteFill>
  );
};

// ---- 2) SITARE: chamakte sitare + girti nuqta-bars (calligraphy feel) ----
const SitareSparkles: React.FC<{seed: number; theme: Theme}> = ({seed, theme}) => {
  const frame = useCurrentFrame();
  const {durationInFrames: dur} = useVideoConfig();
  const {stars, falls} = React.useMemo(() => {
    const rng = mulberry32(seed || 7);
    return {
      stars: Array.from({length: 16}, (_, i) => ({
        x: 0.08 + rng() * 0.84,
        y: 0.10 + rng() * 0.50,
        ph: rng() * Math.PI * 2,
        sp: 0.07 + rng() * 0.06,
        sz: 7 + rng() * 11,
        id: i,
      })),
      falls: Array.from({length: 9}, () => ({
        x: 0.12 + rng() * 0.76,
        off: rng() * dur,
        fall: 240 + rng() * 320,
        r: 3 + rng() * 3,
      })),
    };
  }, [seed, dur]);
  return (
    <AbsoluteFill>
      <svg viewBox="0 0 1080 1920" width="100%" height="100%"
           preserveAspectRatio="xMidYMid slice">
        {stars.map((s) => {
          const tw = Math.max(0, Math.sin(frame * s.sp + s.ph));
          const a = 0.30 + 0.70 * tw;
          const sz = s.sz * (0.8 + 0.35 * tw);
          const cx = s.x * 1080;
          const cy = s.y * 1920;
          return (
            <g key={s.id} opacity={a}>
              <circle cx={cx} cy={cy} r={sz * 1.9}
                      fill={`rgba(255,214,120,${0.10 + 0.16 * tw})`} />
              <path d={`M${cx},${cy - sz}L${cx + sz * 0.28},${cy - sz * 0.28}L${cx + sz},${cy}L${cx + sz * 0.28},${cy + sz * 0.28}L${cx},${cy + sz}L${cx - sz * 0.28},${cy + sz * 0.28}L${cx - sz},${cy}L${cx - sz * 0.28},${cy - sz * 0.28}Z`} fill="#ffe9a8" />
              <circle cx={cx} cy={cy} r={sz * 0.42} fill="#fff7dd" />
            </g>
          );
        })}
        {falls.map((f, i) => {
          const cyc = (frame + f.off) % dur;
          const y = 300 + cyc * (f.fall / dur);
          const a = Math.sin(Math.PI * clamp01(cyc / dur)) * 0.75;
          return <circle key={`f${i}`} cx={f.x * 1080} cy={y} r={f.r}
                         fill={theme.accent} opacity={a} />;
        })}
      </svg>
    </AbsoluteFill>
  );
};

// ---- 3) VINES: arabesque beliyan kono se andar ko ugti hain ----
const VineCorners: React.FC<{seed: number; theme: Theme}> = ({seed, theme}) => {
  const frame = useCurrentFrame();
  const {durationInFrames: dur} = useVideoConfig();
  const W = 1080;
  const H = 1920;
  const growP = easeOut(frame / 140);
  const outFade = clamp01((dur - frame) / 30);
  const paths = [
    'M0,0 C120,40 150,150 130,290 S170,520 120,650',
    'M1080,0 C960,40 930,150 950,290 S910,520 960,650',
  ];
  const leaves = React.useMemo(() => {
    const rng = mulberry32((seed || 3) + 91);
    return Array.from({length: 7}, (_, i) => ({
      t: 0.18 + i * 0.11,
      side: rng() > 0.5 ? 1 : -1,
      sz: 9 + rng() * 7,
    }));
  }, [seed]);
  const stemLen = 900;
  return (
    <AbsoluteFill style={{opacity: 0.8 * outFade}}>
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" height="100%">
        {paths.map((d, pi) => (
          <g key={pi}>
            <path d={d} fill="none" stroke={theme.accent}
                  strokeWidth={3.5} strokeLinecap="round"
                  strokeDasharray={stemLen}
                  strokeDashoffset={(1 - growP) * stemLen} />
            {leaves.map((l, li) => {
              const approxY = 60 + l.t * 620;
              const x = pi === 0 ? 118 + l.side * (26 + li * 3) : W - 118 - l.side * (26 + li * 3);
              const appear = easeOut((growP - l.t) * 4);
              if (appear <= 0) return null;
              return (
                <ellipse key={li} cx={x} cy={approxY}
                         rx={l.sz} ry={l.sz * 0.45}
                         transform={`rotate(${l.side * 38} ${x} ${approxY})`}
                         fill="#7fae6f" opacity={0.62 * appear} />
              );
            })}
          </g>
        ))}
      </svg>
    </AbsoluteFill>
  );
};

// ---- 4) LANTERNS: fanous kinaron se upar uthte hain ----
const Lantern: React.FC<{x: number; y: number; s: number; op: number; ph: number}> =
({x, y, s, op, ph}) => {
  const frame = useCurrentFrame();
  const flicker = 0.75 + 0.25 * Math.sin(frame * 0.13 + ph);
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`} opacity={op}>
      <circle cx={0} cy={10} r={40} fill="rgba(255,186,84,0.20)" />
      <circle cx={0} cy={10} r={22} fill={`rgba(255,196,104,${0.28 * flicker})`} />
      <line x1={0} y1={-34} x2={0} y2={-22} stroke="#caa64f" strokeWidth={2.5} />
      <path d="M-13,-22 Q0,-32 13,-22 Z" fill="#b8933d" />
      <rect x={-13} y={-20} width={26} height={36} rx={6}
            fill={`rgba(255,204,112,${0.20 + 0.14 * flicker})`}
            stroke="#caa64f" strokeWidth={2} />
      <line x1={-9} y1={-20} x2={-9} y2={16} stroke="#caa64f" strokeWidth={1} opacity={0.7} />
      <line x1={9} y1={-20} x2={9} y2={16} stroke="#caa64f" strokeWidth={1} opacity={0.7} />
      <path d="M-13,16 L13,16 L9,24 L-9,24 Z" fill="#b8933d" />
      <circle cx={0} cy={27} r={2.5} fill="#ffe9a8" />
    </g>
  );
};

const LanternsRise: React.FC<{seed: number}> = ({seed}) => {
  const frame = useCurrentFrame();
  const {durationInFrames: dur, height: Hf} = useVideoConfig();
  const rng = mulberry32((seed || 5) + 41);
  const items = Array.from({length: 6}, (_, i) => {
    const left = i % 2 === 0;
    return {
      xBase: left ? 60 + rng() * 110 : 1080 - 60 - rng() * 110,
      speed: 0.42 + rng() * 0.30,
      off: rng() * 2600,
      s: 0.75 + rng() * 0.55,
      ph: rng() * 6.28,
      wob: 10 + rng() * 12,
      id: i,
    };
  });
  return (
    <AbsoluteFill>
      <svg viewBox={`0 0 1080 1920`} width="100%" height="100%"
           preserveAspectRatio="xMidYMid slice">
        {items.map((l) => {
          const travel = Hf + 420;
          const y = travel - ((frame * l.speed * 3 + l.off) % travel);
          const x = l.xBase + Math.sin(frame * 0.028 + l.ph) * l.wob;
          const op = clamp01((y - 40) / 160) * clamp01((Hf + 260 - y) / 160);
          return <Lantern key={l.id} x={x} y={y} s={l.s} op={op * 0.9} ph={l.ph} />;
        })}
      </svg>
    </AbsoluteFill>
  );
};

// ---- 5) CARAVAN: registan pe oonton ka qaafla silhouettes ----
const Camel: React.FC<{x: number; y: number; s: number; ph: number; col: string}> =
({x, y, s, ph, col}) => {
  const frame = useCurrentFrame();
  const swing = (o: number) => Math.sin(frame * 0.16 + ph + o) * 7;
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`} fill={col}>
      <ellipse cx={0} cy={-34} rx={30} ry={15} />
      <circle cx={-8} cy={-48} r={11} />
      <rect x={22} y={-52} width={7} height={26} rx={3}
            transform={`rotate(18 25 -39)`} />
      <ellipse cx={33} cy={-54} rx={8} ry={5.5} />
      <rect x={-20} y={-24} width={4.5} height={26} rx={2}
            transform={`rotate(${swing(0)} -18 -24)`} />
      <rect x={-8} y={-24} width={4.5} height={26} rx={2}
            transform={`rotate(${-swing(1.6)} -6 -24)`} />
      <rect x={8} y={-24} width={4.5} height={26} rx={2}
            transform={`rotate(${swing(3.1)} 10 -24)`} />
      <rect x={19} y={-24} width={4.5} height={26} rx={2}
            transform={`rotate(${-swing(4.7)} 21 -24)`} />
      <path d="M-30,-38 Q-44,-30 -46,-16 L-42,-16 Q-38,-28 -28,-32 Z" />
    </g>
  );
};

const CaravanSilhouette: React.FC<{seed: number; theme: Theme}> = ({theme}) => {
  const frame = useCurrentFrame();
  const {durationInFrames: dur} = useVideoConfig();
  const prog = clamp01((frame - 30) / (dur * 0.8));
  const baseX = -380 + prog * (1080 + 760);
  const col = theme.decor === 'paper' ? 'rgba(70,52,30,0.75)' : 'rgba(12,10,8,0.78)';
  const fadeIn = clamp01(frame / 40) * clamp01((dur - frame) / 40);
  return (
    <AbsoluteFill style={{opacity: fadeIn}}>
      <svg viewBox="0 0 1080 1920" width="100%" height="100%"
           preserveAspectRatio="xMidYMax slice">
        <path d="M0,1780 Q270,1712 540,1752 T1080,1740 L1080,1920 L0,1920 Z"
              fill={col} opacity={0.5} />
        {[0, 1, 2].map((i) => (
          <g key={i}>
            <Camel x={baseX + i * 128} y={1738 - Math.abs(Math.sin(i)) * 14}
                   s={0.94 - i * 0.06} ph={i * 2.1} col={col} />
            <circle cx={baseX + i * 128 + 31} cy={1738 - (0.94 - i * 0.06) * 62}
                    r={9 * (0.94 - i * 0.06)} fill={col} />
          </g>
        ))}
      </svg>
    </AbsoluteFill>
  );
};

// ---- 6) PALMS: nariyal/khajoor ke darakht jhoolte hue ----
const PalmTree: React.FC<{x: number; y: number; s: number; flip: number; ph: number; seed: number}> =
({x, y, s, flip, ph, seed}) => {
  const frame = useCurrentFrame();
  const sway = Math.sin(frame * 0.021 + ph) * 3.2;
  const intro = easeOut(frame / 45);
  const rng = mulberry32(seed);
  const fronds = Array.from({length: 7}, (_, i) => {
    const ang = -150 + i * 42 + (rng() - 0.5) * 14;
    const len = 96 + rng() * 46;
    return {ang, len, id: i};
  });
  return (
    <g transform={`translate(${x} ${y}) scale(${flip * s * intro} ${s * intro}) rotate(${sway})`}>
      <path d="M0,0 C-8,-90 6,-180 -4,-264" fill="none"
            stroke="#5c4732" strokeWidth={16} strokeLinecap="round" />
      <path d="M-4,-264 L-4,-264" stroke="#5c4732" strokeWidth={16} strokeLinecap="round" />
      <g transform={`translate(-4 -264)`}>
        {fronds.map((f) => (
          <path key={f.id}
                d={`M0,0 Q${Math.cos((f.ang * Math.PI) / 180) * f.len * 0.6},${Math.sin((f.ang * Math.PI) / 180) * f.len * 0.6 - 26} ${Math.cos((f.ang * Math.PI) / 180) * f.len},${Math.sin((f.ang * Math.PI) / 180) * f.len + 34}`}
                fill="none" stroke="#3f6b44" strokeWidth={9} strokeLinecap="round"
                opacity={0.88} />
        ))}
        <circle cx={0} cy={6} r={9} fill="#6b4f2e" />
        <circle cx={14} cy={16} r={5} fill="#8a6a3c" />
        <circle cx={-13} cy={17} r={5} fill="#8a6a3c" />
      </g>
    </g>
  );
};

const OasisPalms: React.FC<{seed: number}> = ({seed}) => {
  const {height: Hf} = useVideoConfig();
  return (
    <AbsoluteFill style={{opacity: 0.92}}>
      <svg viewBox={`0 0 1080 1920`} width="100%" height="100%"
           preserveAspectRatio="xMidYMax slice">
        <PalmTree x={128} y={Hf - 66} s={1.06} flip={1} ph={0.4} seed={(seed || 11) + 3} />
        <PalmTree x={228} y={Hf - 40} s={0.82} flip={1} ph={2.2} seed={(seed || 11) + 8} />
        <PalmTree x={962} y={Hf - 60} s={1.0} flip={-1} ph={4.1} seed={(seed || 11) + 13} />
        <PalmTree x={862} y={Hf - 34} s={0.78} flip={-1} ph={5.3} seed={(seed || 11) + 21} />
      </svg>
    </AbsoluteFill>
  );
};

export const ArtFxLayer: React.FC<{
  fx?: string;
  seed?: number;
  theme: Theme;
}> = ({fx, seed, theme}) => {
  if (!fx || fx === 'none') return null;
  return (
    <AbsoluteFill style={{pointerEvents: 'none'}}>
      {fx === 'rosette' && <RosetteBorder theme={theme} />}
      {fx === 'sitare' && <SitareSparkles seed={seed || 2} theme={theme} />}
      {fx === 'vines' && <VineCorners seed={seed || 3} theme={theme} />}
      {fx === 'lanterns' && <LanternsRise seed={seed || 4} />}
      {fx === 'caravan' && <CaravanSilhouette seed={seed || 5} theme={theme} />}
      {fx === 'palms' && <OasisPalms seed={seed || 6} />}
    </AbsoluteFill>
  );
};
