import React from 'react';
import {AbsoluteFill, useCurrentFrame} from 'remotion';

// MASTER LOOK v2 (2026-08-24): ek look => poora package.
// - FrameDecor: 4 border designs (seed se chunte hain, purana L-corner sirf
//   classic me). Old videos (look ke baghair) bilkul pehle jaise rehte hain.
// - LookTint: canvas par preset-mood ka color veil => colors bhi usi look ke
//   hisab se mehsoos hote hain.

// hex -> rgba helper (tints ke liye)
export const hexA = (hex: string, a: number): string => {
  const h = hex.replace('#', '');
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${a})`;
};

export interface LookTint {
  c1: string;
  c2: string;
  a: number;
}

// Preset mood ke mutabiq canvas tint - "colors us k hisab se"
export const PRESET_TINTS: Record<string, LookTint> = {
  classic: {c1: '#d9ad59', c2: '#ffecbe', a: 0.08},
  royal: {c1: '#e6b95f', c2: '#2a9d70', a: 0.1},
  minimal: {c1: '#f0dcaf', c2: '#ffffff', a: 0.05},
  cinematic: {c1: '#3a54dc', c2: '#803eeb', a: 0.12},
  masterpiece: {c1: '#2d50e1', c2: '#843af2', a: 0.13},
  volumetric: {c1: '#ffecbe', c2: '#fff5dd', a: 0.12},
  raytrace: {c1: '#e6b95f', c2: '#ffcd78', a: 0.11},
  embernight: {c1: '#ff7a1f', c2: '#c83c14', a: 0.14},
  glitterroyal: {c1: '#f0c86e', c2: '#2a9d70', a: 0.11},
  desertmirage: {c1: '#e8be78', c2: '#b48c50', a: 0.12},
  waterripple: {c1: '#1e8ca0', c2: '#3c64dc', a: 0.13},
  silkmarble: {c1: '#f5eee4', c2: '#ebc8be', a: 0.09},
  cinemafocus: {c1: '#283ca0', c2: '#6e37c8', a: 0.13},
  auroranova: {c1: '#23dcbe', c2: '#ff78be', a: 0.14},
  qadrtilt: {c1: '#2d50e1', c2: '#eeaa76', a: 0.12},
};

// Canvas color harmony veil - Background ke upar, content se neeche.
export const LookTint: React.FC<{tint?: LookTint | null}> = ({tint}) => {
  if (!tint || !tint.a) return null;
  const breathe = 0.85 + 0.15 * Math.sin(useCurrentFrame() / 130);
  return (
    <AbsoluteFill
      style={{
        pointerEvents: 'none',
        background: `linear-gradient(168deg, ${hexA(tint.c1, tint.a)} 0%, rgba(0,0,0,0) 42%, rgba(0,0,0,0) 58%, ${hexA(tint.c2, tint.a * 0.85)} 100%)`,
        opacity: breathe,
      }}
    />
  );
};

const goldStops = (frame: number): string => {
  const s = Math.sin(frame / 90);
  return [
    ['rgba(240,220,160,0.95)', 'rgba(217,173,89,0.9)'],
    ['rgba(255,236,190,0.95)', 'rgba(196,150,62,0.9)'],
    ['rgba(224,190,120,0.95)', 'rgba(240,214,150,0.9)'],
  ][Math.floor(((s + 1) / 2) * 2.999)].join(';');
};

const GradDefs: React.FC<{id: string; frame: number}> = ({id, frame}) => (
  <defs>
    <linearGradient id={id} x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stopColor={goldStops(frame).split(';')[0]} />
      <stop offset="100%" stopColor={goldStops(frame).split(';')[1]} />
    </linearGradient>
  </defs>
);

// MIHRAB ARCH: qibla mehrab ka frame - seedha uncha arch + finial sitara
const ArchFrame: React.FC<{accent: string; op: number}> = ({accent, op}) => {
  const frame = useCurrentFrame();
  const glow = 0.8 + 0.2 * Math.sin(frame / 100);
  return (
    <svg
      viewBox="0 0 1080 1920"
      width="100%"
      height="100%"
      style={{opacity: op * glow}}
    >
      <GradDefs id="archG" frame={frame} />
      {[
        {i: 46, w: 3, o: 1},
        {i: 58, w: 1.2, o: 0.55},
      ].map((l, k) => {
        const x0 = l.i;
        const x1 = 1080 - l.i;
        const yb = 1920 - l.i;
        const yt = l.i + 210;
        const cx = 540;
        const d = `M ${x0} ${yb} L ${x0} ${yt} Q ${x0} ${l.i + 40} ${cx - 150} ${l.i + 30} Q ${cx} ${l.i - 30} ${cx + 150} ${l.i + 30} Q ${x1} ${l.i + 40} ${x1} ${yt} L ${x1} ${yb}`;
        return (
          <path
            key={k}
            d={d}
            fill="none"
            stroke={`url(#archG)`}
            strokeWidth={l.w}
            strokeLinecap="round"
            opacity={l.o}
          />
        );
      })}
      {/* finial sitara arch ki choti pe */}
      <circle cx={540} cy={52} r={9} fill={`url(#archG)`} />
      <circle
        cx={540}
        cy={52}
        r={17}
        fill="none"
        stroke={accent}
        strokeWidth={1.4}
        opacity={0.7 * glow}
      />
    </svg>
  );
};

