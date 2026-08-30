// SVG PATTERN TILE ENGINE (Milestone 1) — girih-band + arabesque-corners.
// Sab geometry deterministic: pure math + useMemo(descriptor). Koi Math.random
// nahi. Motion (optional opacity breathe) sirf useCurrentFrame() se. Theme-
// color tokens render-time resolve hoti hain (single palette source = themes).
//
// Cost: rects pattern-fill ke sath 1 paint/frame; static tile raster — Phase-1
// compositor policy ke mutabiq GPU-promote nahi, deep strings nahi.

import React from 'react';
import {AbsoluteFill, useCurrentFrame} from 'remotion';
import type {Theme} from '../themes';
import type {VfxColorToken, VfxPatternDescriptor} from './types';

const TAU = Math.PI * 2;

export const tileColor = (
  token: VfxColorToken,
  d: VfxPatternDescriptor,
  accent: string,
  theme: Theme | null,
): string => {
  switch (token) {
    case 'accent':
      return accent;
    case 'glowColor':
      return theme ? theme.glowColor : accent;
    case 'particleColor':
      return theme ? theme.particleColor : accent;
    case 'solid':
      return d.solidColor || accent;
    default:
      return accent;
  }
};

// N-point ring polygon points string (deterministic).
const ringPoints = (
  cx: number,
  cy: number,
  r: number,
  n: number,
  rotDeg: number,
): string => {
  const rot = (rotDeg * Math.PI) / 180;
  const pts: string[] = [];
  for (let i = 0; i < n; i++) {
    const a = (i * TAU) / n + rot;
    pts.push(`${(cx + Math.cos(a) * r).toFixed(2)},${(cy + Math.sin(a) * r).toFixed(2)}`);
  }
  return pts.join(' ');
};

// 12-point girih star: do overlapping hexagons (30° offset) + inner rings +
// center medallion. seedSalt deterministically 3 interlace angles deta hai.
const GirihTile: React.FC<{d: VfxPatternDescriptor; color: string}> = ({d, color}) => {
  const S = d.tileSize;
  const cx = S / 2;
  const cy = S / 2;
  const rOut = S * 0.47;
  const rIn = rOut * 0.62;
  const rot = ((d.seedSalt % 3) + 1) * 15; // 15 / 30 / 45
  const geo = React.useMemo(
    () => ({
      h1: ringPoints(cx, cy, rOut, 6, rot),
      h2: ringPoints(cx, cy, rOut, 6, rot + 30),
      in1: ringPoints(cx, cy, rIn, 6, rot + 90),
      in2: ringPoints(cx, cy, rIn, 6, rot + 120),
    }),
    [S, rot, cx, cy, rOut, rIn],
  );
  return (
    <g
      fill="none"
      stroke={color}
      strokeWidth={d.strokeWidth}
      strokeLinejoin="round"
      strokeOpacity={d.alpha}
    >
      <polygon points={geo.h1} />
      <polygon points={geo.h2} opacity={0.85} />
      <polygon points={geo.in1} opacity={0.65} />
      <polygon points={geo.in2} opacity={0.65} />
      <circle cx={cx} cy={cy} r={rIn * 0.2} strokeOpacity={d.alpha * 0.8} />
    </g>
  );
};

// Arabesque corner flourish: tile origin se quarter-arc medallions, nested,
// seedSalt deterministic spread. (Corners/zones par use hota hai.)
const ArabesqueTile: React.FC<{d: VfxPatternDescriptor; color: string}> = ({d, color}) => {
  const S = d.tileSize;
  const spread = 0.42 + (d.seedSalt % 4) * 0.07;
  const radii = React.useMemo(
    () => [0.18, 0.32, 0.46, 0.6].map((k) => Math.round(S * k * spread + S * 0.08)),
    [S, spread],
  );
  return (
    <g
      fill="none"
      stroke={color}
      strokeWidth={d.strokeWidth}
      strokeLinecap="round"
      strokeOpacity={d.alpha}
    >
      {radii.map((r, i) => (
        <path key={i} d={`M0 ${r} A ${r} ${r} 0 0 1 ${r} 0`} />
      ))}
      <path d={`M0 0 L ${S * 0.5} ${S * 0.5}`} strokeOpacity={d.alpha * 0.5} />
      <path d={`M0 ${S * 0.32} L ${S * 0.32} 0`} strokeOpacity={d.alpha * 0.4} />
    </g>
  );
};

interface BandRect {
  key: number;
  x: number;
  y: number;
  w: number;
  h: number;
}

// Full-frame custom border/corner design — Background ke FrameDecor 'custom'
// variant par render hota hai.
export const FrameCustom: React.FC<{
  spec: VfxPatternDescriptor;
  accent: string;
  theme?: Theme | null;
  opMult?: number;
}> = ({spec, accent, theme, opMult = 1}) => {
  const frame = useCurrentFrame();
  const color = tileColor(spec.colorToken, spec, accent, theme || null);

  const breathe =
    spec.breathFrames > 0
      ? 1 + spec.breathAmpl * Math.sin((frame / spec.breathFrames) * TAU)
      : 1;
  const opacity = Math.max(0, Math.min(1, spec.opacity * (opMult || 1) * breathe));

  const patId = `vfx-${spec.kind}-${spec.seedSalt}-${spec.colorToken}`.replace(
    /[^A-Za-z0-9_-]/g,
    '',
  );

  const hasFrame = spec.zones.includes('frame');
  const hasTop = spec.zones.includes('top');
  const hasBottom = spec.zones.includes('bottom');
  const hasCorners = spec.zones.includes('corners');
  const b = spec.bandSize;
  const W = 1080;
  const H = 1920;

  const bands: BandRect[] = React.useMemo(() => {
    const out: BandRect[] = [];
    let k = 0;
    if (hasFrame) {
      out.push({key: k++, x: 0, y: 0, w: W, h: b});
      out.push({key: k++, x: 0, y: H - b, w: W, h: b});
      out.push({key: k++, x: 0, y: b, w: b, h: H - b * 2});
      out.push({key: k++, x: W - b, y: b, w: b, h: H - b * 2});
    } else {
      if (hasTop) out.push({key: k++, x: 0, y: 0, w: W, h: b});
      if (hasBottom) out.push({key: k++, x: 0, y: H - b, w: W, h: b});
    }
    if (hasCorners) {
      out.push({key: k++, x: 0, y: 0, w: b, h: b});
      out.push({key: k++, x: W - b, y: 0, w: b, h: b});
      out.push({key: k++, x: 0, y: H - b, w: b, h: b});
      out.push({key: k++, x: W - b, y: H - b, w: b, h: b});
    }
    return out;
  }, [hasFrame, hasTop, hasBottom, hasCorners, b, W, H]);

  return (
    <AbsoluteFill style={{pointerEvents: 'none', opacity}}>
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" height="100%">
        <defs>
          <pattern
            id={patId}
            width={spec.tileSize}
            height={spec.tileSize}
            patternUnits="userSpaceOnUse"
          >
            {spec.kind === 'girih-band' ? (
              <GirihTile d={spec} color={color} />
            ) : (
              <ArabesqueTile d={spec} color={color} />
            )}
          </pattern>
        </defs>
        {bands.map((r) => (
          <rect key={r.key} x={r.x} y={r.y} width={r.w} height={r.h} fill={`url(#${patId})`} />
        ))}
      </svg>
    </AbsoluteFill>
  );
};