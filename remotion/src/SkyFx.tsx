import React from 'react';
import {AbsoluteFill, useCurrentFrame, useVideoConfig} from 'remotion';
import type {Theme} from './themes';

// PHASE B: SKY / WEATHER FX (2026-08-23)
// Sab deterministic (lookSpec.seed) - re-render identical.

const mulberry32 = (a: number) => () => {
  a |= 0;
  a = (a + 0x6d2b79f5) | 0;
  let t = Math.imul(a ^ (a >>> 15), 1 | a);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

const clamp01 = (v: number) => Math.max(0, Math.min(1, v));

// ---- RAIN: tez jhukti baarish ki lakeeren ----
const Rain: React.FC<{seed: number; heavy: boolean}> = ({seed, heavy}) => {
  const frame = useCurrentFrame();
  const rng = mulberry32((seed || 17) + (heavy ? 500 : 100));
  const n = heavy ? 95 : 70;
  const drops = Array.from({length: n}, (_, i) => ({
    x: rng() * 1160 - 40,
    sp: (heavy ? 20 : 15) + rng() * 8,
    off: rng() * 2200,
    len: 18 + rng() * 16,
    a: 0.22 + rng() * 0.3,
    id: i,
  }));
  return (
    <AbsoluteFill>
      <svg viewBox="0 0 1080 1920" width="100%" height="100%"
           preserveAspectRatio="xMidYMid slice">
        {drops.map((d) => {
          const y = ((frame * d.sp + d.off) % 2150) - 150;
          const x = d.x + y * 0.12;
          return (
            <line key={d.id} x1={x} y1={y} x2={x - d.len * 0.12}
                  y2={y - d.len}
                  stroke={`rgba(190,214,235,${d.a})`} strokeWidth={2.2}
                  strokeLinecap="round" />
          );
        })}
      </svg>
    </AbsoluteFill>
  );
};

// ---- STORM: barish + bijli chamak (deterministic strikes) ----
const Storm: React.FC<{seed: number}> = ({seed}) => {
  const frame = useCurrentFrame();
  const {durationInFrames: dur} = useVideoConfig();
  const rng = mulberry32((seed || 19) + 77);
  const strikes = [Math.floor(dur * (0.2 + rng() * 0.1)),
    Math.floor(dur * (0.55 + rng() * 0.12))];
  let flash = 0;
  let bolt: string | null = null;
  strikes.forEach((f0, i) => {
    const dt = frame - f0;
    if (dt >= 0 && dt < 8) {
      flash = Math.max(flash, Math.sin((dt / 8) * Math.PI));
      if (dt < 4 && i === (frame % 2 === 0 ? 0 : 1)) {
        const sx = 200 + ((seed || 19) * (i + 3)) % 600;
        bolt = `M${sx},0 L${sx - 46},340 L${sx + 30},380 L${sx - 24},720 L${sx + 44},760 L${sx - 8},1080`;
      }
    }
  });
  return (
    <AbsoluteFill>
      <Rain seed={seed || 19} heavy />
      {flash > 0 && (
        <AbsoluteFill style={{background: `rgba(226,236,255,${0.34 * flash})`}} />
      )}
      {bolt && (
        <svg viewBox="0 0 1080 1920" width="100%" height="100%">
          <path d={bolt} fill="none" stroke="#eef4ff" strokeWidth={5}
                strokeLinejoin="round" opacity={0.95} />
          <path d={bolt} fill="none" stroke="#9db8e8" strokeWidth={11}
                strokeLinejoin="round" opacity={0.35} />
        </svg>
      )}
    </AbsoluteFill>
  );
};

// ---- SNOW: halke barfe tukde sway ke sath ----
const Snow: React.FC<{seed: number}> = ({seed}) => {
  const frame = useCurrentFrame();
  const rng = mulberry32((seed || 23) + 31);
  const flakes = Array.from({length: 60}, (_, i) => ({
    x: rng() * 1120 - 20,
    r: 2 + rng() * 4,
    sp: 1.3 + rng() * 1.2,
    ph: rng() * 6.28,
    sw: 14 + rng() * 26,
    a: 0.45 + rng() * 0.45,
    id: i,
  }));
  return (
    <AbsoluteFill>
      <svg viewBox="0 0 1080 1920" width="100%" height="100%"
           preserveAspectRatio="xMidYMid slice">
        {flakes.map((f) => {
          const y = ((frame * f.sp + f.ph * 100) % 2100) - 90;
          const x = f.x + Math.sin(frame * 0.03 + f.ph) * f.sw;
          return (
            <circle key={f.id} cx={x} cy={y} r={f.r}
                    fill={`rgba(245,249,255,${f.a})`} />
          );
        })}
      </svg>
    </AbsoluteFill>
  );
};

// ---- FOG: dhundhli paratein neeche/oopar drift karti hain ----
const Fog: React.FC<{seed: number}> = ({seed}) => {
  const frame = useCurrentFrame();
  const rng = mulberry32((seed || 29) + 13);
  const banks = Array.from({length: 4}, (_, i) => ({
    y: [1560, 1700, 320, 180][i] + rng() * 60,
    sp: 0.35 + rng() * 0.4,
    w: 700 + rng() * 500,
    h: 150 + rng() * 120,
    a: 0.10 + rng() * 0.10,
    dir: i % 2 === 0 ? 1 : -1,
    id: i,
  }));
  return (
    <AbsoluteFill>
      <svg viewBox="0 0 1080 1920" width="100%" height="100%"
           preserveAspectRatio="xMidYMid slice">
        <defs>
          <radialGradient id="fogG">
            <stop offset="0%" stopColor="rgba(228,232,240,0.85)" />
            <stop offset="100%" stopColor="rgba(228,232,240,0)" />
          </radialGradient>
        </defs>
        {banks.map((b) => {
          const cyc = ((frame * b.sp * b.dir) % 1600 + 1600) % 1600;
          const x = -400 + (cyc / 1600) * (1080 + 800);
          return (
            <ellipse key={b.id} cx={x} cy={b.y} rx={b.w} ry={b.h}
                     fill="url(#fogG)" opacity={b.a} />
          );
        })}
      </svg>
    </AbsoluteFill>
  );
};

// ---- SMOKE: bakhur/loban ka uthta dhuan (kono se) ----
const Smoke: React.FC<{seed: number}> = ({seed}) => {
  const frame = useCurrentFrame();
  const {durationInFrames: dur} = useVideoConfig();
  const rng = mulberry32((seed || 37) + 59);
  const sources = [
    {x: 130, side: 1},
    {x: 950, side: -1},
  ];
  const puffs = Array.from({length: 22}, (_, i) => ({
    src: i % 2,
    off: (i / 2) * (dur / 11),
    grow: 14 + rng() * 26,
    wig: 20 + rng() * 34,
    ph: rng() * 6.28,
    id: i,
  }));
  return (
    <AbsoluteFill style={{opacity: 0.95}}>
      <svg viewBox="0 0 1080 1920" width="100%" height="100%"
           preserveAspectRatio="xMidYMid slice">
        <defs>
          <radialGradient id="smokeG">
            <stop offset="0%" stopColor="rgba(226,216,196,0.78)" />
            <stop offset="60%" stopColor="rgba(226,216,196,0.30)" />
            <stop offset="100%" stopColor="rgba(226,216,196,0)" />
          </radialGradient>
        </defs>
        {puffs.map((p) => {
          const cyc = (frame + p.off) % dur;
          const life = cyc / dur;
          const rise = life * 900;
          const s = sources[p.src];
          const x = s.x + Math.sin(life * 7 + p.ph) * p.wig * life +
            s.side * life * 60;
          const y = 1750 - rise;
          const r = p.grow * (0.5 + life * 1.9);
          const a = Math.sin(Math.PI * life) * 0.55;
          return (
            <g key={p.id}>
              <circle cx={x} cy={y} r={r}
                      fill={`rgba(226,216,196,${a * 0.35})`} />
              <circle cx={x} cy={y} r={r * 0.62}
                      fill={`rgba(232,222,202,${a * 0.6})`} />
              <circle cx={x} cy={y} r={r * 0.32}
                      fill={`rgba(240,230,210,${a})`} />
            </g>
          );
        })}
      </svg>
    </AbsoluteFill>
  );
};

// ---- FIREFLIES: jugnoo ghoome aur chamke ----
const Fireflies: React.FC<{seed: number}> = ({seed}) => {
  const frame = useCurrentFrame();
  const rng = mulberry32((seed || 41) + 7);
  const bugs = Array.from({length: 18}, (_, i) => ({
    bx: rng(),
    by: 0.42 + rng() * 0.52,
    ax: 40 + rng() * 110,
    ay: 26 + rng() * 60,
    fx: 0.017 + rng() * 0.02,
    fy: 0.021 + rng() * 0.024,
    ph: rng() * 6.28,
    tw: 0.05 + rng() * 0.06,
    r: 2.6 + rng() * 3.4,
    id: i,
  }));
  return (
    <AbsoluteFill>
      <svg viewBox="0 0 1080 1920" width="100%" height="100%"
           preserveAspectRatio="xMidYMid slice">
        {bugs.map((b) => {
          const x = b.bx * 1080 + Math.sin(frame * b.fx + b.ph) * b.ax;
          const y = b.by * 1920 + Math.cos(frame * b.fy + b.ph * 1.7) * b.ay;
          const glow = Math.max(0, Math.sin(frame * b.tw + b.ph * 2.3));
          if (glow <= 0.04) {
            return <circle key={b.id} cx={x} cy={y} r={b.r * 0.7}
                           fill="rgba(150,170,90,0.25)" />;
          }
          return (
            <g key={b.id}>
              <circle cx={x} cy={y} r={b.r * 3.2}
                      fill={`rgba(216,232,120,${0.16 * glow})`} />
              <circle cx={x} cy={y} r={b.r}
                      fill={`rgba(238,250,150,${0.35 + 0.65 * glow})`} />
            </g>
          );
        })}
      </svg>
    </AbsoluteFill>
  );
};

// ---- PETALS: phool ki pankhudiyan girti hain ----
const Petals: React.FC<{seed: number}> = ({seed}) => {
  const frame = useCurrentFrame();
  const rng = mulberry32((seed || 43) + 97);
  const colors = ['#f3c6d3', '#f8dde4', '#ead1c0', '#f5cfd9'];
  const petals = Array.from({length: 16}, (_, i) => ({
    x: rng() * 1100 - 10,
    sp: 1.6 + rng() * 1.6,
    off: rng() * 2100,
    rot: rng() * 360,
    rs: 1.2 + rng() * 2.2,
    sw: 40 + rng() * 70,
    ph: rng() * 6.28,
    sz: 7 + rng() * 7,
    col: colors[i % colors.length],
    id: i,
  }));
  return (
    <AbsoluteFill style={{opacity: 0.85}}>
      <svg viewBox="0 0 1080 1920" width="100%" height="100%"
           preserveAspectRatio="xMidYMid slice">
        {petals.map((p) => {
          const y = ((frame * p.sp + p.off) % 2150) - 80;
          const x = p.x + Math.sin(frame * 0.026 + p.ph) * p.sw;
          return (
            <ellipse key={p.id} cx={x} cy={y} rx={p.sz} ry={p.sz * 0.48}
                     fill={p.col} opacity={0.75}
                     transform={`rotate(${p.rot + frame * p.rs} ${x} ${y})`} />
          );
        })}
      </svg>
    </AbsoluteFill>
  );
};

export type SkyFxId =
  | 'none' | 'rain' | 'storm' | 'snow' | 'fog'
  | 'smoke' | 'fireflies' | 'petals';

export const SkyFxLayer: React.FC<{
  fx?: string;
  seed?: number;
  theme?: Theme;
}> = ({fx, seed}) => {
  if (!fx || fx === 'none') return null;
  return (
    <AbsoluteFill style={{pointerEvents: 'none'}}>
      {fx === 'rain' && <Rain seed={seed || 11} heavy={false} />}
      {fx === 'storm' && <Storm seed={seed || 12} />}
      {fx === 'snow' && <Snow seed={seed || 13} />}
      {fx === 'fog' && <Fog seed={seed || 14} />}
      {fx === 'smoke' && <Smoke seed={seed || 15} />}
      {fx === 'fireflies' && <Fireflies seed={seed || 16} />}
      {fx === 'petals' && <Petals seed={seed || 18} />}
    </AbsoluteFill>
  );
};