// ART DECO: moti double lines upar/neeche + heere (diamond studs)
const DecoFrame: React.FC<{accent: string; op: number}> = ({accent, op}) => {
  const frame = useCurrentFrame();
  const shimmer = 0.75 + 0.25 * Math.sin(frame / 70);
  const dia = (cx: number, cy: number, r: number, k: string) => (
    <rect
      key={k}
      x={cx - r}
      y={cy - r}
      width={r * 2}
      height={r * 2}
      transform={`rotate(45 ${cx} ${cy})`}
      fill="none"
      stroke={`url(#decoG)`}
      strokeWidth={2.4}
    />
  );
  return (
    <svg
      viewBox="0 0 1080 1920"
      width="100%"
      height="100%"
      style={{opacity: op * shimmer}}
    >
      <GradDefs id="decoG" frame={frame} />
      {[92, 106].map((y, i) => (
        <g key={'t' + i}>
          <line
            x1={70}
            y1={y}
            x2={1010}
            y2={y}
            stroke={`url(#decoG)`}
            strokeWidth={i === 0 ? 3 : 1.4}
          />
        </g>
      ))}
      {[1814, 1828].map((y, i) => (
        <line
          key={'b' + i}
          x1={70}
          y1={y}
          x2={1010}
          y2={y}
          stroke={`url(#decoG)`}
          strokeWidth={i === 0 ? 3 : 1.4}
        />
      ))}
      {[110, 540, 970].map((x, i) => (
        <g key={'dt' + i}>{dia(x, 99, i === 1 ? 13 : 9, 'x' + i)}</g>
      ))}
      {[110, 540, 970].map((x, i) => (
        <g key={'db' + i}>{dia(x, 1821, i === 1 ? 13 : 9, 'y' + i)}</g>
      ))}
      {dia(70, 99, 7, 'c1')}
      {dia(1010, 99, 7, 'c2')}
      {dia(70, 1821, 7, 'c3')}
      {dia(1010, 1821, 7, 'c4')}
      {/* side ticks */}
      {[660, 700, 740].map((y, i) => (
        <g key={'s' + i}>
          <line x1={40} y1={y} x2={64} y2={y} stroke={accent} strokeWidth={2} opacity={0.6} />
          <line x1={1016} y1={y} x2={1040} y2={y} stroke={accent} strokeWidth={2} opacity={0.6} />
        </g>
      ))}
    </svg>
  );
};

// ROSETTE: patli line + charo kono me gulab (medallion) phool
const RosetteFrame: React.FC<{accent: string; op: number}> = ({accent, op}) => {
  const frame = useCurrentFrame();
  const spin = frame * 0.15;
  const bloom = 0.85 + 0.15 * Math.sin(frame / 80);
  const ros = (cx: number, cy: number, k: string) => (
    <g key={k} transform={`translate(${cx} ${cy}) rotate(${k.startsWith('tl') || k.startsWith('br') ? spin : -spin})`}>
      <circle r={30} fill="none" stroke={`url(#rosG)`} strokeWidth={2.2} />
      {Array.from({length: 8}, (_, i) => (
        <ellipse
          key={i}
          cx={0}
          cy={-21}
          rx={5.5}
          ry={12}
          fill={accent}
          opacity={0.5}
          transform={`rotate(${i * 45})`}
        />
      )).map((e, i) => (
        <g key={'p' + i}>{e}</g>
      ))}
      <circle r={7} fill={`url(#rosG)`} />
    </g>
  );
  return (
    <svg
      viewBox="0 0 1080 1920"
      width="100%"
      height="100%"
      style={{opacity: op * bloom}}
    >
      <GradDefs id="rosG" frame={frame} />
      <rect
        x={88}
        y={88}
        width={904}
        height={1744}
        fill="none"
        stroke={`url(#rosG)`}
        strokeWidth={1.6}
        opacity={0.8}
      />
      <rect
        x={98}
        y={98}
        width={884}
        height={1724}
        fill="none"
        stroke={accent}
        strokeWidth={0.8}
        opacity={0.35}
      />
      {ros(96, 96, 'tl')}
      {ros(984, 96, 'tr')}
      {ros(96, 1824, 'bl')}
      {ros(984, 1824, 'br')}
    </svg>
  );
};

// Master entry - variant 'classic' => null (Background apna purana frame
// khud draw karta hai => backward-safe).
export const FrameDecor: React.FC<{
  variant?: string | null;
  accent: string;
  opMult?: number;
}> = ({variant, accent, opMult = 1}) => {
  if (!variant || variant === 'classic') return null;
  return (
    <AbsoluteFill style={{pointerEvents: 'none'}}>
      {variant === 'arch' && <ArchFrame accent={accent} op={opMult} />}
      {variant === 'deco' && <DecoFrame accent={accent} op={opMult} />}
      {variant === 'rosette' && <RosetteFrame accent={accent} op={opMult} />}
    </AbsoluteFill>
  );
};
