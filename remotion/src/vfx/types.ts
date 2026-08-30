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
  | 'geometric-rosette';

export type VfxTileZone = 'top' | 'bottom' | 'frame' | 'corners';

export type VfxColorToken = 'accent' | 'glowColor' | 'particleColor' | 'solid';

// Geometric tile descriptor — theme-color tokens render-time (Remotion) par
// resolve hoti hain; server koi palette nahi daalta => single source of truth
// theming me rehti hai.
export interface VfxPatternDescriptor {
  kind: VfxPatternKind;
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