// Deterministic validation layer — render-time fail-loud.
// Server sanitize kar chuka hota hai; yahan Remotion double-checks karta hai.
// Frame descriptor me structural ghalti => Error (render abort, clear message).
// Style overrides: sirf whitelist keys, sirf finite numbers (clamped).

import type {
  VfxAttachment,
  VfxPatternDescriptor,
  VfxStyleOverrides,
  VfxColorToken,
  VfxPatternKind,
  VfxTileZone,
} from './types';

const ZONES: VfxTileZone[] = ['top', 'bottom', 'frame', 'corners'];
const KINDS: VfxPatternKind[] = ['girih-band', 'arabesque-corners'];
const TOKENS: VfxColorToken[] = ['accent', 'glowColor', 'particleColor', 'solid'];
const HEX_RE = /^#[0-9A-Fa-f]{3,8}$/;

const isNum = (v: unknown): v is number =>
  typeof v === 'number' && Number.isFinite(v);

interface NumCfg {
  lo: number;
  hi: number;
  def: number;
}

const OVERRIDE_CFG: Record<keyof VfxStyleOverrides, NumCfg | 'bool'> = {
  cornerInset: {lo: 12, hi: 140, def: 52},
  cornerSize: {lo: 32, hi: 160, def: 76},
  cornerOpacity: {lo: 0.2, hi: 2, def: 1},
  frameEnabled: 'bool',
  frameOpacity1: {lo: 0, hi: 1, def: 0.3},
  frameOpacity2: {lo: 0, hi: 1, def: 0.16},
  ornamentScale: {lo: 0.5, hi: 2, def: 1},
  ornamentSwayDeg: {lo: 0, hi: 30, def: 8},
  raysOpacity: {lo: 0, hi: 1.5, def: 0.6},
  orbsOpacity: {lo: 0, hi: 2, def: 1},
  particlesScale: {lo: 0.3, hi: 3, def: 1},
  grainOpacityDark: {lo: 0, hi: 0.25, def: 0.06},
  grainOpacityPaper: {lo: 0, hi: 0.25, def: 0.08},
  vignetteScale: {lo: 0.5, hi: 1.6, def: 1},
  bokehCount: {lo: 0, hi: 80, def: 0},
  bokehOpacity: {lo: 0, hi: 1, def: 0.5},
  chromaticAberration: {lo: 0, hi: 6, def: 0},
  shimmerStrength: {lo: 0, hi: 1, def: 0.5},
  noiseVeilOpacity: {lo: 0, hi: 1, def: 0},
  raysAngleDeg: {lo: -30, hi: 60, def: 0},
};

const clamp = (v: number, cfg: NumCfg): number =>
  Math.min(cfg.hi, Math.max(cfg.lo, v));

const numProp = (raw: unknown, key: string, cfg: NumCfg): number => {
  if (typeof raw !== 'number' || !Number.isFinite(raw)) {
    throw new Error(`Custom VFX (lookSpec.vfx): ${key} must be a finite number`);
  }
  return clamp(raw, cfg);
};

const strIn = <T extends string>(raw: unknown, key: string, pool: T[]): T => {
  if (typeof raw !== 'string' || !(pool as string[]).includes(raw)) {
    throw new Error(`Custom VFX (lookSpec.vfx): ${key} must be one of: ${pool.join(' | ')}`);
  }
  return raw as T;
};

const normalizeFrame = (raw: unknown): VfxPatternDescriptor => {
  if (typeof raw !== 'object' || raw === null) {
    throw new Error('Custom VFX (lookSpec.vfx): frame must be an object');
  }
  const o = raw as Record<string, unknown>;

  const zonesRaw = Array.isArray(o.zones) ? o.zones : null;
  if (!zonesRaw || zonesRaw.length === 0) {
    throw new Error('Custom VFX (lookSpec.vfx): frame.zones must be a non-empty array');
  }
  const zones = Array.from(new Set(
    zonesRaw
      .filter((z): z is VfxTileZone => typeof z === 'string' && ZONES.includes(z as VfxTileZone)),
  ));
  if (zones.length === 0) {
    throw new Error('Custom VFX (lookSpec.vfx): frame.zones must contain only valid zone tokens');
  }
  if (zones.includes('top') && zones.includes('frame')) {
    throw new Error('Custom VFX (lookSpec.vfx): frame.zones: pick top OR frame band, not both');
  }

  const colorToken = strIn(o.colorToken, 'colorToken', TOKENS);
  let solidColor: string | undefined;
  if (colorToken === 'solid') {
    if (typeof o.solidColor !== 'string' || !HEX_RE.test(o.solidColor)) {
      throw new Error('Custom VFX (lookSpec.vfx): solid colorToken requires a #hex solidColor');
    }
    solidColor = o.solidColor;
  }

  return {
    kind: strIn(o.kind, 'kind', KINDS),
    tileSize: Math.round(numProp(o.tileSize, 'tileSize', {lo: 16, hi: 256, def: 150})),
    strokeWidth: numProp(o.strokeWidth, 'strokeWidth', {lo: 0.25, hi: 8, def: 1.5}),
    colorToken,
    solidColor,
    alpha: numProp(o.alpha, 'alpha', {lo: 0.05, hi: 1, def: 0.5}),
    zones,
    opacity: numProp(o.opacity, 'opacity', {lo: 0.05, hi: 1, def: 0.5}),
    bandSize: Math.round(numProp(o.bandSize, 'bandSize', {lo: 24, hi: 160, def: 64})),
    breathFrames: Math.max(0, Math.round(numProp(o.breathFrames, 'breathFrames', {lo: 0, hi: 1000, def: 0}))),
    breathAmpl: numProp(o.breathAmpl, 'breathAmpl', {lo: 0, hi: 0.25, def: 0}),
    seedSalt: Math.max(0, Math.round(numProp(o.seedSalt, 'seedSalt', {lo: 0, hi: 999, def: 0}))),
  };
};

const normalizeOverrides = (raw: unknown): VfxStyleOverrides | undefined => {
  if (typeof raw !== 'object' || raw === null) return undefined;
  const o = raw as Record<string, unknown>;
  const out: VfxStyleOverrides = {};
  for (const key of Object.keys(OVERRIDE_CFG)) {
    const name = key as keyof VfxStyleOverrides;
    const cfg = OVERRIDE_CFG[name];
    const v = o[key];
    if (cfg === 'bool') {
      if (typeof v === 'boolean') (out as unknown as Record<string, boolean>)[key] = v;
      continue;
    }
    if (isNum(v)) (out as unknown as Record<string, number>)[key] = clamp(v, cfg);
  }
  return Object.keys(out).length ? out : undefined;
};

// Normalized attachment (safe, clamped). null => no custom VFX.
// Malformed frame descriptor => throw (fail-loud, render aborts).
export const normalizeVfxAttachment = (raw: unknown): VfxAttachment | null => {
  if (raw === null || raw === undefined) return null;
  if (typeof raw !== 'object') {
    throw new Error('Custom VFX (lookSpec.vfx): must be an object');
  }
  const o = raw as Record<string, unknown>;
  const frame = o.frame === null || o.frame === undefined
    ? undefined
    : normalizeFrame(o.frame);
  const styleOverrides = normalizeOverrides(o.styleOverrides);
  if (!frame && !styleOverrides) return null;
  return {frame, styleOverrides};
};