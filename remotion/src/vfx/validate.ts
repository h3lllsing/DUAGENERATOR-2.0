// Deterministic validation layer — render-time fail-loud.
// Server sanitize kar chuka hota hai; yahan Remotion double-checks karta hai.
// Frame descriptor me structural ghalti => Error (render abort, clear message).
// Style overrides: sirf whitelist keys, sirf finite numbers (clamped).
// ShapeSpec: safe primitives only, expanded count capped at 200.
//
// Limits/enums/whitelist ki single source of truth: data/master-schema.json
// (npm run gen:master-schema → ./schema.generated). Server (dashboard/custom-vfx.js)
// use generated .cjs ka, yahan .ts ka — tables kabhi drift nahi kar sakte.

import type {
  VfxAttachment,
  VfxPatternDescriptor,
  VfxStyleOverrides,
  VfxColorToken,
  VfxPatternKind,
  VfxTileZone,
  VfxShapeSpec,
  VfxPrimitive,
  VfxPrimType,
  VfxComposition,
} from './types';
import {VFX_SCHEMA, MASTER_SCHEMA} from './schema.generated';

const ZONES: VfxTileZone[] = [...VFX_SCHEMA.pattern.enums.zones];
const KINDS: VfxPatternKind[] = [...VFX_SCHEMA.pattern.enums.kind];
const TOKENS: VfxColorToken[] = [...VFX_SCHEMA.pattern.enums.colorToken];
const HEX_RE = new RegExp(VFX_SCHEMA.hexColorPattern);
const PAT = VFX_SCHEMA.pattern.fields;

// ShapeSpec constants
const SHAPE_PRIM_TYPES: VfxPrimType[] = ['line', 'circle', 'arc', 'polygon', 'path'];
const SHAPE_MAX_RAW = 200;
const SHAPE_MAX_EXPANDED = 200;
const SHAPE_PATH_MAX_CHARS = 512;
const SHAPE_PATH_ALLOWED = new Set(['M','L','H','V','C','Q','A','Z','m','l','h','v','c','q','a','z']);
const SHAPE_PATH_BLOCKED_RE = /<script|javascript:|on\w+=|<svg|<foreignObject|<img|data:/i;

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

// ── ShapeSpec validation ──
// Expanded count = raw × repeat.count × rotate.copies. Must not exceed 200.
const calcExpandedCount = (rawLen: number, comp?: VfxComposition): number => {
  let expanded = rawLen;
  if (comp?.repeat && typeof comp.repeat.count === 'number') {
    expanded *= Math.max(1, Math.min(50, Math.round(comp.repeat.count)));
  }
  if (comp?.rotate && typeof comp.rotate.copies === 'number') {
    expanded *= Math.max(2, Math.min(12, Math.round(comp.rotate.copies)));
  }
  return expanded;
};

const clampNum = (v: unknown, min: number, max: number, def: number): number => {
  if (typeof v !== 'number' || !Number.isFinite(v)) return def;
  return Math.min(max, Math.max(min, v));
};

const normalizePrimitive = (raw: unknown, idx: number): VfxPrimitive => {
  if (typeof raw !== 'object' || raw === null) {
    throw new Error(`Custom VFX shapeSpec.primitives[${idx}]: must be an object`);
  }
  const o = raw as Record<string, unknown>;
  const prim = strIn(o.prim, `shapeSpec.primitives[${idx}].prim`, SHAPE_PRIM_TYPES);
  if (typeof o.params !== 'object' || o.params === null) {
    throw new Error(`Custom VFX shapeSpec.primitives[${idx}].params: must be an object`);
  }
  const p = o.params as Record<string, unknown>;

  switch (prim) {
    case 'line':
      return {prim, params: {
        x1: clampNum(p.x1, -500, 1500, 0),
        y1: clampNum(p.y1, -500, 2500, 0),
        x2: clampNum(p.x2, -500, 1500, 100),
        y2: clampNum(p.y2, -500, 2500, 100),
      }};
    case 'circle':
      return {prim, params: {
        cx: clampNum(p.cx, -500, 1500, 50),
        cy: clampNum(p.cy, -500, 2500, 50),
        r: clampNum(p.r, 0, 500, 30),
      }};
    case 'arc':
      return {prim, params: {
        cx: clampNum(p.cx, -500, 1500, 50),
        cy: clampNum(p.cy, -500, 2500, 50),
        r: clampNum(p.r, 0, 500, 40),
        startAngle: clampNum(p.startAngle, 0, 360, 0),
        endAngle: clampNum(p.endAngle, 0, 360, 180),
      }};
    case 'polygon': {
      const pts = Array.isArray(p.points) ? p.points : [];
      const clamped: Array<[number, number]> = pts.slice(0, 50).map((pt: unknown) => {
        if (!Array.isArray(pt) || pt.length < 2) return [0, 0] as [number, number];
        return [clampNum(pt[0], -500, 1500, 0), clampNum(pt[1], -500, 2500, 0)] as [number, number];
      });
      return {prim, params: {points: clamped, close: p.close !== false}};
    }
    case 'path': {
      const d = typeof p.d === 'string' ? p.d : '';
      if (d.length > SHAPE_PATH_MAX_CHARS) {
        throw new Error(`Custom VFX shapeSpec.primitives[${idx}].params.d: max ${SHAPE_PATH_MAX_CHARS} chars`);
      }
      if (SHAPE_PATH_BLOCKED_RE.test(d)) {
        throw new Error(`Custom VFX shapeSpec.primitives[${idx}].params.d: contains blocked content (script/html/data)`);
      }
      for (const ch of d) {
        if (!SHAPE_PATH_ALLOWED.has(ch) && !/[0-9.,\- ]/.test(ch)) {
          throw new Error(`Custom VFX shapeSpec.primitives[${idx}].params.d: disallowed character '${ch}'`);
        }
      }
      return {prim, params: {d}};
    }
  }
};

