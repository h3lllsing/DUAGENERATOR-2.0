import React from 'react';
import {AbsoluteFill, useCurrentFrame, useVideoConfig} from 'remotion';
import type {Theme} from './themes';

// PHASE A: BORDER BASICS FX (2026-08-23)
// Kinare/sky-zone ke halka effects - text zone safe.

const mulberry32 = (a: number) => () => {
  a |= 0;
  a = (a + 0x6d2b79f5) | 0;
  let t = Math.imul(a ^ (a >>> 15), 1 | a);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

const clamp01 = (v: number) => Math.max(0, Math.min(1, v));

// ---- CLOUDS: upar halki baadal paratein drift karti hain ----
const CloudsDrift: React.FC<{seed: number; theme: Theme}> = ({seed, theme}) => {
  const frame = useCurrentFrame();
  const light = theme.decor === 'paper';
  const clouds = React.useMemo(() => {
    const rng = mulberry32((seed || 53) + 21);
    return Array.from({length: 5}, (_, i) => ({
      y: 60 + rng() * 260,
      sp: (0.4 + rng() * 0.5) * (i % 2 === 0 ? 1 : -1),
      s: 0.8 + rng() * 0.9,
      off: rng() * 2000,
      a: 0.10 + rng() * 0.12,
      id: i,
    }));
  }, [seed]);
  const CloudBlob: React.FC<{a: number}> = ({a}) => (
    <g fill={light ? `rgba(255,255,255,${a + 0.25})` : `rgba(226,232,244,${a})`}>
      <ellipse cx={0} cy={0} rx={150} ry={44} />
      <ellipse cx={-90} cy={16} rx={95} ry={30} />
      <ellipse cx={95} cy={12} rx={105} ry={34} />
      <ellipse cx={10} cy={-26} rx={85} ry={30} />
    </g>
  );
  return (
    <AbsoluteFill>
      <svg viewBox="0 0 1080 1920" width="100%" height="100%"
           preserveAspectRatio="xMidYMid slice">
        {clouds.map((c) => {
          const cyc = ((frame * c.sp * 3 + c.off) % 2400 + 2400) % 2400;
          const x = -300 + (cyc / 2400) * (1080 + 600);
          return (
            <g key={c.id} transform={`translate(${x} ${c.y}) scale(${c.s})`}
               opacity={clamp01(x / 220) * clamp01((1380 - x) / 220)}>
              <CloudBlob a={c.a} />
            </g>
          );
        })}
      </svg>
    </AbsoluteFill>
  );
};

// ---- BIRDS: door parinde ka jhund upper sky cross karta hai ----
const BirdsFlock: React.FC<{seed: number}> = ({seed}) => {
  const frame = useCurrentFrame();
  const {durationInFrames: dur} = useVideoConfig();
  const birds = React.useMemo(() => {
    const rng = mulberry32((seed || 59) + 67);
    return Array.from({length: 8}, (_, i) => ({
      yBase: 170 + rng() * 330,
      lag: i * (dur * 0.018) + rng() * 40,
      sp: dur * (0.62 + rng() * 0.08),
      ph: rng() * 6.28,
      s: 0.75 + rng() * 0.6,
      bob: 10 + rng() * 22,
      id: i,
    }));
  }, [seed, dur]);
  return (
    <AbsoluteFill style={{opacity: 0.8}}>
      <svg viewBox="0 0 1080 1920" width="100%" height="100%"
           preserveAspectRatio="xMidYMid slice">
        {birds.map((b) => {
          const t = ((frame + b.lag) % b.sp) / b.sp;
          const x = -80 + t * (1080 + 160);
          const y = b.yBase + Math.sin(t * 9 + b.ph) * b.bob;
          const flap = Math.abs(Math.sin(frame * 0.22 + b.ph));
          const w = 17 * b.s;
          return (
            <path key={b.id}
                  d={`M${x - w},${y} Q${x - w / 2},${y - 11 * b.s * (0.35 + flap)} ${x},${y} Q${x + w / 2},${y - 11 * b.s * (0.35 + flap)} ${x + w},${y}`}
                  fill="none" stroke="rgba(30,28,26,0.72)"
                  strokeWidth={3.2 * b.s} strokeLinecap="round" />
          );
        })}
      </svg>
    </AbsoluteFill>
  );
};

// ---- FLAGS: rasmii jhande pendulum swing karte hain ----
const FlagsSwing: React.FC<{seed: number; theme: Theme}> = ({theme}) => {
  const frame = useCurrentFrame();
  const W = 1080;
  const strings = [
    {ax: 0, ay: 96, dir: 1},
    {ax: W, ay: 132, dir: -1},
  ];
  const cols = [theme.accent, '#3f7d5c', '#c8a44a'];
  return (
    <AbsoluteFill style={{opacity: 0.88}}>
      <svg viewBox={`0 0 ${W} 1920`} width="100%" height="100%">
        {strings.map((st, si) => {
          const swingA = Math.sin(frame * 0.032 + si * 1.9) * 6;
          return (
            <g key={si}
               transform={`rotate(${swingA} ${st.ax} ${st.ay})`}>
              <path d={`M${st.ax},${st.ay} Q${st.ax + st.dir * 210},${st.ay + 64} ${st.ax + st.dir * 430},${st.ay + 58}`}
                    fill="none" stroke="rgba(160,140,90,0.65)" strokeWidth={3} />
              {[0.16, 0.38, 0.6, 0.82].map((t, fi) => {
                const fx = st.ax + st.dir * (60 + t * 400);
                const fy = st.ay + t * 66 - Math.pow(2 * t - 1, 2) * 6;
                const fl = Math.sin(frame * 0.09 + fi * 1.3 + si) * 4;
                return (
                  <g key={fi}>
                    <line x1={fx} y1={fy} x2={fx} y2={fy + 52 + fl}
                          stroke="rgba(160,140,90,0.55)" strokeWidth={1.6} />
                    <path d={`M${fx},${fy + 50 + fl} L${fx + 15},${fy + 50 + fl} L${fx + 7.5},${fy + 84 + fl} Z`}
                          fill={cols[(fi + si) % cols.length]} opacity={0.82} />
                  </g>
                );
              })}
            </g>
          );
        })}
      </svg>
    </AbsoluteFill>
  );
};

// ---- WIND: hawa ke jhonke + urte patte ----
const WindStreaks: React.FC<{seed: number}> = ({seed}) => {
  const frame = useCurrentFrame();
  const {streaks, leaves} = React.useMemo(() => {
    const rng = mulberry32((seed || 61) + 83);
    return {
      streaks: Array.from({length: 6}, (_, i) => ({
        y: 200 + rng() * 1300,
        off: rng() * 1800,
        len: 220 + rng() * 300,
        curve: 40 + rng() * 70,
        a: 0.10 + rng() * 0.10,
        id: i,
      })),
      leaves: Array.from({length: 7}, (_, i) => ({
        y: 320 + rng() * 1150,
        sp: 5 + rng() * 4,
        off: rng() * 1400,
        ph: rng() * 6.28,
        col: ['#7fae6f', '#a3b86b', '#c9a84c'][i % 3],
        id: i,
      })),
    };
  }, [seed]);
  return (
    <AbsoluteFill style={{opacity: 0.9}}>
      <svg viewBox="0 0 1080 1920" width="100%" height="100%"
           preserveAspectRatio="xMidYMid slice">
        {streaks.map((s) => {
          const cyc = ((frame * 6 + s.off) % 1800) / 1800;
          const x = -s.len + cyc * (1080 + s.len * 2);
          return (
            <path key={s.id}
                  d={`M${x},${s.y} q${s.len / 2},${-s.curve} ${s.len},0`}
                  fill="none" stroke={`rgba(235,240,248,${s.a})`}
                  strokeWidth={3} strokeLinecap="round" />
          );
        })}
        {leaves.map((l) => {
          const cyc = ((frame * l.sp + l.off) % 1500) / 1500;
          const x = -40 + cyc * 1160;
          const y = l.y + Math.sin(cyc * 12 + l.ph) * 46;
          return (
            <ellipse key={l.id} cx={x} cy={y} rx={8} ry={4} fill={l.col}
                     opacity={0.7}
                     transform={`rotate(${frame * 4 + l.ph * 57} ${x} ${y})`} />
          );
        })}
      </svg>
    </AbsoluteFill>
  );
};

export type BorderFxId =
  | 'none' | 'clouds' | 'birds' | 'flags' | 'wind';

export const BorderFxLayer: React.FC<{
  fx?: string;
  seed?: number;
  theme: Theme;
}> = ({fx, seed, theme}) => {
  if (!fx || fx === 'none') return null;
  return (
    <AbsoluteFill style={{pointerEvents: 'none'}}>
      {fx === 'clouds' && <CloudsDrift seed={seed || 51} theme={theme} />}
      {fx === 'birds' && <BirdsFlock seed={seed || 52} />}
      {fx === 'flags' && <FlagsSwing seed={seed || 54} theme={theme} />}
      {fx === 'wind' && <WindStreaks seed={seed || 55} />}
    </AbsoluteFill>
  );
};
