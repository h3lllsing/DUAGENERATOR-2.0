// DYNAMIC VFX PACK — Option B (manifest/lookSpec path).
// Sab custom-style data server (dashboard) `data/custom_vfx.json` se
// lookSpec.vfx me dalta hai; Remotion sirf props se render karta hai —
// koi runtime fs nahi, pure deterministic.

export type VfxPatternKind =
  | 'girih-band'
  | 'girih-corners'
  | 'arabesque-strip'
  | 'arabesque-corners'
  | 'bead-band'
  | 'starfield-dots'
  | 'meander-band'
  | 'geometric-rosette'
  | 'custom-shape';

export type VfxTileZone = 'top' | 'bottom' | 'frame' | 'corners';

export type VfxColorToken = 'accent' | 'glowColor' | 'particleColor' | 'solid';

// ── ShapeSpec: open-ended safe drawing primitives ──
// Pattern can use EITHER kind OR shapeSpec (never both).
// Expanded count = raw × repeat.count × rotate.copies must not exceed 200.

export type VfxPrimType = 'line' | 'circle' | 'arc' | 'polygon' | 'path';

export interface VfxPrimLine {
  prim: 'line';
  params: {x1: number; y1: number; x2: number; y2: number};
}

export interface VfxPrimCircle {
  prim: 'circle';
  params: {cx: number; cy: number; r: number};
}

export interface VfxPrimArc {
  prim: 'arc';
  params: {cx: number; cy: number; r: number; startAngle: number; endAngle: number};
}

export interface VfxPrimPolygon {
  prim: 'polygon';
  params: {points: Array<[number, number]>; close?: boolean};
}

export interface VfxPrimPath {
  prim: 'path';
  params: {d: string};
}

export type VfxPrimitive = VfxPrimLine | VfxPrimCircle | VfxPrimArc | VfxPrimPolygon | VfxPrimPath;

export interface VfxCompositionRepeat {
  count: number;       // 1..50
  spacing: number;     // 0..200 px
  direction: 'horizontal' | 'vertical';
}

export interface VfxCompositionRotate {
  centerX: number;     // -500..1500
  centerY: number;     // -500..2500
  angle: number;       // 0..360 total spread (NOT per-copy increment)
  copies: number;      // 2..12
}

export interface VfxCompositionMirror {
  axis: 'x' | 'y' | 'both';
}

export interface VfxComposition {
  repeat?: VfxCompositionRepeat;
  rotate?: VfxCompositionRotate;
  mirror?: VfxCompositionMirror;
}

export interface VfxShapeSpec {
  primitives: VfxPrimitive[];
  composition?: VfxComposition;
}

// ── Style Bundle: combined look (pattern + theme + typography + motion + audio) ──
// Each nested section is optional. All validated against their type rules.
// When multiple style bundles share the same match, last-added wins.

export interface VfxStyleBundle {
  type: 'style';
  label?: string;
  match?: string | string[];
  pattern?: Partial<VfxPatternDescriptor>;
  theme?: {
    payload?: {
      decor?: string;
      grade?: {brightness?: number; contrast?: number; saturate?: number};
    };
    affinity?: string[];
  };
  typography?: {
    fontFamily?: string;
    baseSize?: number;
    minSize?: number;
    lineHeight?: number;
  };
  motion?: Record<string, string>;
  audio?: {
    voiceArabic?: string;
    voiceUrdu?: string;
    sfxSet?: string;
  };
}

// Geometric tile descriptor — theme-color tokens render-time (Remotion) par
// resolve hoti hain; server koi palette nahi daalta => single source of truth
// theming me rehti hai.
// EITHER kind OR shapeSpec — never both.
export interface VfxPatternDescriptor {
  kind: VfxPatternKind;
  shapeSpec?: VfxShapeSpec;
  // tileSize px (16..256) — pattern coordinate space ka size
  tileSize: number;
  // strokeWidth px (0.25..8)
  strokeWidth: number;
  // theme-token binding: accent | glowColor | particleColor | solid
  colorToken: VfxColorToken;
  // required when colorToken === 'solid' (#hex)
  solidColor?: string;
  // stroke alpha (0.05..1)
  alpha: number;
  // kaha kahan band/corners draw ho
  zones: VfxTileZone[];
  // whole-frame opacity (0.05..1)
  opacity: number;
  // band thickness px (24..160) — frame/top/bottom + corner square size
  bandSize: number;
  // subtle opacity breathe (0.84 + breathAmpl*sin): 0 = static
  breathFrames: number;
  breathAmpl: number;
  // deterministic variant salt (0..999) — geometry phase, RNG nahi
  seedSalt: number;
}

// Presentational ResolvedStyle overrides whitelist (NERVER timing fields —
// sweep cycles / gloss sec — taake audio-adjacent behaviors untouched).
export interface VfxStyleOverrides {
  cornerInset?: number;
  cornerSize?: number;
  cornerOpacity?: number;
  frameEnabled?: boolean;
  frameOpacity1?: number;
  frameOpacity2?: number;
  ornamentScale?: number;
  ornamentSwayDeg?: number;
  raysOpacity?: number;
  orbsOpacity?: number;
  particlesScale?: number;
  grainOpacityDark?: number;
  grainOpacityPaper?: number;
  vignetteScale?: number;
  bokehCount?: number;
  bokehOpacity?: number;
  chromaticAberration?: number;
  shimmerStrength?: number;
  noiseVeilOpacity?: number;
  raysAngleDeg?: number;
}

export interface VfxAttachment {
  frame?: VfxPatternDescriptor;
  styleOverrides?: VfxStyleOverrides;
}