const normalizeComposition = (raw: unknown): VfxComposition | undefined => {
  if (typeof raw !== 'object' || raw === null) return undefined;
  const o = raw as Record<string, unknown>;
  const out: VfxComposition = {};

  if (o.repeat && typeof o.repeat === 'object') {
    const r = o.repeat as Record<string, unknown>;
    out.repeat = {
      count: Math.max(1, Math.min(50, Math.round(clampNum(r.count, 1, 50, 1)))),
      spacing: Math.max(0, Math.min(200, Math.round(clampNum(r.spacing, 0, 200, 20)))),
      direction: (r.direction === 'vertical' ? 'vertical' : 'horizontal'),
    };
  }

  if (o.rotate && typeof o.rotate === 'object') {
    const r = o.rotate as Record<string, unknown>;
    // angle = total angular spread (NOT per-copy increment)
    out.rotate = {
      centerX: clampNum(r.centerX, -500, 1500, 50),
      centerY: clampNum(r.centerY, -500, 2500, 50),
      angle: clampNum(r.angle, 0, 360, 360),
      copies: Math.max(2, Math.min(12, Math.round(clampNum(r.copies, 2, 12, 6)))),
    };
  }

  if (o.mirror && typeof o.mirror === 'object') {
    const m = o.mirror as Record<string, unknown>;
    const axis = m.axis;
    if (axis === 'x' || axis === 'y' || axis === 'both') {
      out.mirror = {axis};
    }
  }

  return Object.keys(out).length ? out : undefined;
};

