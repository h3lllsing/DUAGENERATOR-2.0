// SVG PATTERN TILE ENGINE — girih / arabesque / bead / starfield / meander /
// rosette tile family; kind enums data/vfx-schema.json se drive hote hain.
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

const hash3 = (a: number, b: number, c: number): number => {
  let x = (a * 73856093) ^ (b * 19349663) ^ (c * 83492791);
  x = (x ^ (x >>> 13)) | 0;
  x = (x * 1274126177) | 0;
  x = (x ^ (x >>> 16)) | 0;
  return (x >>> 0) % 10000 / 10000;
};

// Starfield tile: deterministic seedSalt-scatter of dots + 4-ray sparkles,
// grid-scattered so tile repetition par koi hole ya seam nahi banti.
const StarTile: React.FC<{d: VfxPatternDescriptor; color: string}> = ({d, color}) => {
  const S = d.tileSize;
  const G = 6;
  const cell = S / G;
  const stars = React.useMemo(() => {
    const arr: {x: number; y: number; r: number; sparkle: boolean}[] = [];
    for (let gx = 0; gx < G; gx++) {
      for (let gy = 0; gy < G; gy++) {
        const hx = hash3(d.seedSalt + 1, gx, gy);
        const hy = hash3(d.seedSalt + 7, gy, gx);
        const hr = hash3(d.seedSalt + 11, gx * 3 + gy, gy + gx * 2);
        const x = (gx + 0.22 + hx * 0.56) * cell;
        const y = (gy + 0.22 + hy * 0.56) * cell;
        const r = (0.028 + hr * 0.05) * S;
        arr.push({x, y, r, sparkle: hr > 0.66});
      }
    }
    return arr;
  }, [S, d.seedSalt]);
  return (
    <g
      fill={color}
      stroke={color}
      strokeLinejoin="round"
      strokeLinecap="round"
      strokeWidth={d.strokeWidth * 0.55}
      strokeOpacity={d.alpha}
      fillOpacity={d.alpha}
    >
      {stars.map((s, i) =>
        s.sparkle ? (
          <path
            key={'p' + i}
            d={`M${s.x} ${s.y - s.r * 5} L${s.x} ${s.y + s.r * 5} M${s.x - s.r * 5} ${s.y} L${s.x + s.r * 5} ${s.y}`}
          />
        ) : (
          <circle key={'c' + i} cx={s.x} cy={s.y} r={s.r} />
        ),
      )}
    </g>
  );
};

// Geometric rosette tile: 8-point star (do 45°-offset squares) + inner octagon
// rings + medallion. seedSalt 11.25° phase deta hai.
const RosetteTile: React.FC<{d: VfxPatternDescriptor; color: string}> = ({d, color}) => {
  const S = d.tileSize;
  const cx = S / 2;
  const cy = S / 2;
  const rA = S * 0.475;
  const rB = rA * 0.66;
  const rC = rA * 0.3;
  const rot = (d.seedSalt % 4) * 11.25;
  const geo = React.useMemo(
    () => ({
      sq1: ringPoints(cx, cy, rA, 4, rot),
      sq2: ringPoints(cx, cy, rA, 4, rot + 45),
      inRing: ringPoints(cx, cy, rB, 8, rot + 22.5),
      mid: ringPoints(cx, cy, rC, 8, rot),
    }),
    [cx, cy, rA, rB, rC, rot],
  );
  return (
    <g
      fill="none"
      stroke={color}
      strokeWidth={d.strokeWidth}
      strokeLinejoin="round"
      strokeOpacity={d.alpha}
    >
      <polygon points={geo.sq1} />
      <polygon points={geo.sq2} opacity={0.8} />
      <polygon points={geo.inRing} opacity={0.55} />
      <polygon points={geo.mid} opacity={0.7} />
      <circle cx={cx} cy={cy} r={rC * 0.42} strokeOpacity={d.alpha * 0.75} />
    </g>
  );
};

// Corner-anchored girih quarter medallion: nested quarter arcs + rotated
// 4-point star, seedSalt 15° phase. Corners zones par band-rect fills.
const GirihCornerTile: React.FC<{d: VfxPatternDescriptor; color: string}> = ({d, color}) => {
  const S = d.tileSize;
  const rot = ((d.seedSalt % 3) + 1) * 15;
  const geo = React.useMemo(() => {
    const r0 = S * 0.16;
    const r1 = S * 0.34;
    const r2 = S * 0.52;
    const q = (r: number) => `M0 ${r} A ${r} ${r} 0 0 1 ${r} 0`;
    const star = ringPoints(S * 0.02, S * 0.02, S * 0.42, 4, rot - 45);
    return {q0: q(r0), q1: q(r1), q2: q(r2), star};
  }, [S, rot]);
  return (
    <g
      fill="none"
      stroke={color}
      strokeWidth={d.strokeWidth}
      strokeLinejoin="round"
      strokeOpacity={d.alpha}
    >
      <path d={geo.q0} opacity={0.9} />
      <path d={geo.q1} opacity={0.7} />
      <path d={geo.q2} opacity={0.5} />
      <polygon points={geo.star} opacity={0.8} />
      <path d={`M0 ${S * 0.72} L${S * 0.72} 0`} strokeOpacity={d.alpha * 0.4} />
    </g>
  );
};

