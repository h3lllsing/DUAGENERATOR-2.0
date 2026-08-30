// Deterministic validation layer — render-time fail-loud.
// Server sanitize kar chuka hota hai; yahan Remotion double-checks karta hai.
// Frame descriptor me structural ghalti => Error (render abort, clear message).
// Style overrides: sirf whitelist keys, sirf finite numbers (clamped).
//
// Limits/enums/whitelist ki single source of truth: data/vfx-schema.json
// (npm run gen:vfx-schema → ./schema.generated). Server (dashboard/custom-vfx.js)
// use generated .cjs ka, yahan .ts ka — tables kabhi drift nahi kar sakte.

import type {
  VfxAttachment,
  VfxPatternDescriptor,
  VfxStyleOverrides,
  VfxColorToken,
  VfxPatternKind,
  VfxTileZone,
} from './types';
import {VFX_SCHEMA} from './schema.generated';

const ZONES: VfxTileZone[] = [...VFX_SCHEMA.pattern.enums.zones];
const KINDS: VfxPatternKind[] = [...VFX_SCHEMA.pattern.enums.kind];
const TOKENS: VfxColorToken[] = [...VFX_SCHEMA.pattern.enums.colorToken];
const HEX_RE = new RegExp(VFX_SCHEMA.hexColorPattern);
const PAT = VFX_SCHEMA.pattern.fields;

const isNum = (v: unknown): v is number =>
  typeof v === 'number' && Number.isFinite(v);

interface NumCfg {
  lo: number;
  hi: number;
  def: number;
}

const OVERRIDE_CFG = Object.fromEntries(
  VFX_SCHEMA.overrides.map((o) => [
    o.key,
    o.type === 'boolean'
      ? 'bool'
      : {lo: o.min as number, hi: o.max as number, def: o.def as number},
  ]),
) as Record<keyof VfxStyleOverrides, NumCfg | 'bool'>;

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
    tileSize: Math.round(numProp(o.tileSize, 'tileSize', {
      lo: PAT.tileSize.min, hi: PAT.tileSize.max, def: PAT.tileSize.def})),
    strokeWidth: numProp(o.strokeWidth, 'strokeWidth', {
      lo: PAT.strokeWidth.min, hi: PAT.strokeWidth.max, def: PAT.strokeWidth.def}),
    colorToken,
    solidColor,
    alpha: numProp(o.alpha, 'alpha', {
      lo: PAT.alpha.min, hi: PAT.alpha.max, def: PAT.alpha.def}),
    zones,
    opacity: numProp(o.opacity, 'opacity', {
      lo: PAT.opacity.min, hi: PAT.opacity.max, def: PAT.opacity.def}),
    bandSize: Math.round(numProp(o.bandSize, 'bandSize', {
      lo: PAT.bandSize.min, hi: PAT.bandSize.max, def: PAT.bandSize.def})),
    breathFrames: Math.max(0, Math.round(numProp(o.breathFrames, 'breathFrames', {
      lo: PAT.breathFrames.min, hi: PAT.breathFrames.max, def: PAT.breathFrames.def}))),
    breathAmpl: numProp(o.breathAmpl, 'breathAmpl', {
      lo: PAT.breathAmpl.min, hi: PAT.breathAmpl.max, def: PAT.breathAmpl.def}),
    seedSalt: Math.max(0, Math.round(numProp(o.seedSalt, 'seedSalt', {
      lo: PAT.seedSalt.min, hi: PAT.seedSalt.max, def: PAT.seedSalt.def}))),
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