const normalizeShapeSpec = (raw: unknown): VfxShapeSpec => {
  if (typeof raw !== 'object' || raw === null) {
    throw new Error('Custom VFX shapeSpec: must be an object');
  }
  const o = raw as Record<string, unknown>;
  if (!Array.isArray(o.primitives)) {
    throw new Error('Custom VFX shapeSpec.primitives: must be an array');
  }
  if (o.primitives.length === 0) {
    throw new Error('Custom VFX shapeSpec.primitives: must not be empty');
  }
  if (o.primitives.length > SHAPE_MAX_RAW) {
    throw new Error(`Custom VFX shapeSpec.primitives: max ${SHAPE_MAX_RAW} raw primitives (got ${o.primitives.length})`);
  }

  const primitives = o.primitives.map((p: unknown, i: number) => normalizePrimitive(p, i));
  const composition = normalizeComposition(o.composition);

  // Expansion cap: raw × repeat.count × rotate.copies <= 200
  const expanded = calcExpandedCount(primitives.length, composition);
  if (expanded > SHAPE_MAX_EXPANDED) {
    throw new Error(
      `Custom VFX shapeSpec: expanded primitive count ${expanded} exceeds max ${SHAPE_MAX_EXPANDED} ` +
      `(${primitives.length} raw` +
      (composition?.repeat ? ` × repeat ${composition.repeat.count}` : '') +
      (composition?.rotate ? ` × rotate ${composition.rotate.copies}` : '') +
      `)`,
    );
  }

  return {primitives, composition};
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

  // EITHER kind OR shapeSpec — never both
  const hasKind = typeof o.kind === 'string';
  const hasShapeSpec = o.shapeSpec !== null && o.shapeSpec !== undefined;
  if (hasKind && hasShapeSpec) {
    throw new Error('Custom VFX (lookSpec.vfx): frame must have either kind OR shapeSpec, not both');
  }
  if (!hasKind && !hasShapeSpec) {
    throw new Error('Custom VFX (lookSpec.vfx): frame must have either kind or shapeSpec');
  }

  const shapeSpec = hasShapeSpec ? normalizeShapeSpec(o.shapeSpec) : undefined;
  const kind: VfxPatternKind = hasShapeSpec ? 'custom-shape' : strIn(o.kind, 'kind', KINDS);

  return {
    kind,
    shapeSpec,
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

// ── Style Bundle validation (7th type) ──
// Validates nested pattern/theme/typography/motion/audio sections.
// Each section optional. All validated against their type rules.

const normalizeStyleTheme = (raw: unknown): Record<string, unknown> | undefined => {
  if (typeof raw !== 'object' || raw === null) return undefined;
  const o = raw as Record<string, unknown>;
  const out: Record<string, unknown> = {};

  if (o.payload && typeof o.payload === 'object') {
    const payload = o.payload as Record<string, unknown>;
    const grade: Record<string, number> = {};
    if (payload.grade && typeof payload.grade === 'object') {
      const g = payload.grade as Record<string, unknown>;
      if (isNum(g.brightness)) grade.brightness = clampNum(g.brightness, 0.7, 1.5, 1);
      if (isNum(g.contrast)) grade.contrast = clampNum(g.contrast, 0.7, 1.6, 1);
      if (isNum(g.saturate)) grade.saturate = clampNum(g.saturate, 0.5, 1.8, 1);
    }
    const p: Record<string, unknown> = {};
    if (typeof payload.decor === 'string') p.decor = payload.decor;
    if (Object.keys(grade).length) p.grade = grade;
    if (Object.keys(p).length) out.payload = p;
  }

  if (Array.isArray(o.affinity)) {
    out.affinity = o.affinity
      .filter((a: unknown) => typeof a === 'string' && /^[a-z0-9_\-]{1,40}$/.test(a))
      .slice(0, 8);
  }

  return Object.keys(out).length ? out : undefined;
};

const normalizeStyleTypography = (raw: unknown): Record<string, unknown> | undefined => {
  if (typeof raw !== 'object' || raw === null) return undefined;
  const o = raw as Record<string, unknown>;
  const out: Record<string, unknown> = {};
  const families = MASTER_SCHEMA.typography.enums.family;
  if (typeof o.fontFamily === 'string' && (families as readonly string[]).includes(o.fontFamily)) {
    out.fontFamily = o.fontFamily;
  }
  if (isNum(o.baseSize)) out.baseSize = Math.round(clampNum(o.baseSize, 44, 160, 104));
  if (isNum(o.minSize)) out.minSize = Math.round(clampNum(o.minSize, 20, 90, 58));
  if (isNum(o.lineHeight)) out.lineHeight = clampNum(o.lineHeight, 1.2, 3, 1.95);
  return Object.keys(out).length ? out : undefined;
};

const normalizeStyleMotion = (raw: unknown): Record<string, string> | undefined => {
  if (typeof raw !== 'object' || raw === null) return undefined;
  const o = raw as Record<string, unknown>;
  const enums = MASTER_SCHEMA.motion.enums;
  const out: Record<string, string> = {};
  for (const k of Object.keys(enums)) {
    const allowed = enums[k as keyof typeof enums];
    if (typeof o[k] === 'string' && (allowed as readonly string[]).includes(o[k] as string)) {
      out[k] = o[k] as string;
    }
  }
  return Object.keys(out).length ? out : undefined;
};

const normalizeStyleAudio = (raw: unknown): Record<string, string> | undefined => {
  if (typeof raw !== 'object' || raw === null) return undefined;
  const o = raw as Record<string, unknown>;
  const out: Record<string, string> = {};
  const ar = MASTER_SCHEMA.audio.enums.voiceArabic;
  const ur = MASTER_SCHEMA.audio.enums.voiceUrdu;
  if (typeof o.voiceArabic === 'string' && (ar as readonly string[]).includes(o.voiceArabic)) {
    out.voiceArabic = o.voiceArabic;
  }
  if (typeof o.voiceUrdu === 'string' && (ur as readonly string[]).includes(o.voiceUrdu)) {
    out.voiceUrdu = o.voiceUrdu;
  }
  if (typeof o.sfxSet === 'string' && 'default' === o.sfxSet) {
    out.sfxSet = o.sfxSet;
  }
  return Object.keys(out).length ? out : undefined;
};

export const normalizeStyleBundle = (raw: unknown): Record<string, unknown> | null => {
  if (typeof raw !== 'object' || raw === null) return null;
  const o = raw as Record<string, unknown>;
  if (o.type !== 'style') return null;

  const out: Record<string, unknown> = {type: 'style'};
  if (typeof o.label === 'string') out.label = o.label.slice(0, 64);

  // match validation
  const match = normalizeMatch(o.match);
  if (match !== undefined) out.match = match;

  // Validate nested sections (each optional)
  if (o.pattern !== undefined && o.pattern !== null) {
    const p = normalizeFrame(o.pattern);
    out.pattern = p;
  }
  const theme = normalizeStyleTheme(o.theme);
  if (theme) out.theme = theme;
  const typography = normalizeStyleTypography(o.typography);
  if (typography) out.typography = typography;
  const motion = normalizeStyleMotion(o.motion);
  if (motion) out.motion = motion;
  const audio = normalizeStyleAudio(o.audio);
  if (audio) out.audio = audio;

  return out;
};

const normalizeMatch = (raw: unknown): string | string[] | undefined => {
  if (raw === '*' || raw === null || raw === undefined) return raw === '*' ? '*' : undefined;
  if (Array.isArray(raw)) {
    const arr = raw.map((x) => String(x)).filter((x) => /^[a-z0-9_\-]{1,80}$/.test(x));
    return arr.length ? arr : undefined;
  }
  return undefined;
};