// Horizontal scroll belt: do rows of double-volute arabesque loops, tileable.
const ArabesqueStripTile: React.FC<{d: VfxPatternDescriptor; color: string}> = ({d, color}) => {
  const S = d.tileSize;
  const geo = React.useMemo(() => {
    const out: string[] = [];
    for (let r = 0; r < 2; r++) {
      const cy = (r * 0.5 + 0.5) * S;
      for (let i = 0; i < 6; i++) {
        const x = (i / 6) * S;
        const r0 = S * 0.17;
        out.push(`M${x} ${cy - r0 * 0.6} Q${x + r0} ${cy - r0 * 1.4} ${x + r0 * 1.6} ${cy}`);
        out.push(`M${x} ${cy + r0 * 0.6} Q${x + r0} ${cy + r0 * 1.4} ${x + r0 * 1.6} ${cy}`);
      }
    }
    return out.join(' ');
  }, [S]);
  return (
    <g
      fill="none"
      stroke={color}
      strokeWidth={d.strokeWidth}
      strokeLinecap="round"
      strokeOpacity={d.alpha}
    >
      <path d={geo} />
    </g>
  );
};

// Bead band: seedSalt-scattered beads on two thread rows (fill-based).
const BeadTile: React.FC<{d: VfxPatternDescriptor; color: string}> = ({d, color}) => {
  const S = d.tileSize;
  const beads = React.useMemo(() => {
    const arr: {x: number; y: number; r: number}[] = [];
    for (let r = 0; r < 2; r++) {
      const cy = (r * 0.5 + 0.5) * S;
      for (let i = 0; i < 7; i++) {
        const hx = hash3(d.seedSalt + 3, r, i);
        const x = ((i / 7) + 0.5 / 7 + (hx - 0.5) * 0.04) * S;
        const rr = (r === 0 ? 0.06 : 0.045 + (hx % 1) * 0.05) * S;
        arr.push({x, y: cy, r: rr});
      }
    }
    return arr;
  }, [S, d.seedSalt]);
  return (
    <g>
      <g fill="none" stroke={color} strokeWidth={d.strokeWidth * 0.4} strokeOpacity={d.alpha * 0.5}>
        <path d={`M0 ${S * 0.5} L${S} ${S * 0.5}`} />
        <path d={`M0 ${S} L${S} ${S}`} />
      </g>
      <g fill={color} fillOpacity={d.alpha}>
        {beads.map((b, i) => <circle key={i} cx={b.x} cy={b.y} r={b.r} />)}
      </g>
    </g>
  );
};

// Classic Greek meander/fret band: continuous winding stroke, 3 bays per tile.
const MeanderTile: React.FC<{d: VfxPatternDescriptor; color: string}> = ({d, color}) => {
  const S = d.tileSize;
  const depth = S * 0.22 + (d.seedSalt % 4) * S * 0.03;
  const geo = React.useMemo(() => {
    const seg = S / 3;
    const wh = seg * 0.52;
    const back = seg * 0.22;
    const y0 = S * 0.5;
    const parts: string[] = [];
    for (let i = 0; i < 3; i++) {
      const x0 = i * seg;
      const s = i % 2 === 0 ? -1 : 1;
      parts.push(`M${x0} ${y0} H${x0 + wh} V${y0 + s * depth} H${x0 + wh - back} V${y0} H${x0 + seg}`);
    }
    return parts.join(' ');
  }, [S, depth]);
  return (
    <g
      fill="none"
      stroke={color}
      strokeWidth={d.strokeWidth}
      strokeLinejoin="round"
      strokeLinecap="round"
      strokeOpacity={d.alpha}
    >
      <path d={geo} />
      <path d={`M0 ${S * 0.2} H${S} M0 ${S * 0.8} H${S}`} strokeOpacity={d.alpha * 0.35} />
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
            {(() => {
              switch (spec.kind) {
                case 'girih-band': return <GirihTile d={spec} color={color} />;
                case 'girih-corners': return <GirihCornerTile d={spec} color={color} />;
                case 'arabesque-strip': return <ArabesqueStripTile d={spec} color={color} />;
                case 'arabesque-corners': return <ArabesqueTile d={spec} color={color} />;
                case 'bead-band': return <BeadTile d={spec} color={color} />;
                case 'starfield-dots': return <StarTile d={spec} color={color} />;
                case 'meander-band': return <MeanderTile d={spec} color={color} />;
                case 'geometric-rosette': return <RosetteTile d={spec} color={color} />;
                default: return <ArabesqueTile d={spec} color={color} />;
              }
            })()}
          </pattern>
        </defs>
        {bands.map((r) => (
          <rect key={r.key} x={r.x} y={r.y} width={r.w} height={r.h} fill={`url(#${patId})`} />
        ))}
      </svg>
    </AbsoluteFill>
  );
};