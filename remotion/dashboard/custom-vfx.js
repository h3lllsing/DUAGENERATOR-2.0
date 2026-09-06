'use strict';
// DYNAMIC VFX PACK — Option B (manifest/lookSpec path).
// `data/custom_vfx.json` (project root) ko padhta hai, sanitize karta hai aur
// processing ke waqt lookSpec.vfx me attach karta hai. Remotion ko koi fs/npm
// dep nahi chahiye — props ke saath deterministic render hota hai.
//
// Sakte: ye sirf JS-level shape-sanitization hai. Render-time strict validation
// Remotion fixture me hai (src/vfx/validate.ts) — wahan fail-loud.
//
// Limits/enums/whitelist ki single source of truth: data/master-schema.json
// (npm run gen:master-schema → ./master-schema.generated.cjs / vfx twin).
// Remotion wala twin (src/vfx/schema.generated.ts) isi JSON se banta hai —
// tables drift nahi kar sakte. VFX section byte-identical to legacy v1.

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const SCHEMA = require('./vfx-schema.generated.cjs');
const MASTER = require('./master-schema.generated.cjs');

const ID_RE = /^[A-Za-z0-9_-]{1,48}$/;
// JS magic props — plain-object registries me kabhi lookup key nahi ban sakte.
const BLOCKED_IDS = new Set(['__proto__', 'constructor', 'prototype']);

const KIND_RE = new RegExp('^(' + SCHEMA.pattern.enums.kind.join('|') + ')$');
const TOKEN_RE = new RegExp('^(' + SCHEMA.pattern.enums.colorToken.join('|') + ')$');
const ZONE_RE = new RegExp('^(' + SCHEMA.pattern.enums.zones.join('|') + ')$');
const HEX_RE = new RegExp(SCHEMA.hexColorPattern);
const MATCH_RE = new RegExp(MASTER.plugin.matchPattern);

const OVER_NUM = new Map(
  SCHEMA.overrides
    .filter((o) => o.type === 'number')
    .map((o) => [o.key, o]),
);
const OVER_BOOL = new Set(
  SCHEMA.overrides
    .filter((o) => o.type === 'boolean')
    .map((o) => o.key),
);

const FIELD = SCHEMA.pattern.fields;

// ── UNIFIED MASTER const sets (theme/typography/motion/audio) ──
const THEME_DECOR = new Set(MASTER.theme.enums.decor);
const THEME_IDS = new Set(MASTER.theme.enums.id);
const FAMILY = new Set(MASTER.typography.enums.family);
const VOICE_AR = new Set(MASTER.audio.enums.voiceArabic);
const VOICE_UR = new Set(MASTER.audio.enums.voiceUrdu);
const SFX_SET = new Set(MASTER.audio.enums.sfxSet);
const MOTION_ENUMS = MASTER.motion.enums;
const GRADE = MASTER.theme.grade;
const TYPO_BASE = MASTER.typography.sizes.arabicBase;
const TYPO_MIN = MASTER.typography.sizes.arabicMin;
const TYPO_LH = MASTER.typography.sizes.lineHeightAr;

const packPath = (PROJECT) => path.join(PROJECT, 'data', 'custom_vfx.json');

const num = (v, cfg) =>
  typeof v === 'number' && Number.isFinite(v)
    ? Math.min(cfg.max, Math.max(cfg.min, v))
    : cfg.def;

const shape = (v, k) => (FIELD[k].type === 'int' ? Math.round(v) : v);

function sanitizePattern(p) {
  if (!p || typeof p !== 'object') return null;

  // EITHER kind OR shapeSpec — never both
  const hasKind = typeof p.kind === 'string' && KIND_RE.test(p.kind);
  const hasShapeSpec = p.shapeSpec !== null && p.shapeSpec !== undefined;
  if (hasKind && hasShapeSpec) return null;
  if (!hasKind && !hasShapeSpec) return null;

  let shapeSpec = undefined;
  if (hasShapeSpec) {
    shapeSpec = sanitizeShapeSpec(p.shapeSpec);
    if (!shapeSpec) return null;
  }
  // kind OR shapeSpec — mutually exclusive per validate.ts L2
  let kind = hasKind ? p.kind : (shapeSpec ? undefined : 'custom-shape');

  let zones = Array.isArray(p.zones)
    ? p.zones.map((z) => String(z)).filter((z) => ZONE_RE.test(z))
    : ['frame', 'corners'];
  zones = Array.from(new Set(zones));
  if (zones.includes('top') && zones.includes('frame')) {
    zones = zones.filter((z) => z !== 'top');
  }
  if (!zones.length) zones = ['frame'];
  const colorToken =
    typeof p.colorToken === 'string' && TOKEN_RE.test(p.colorToken)
      ? p.colorToken
      : 'accent';
  let solidColor;
  if (colorToken === 'solid') {
    solidColor = typeof p.solidColor === 'string' && HEX_RE.test(p.solidColor)
      ? p.solidColor
      : null;
    if (!solidColor) return null;
  }
  const entry = {
    tileSize: shape(num(p.tileSize, FIELD.tileSize), 'tileSize'),
    strokeWidth: shape(num(p.strokeWidth, FIELD.strokeWidth), 'strokeWidth'),
    colorToken,
    solidColor,
    alpha: shape(num(p.alpha, FIELD.alpha), 'alpha'),
    zones,
    opacity: shape(num(p.opacity, FIELD.opacity), 'opacity'),
    bandSize: shape(num(p.bandSize, FIELD.bandSize), 'bandSize'),
    breathFrames: Math.max(0, shape(num(p.breathFrames, FIELD.breathFrames), 'breathFrames')),
    breathAmpl: shape(num(p.breathAmpl, FIELD.breathAmpl), 'breathAmpl'),
    seedSalt: Math.max(0, shape(num(p.seedSalt, FIELD.seedSalt), 'seedSalt')),
  };
  if (kind) entry.kind = kind;
  if (shapeSpec) entry.shapeSpec = shapeSpec;
  return entry;
}

function sanitizeOverrides(o) {
  if (!o || typeof o !== 'object') return null;
  const out = {};
  for (const k of Object.keys(o)) {
    if (OVER_BOOL.has(k)) {
      if (typeof o[k] === 'boolean') out[k] = o[k];
      continue;
    }
    const cfg = OVER_NUM.get(k);
    if (!cfg) continue;
    const v = o[k];
    if (typeof v === 'number' && Number.isFinite(v)) {
      // koi deserialization/typo quirk nahi — validate.ts jaisa hi clamp.
      out[k] = Math.min(cfg.max, Math.max(cfg.min, v));
    }
  }
  return Object.keys(out).length ? out : null;
}

// data/custom_vfx.json ko hafta-se padhta hai (silent null on error).
// Mtime-based cache: skip re-parse if file unchanged.
let _vfxCache = null;
let _vfxCacheMtime = 0;
function load(PROJECT) {
  try {
    const p = packPath(PROJECT);
    if (!fs.existsSync(p)) return null;
    const st = fs.statSync(p);
    if (_vfxCache && st.mtimeMs === _vfxCacheMtime) return _vfxCache;
    const raw = JSON.parse(fs.readFileSync(p, 'utf8'));
    if (!raw || typeof raw !== 'object') return null;
    // null-proto registry => inherited magic props (constructor etc.) khud
    // lookup me kabhi nahi aate; mart: BLOCKED_IDS setter para raha hai.
    const patterns = Object.create(null);
    if (Array.isArray(raw.patterns)) {
      for (const pat of raw.patterns) {
        if (
          pat && typeof pat.id === 'string' && ID_RE.test(pat.id) &&
          !BLOCKED_IDS.has(pat.id)
        ) {
          const s = sanitizePattern(pat);
          if (s) patterns[pat.id] = s;
        }
      }
    }
    const loadRealm = (arr, fn) =>
      Array.isArray(arr)
        ? arr.filter((it) => it && typeof it.id === 'string' && ID_RE.test(it.id) &&
            !BLOCKED_IDS.has(it.id) && fn(it))
        : [];
    const result = {
      patterns,
      plugins: Array.isArray(raw.plugins) ? raw.plugins : [],
      themes: loadRealm(raw.themes, sanitizeThemeItem),
      typography: loadRealm(raw.typography, sanitizeTypographyItem),
      motion: loadRealm(raw.motion, sanitizeMotionItem),
      audio: loadRealm(raw.audio, sanitizeAudioItem),
      styles: Array.isArray(raw.styles)
        ? raw.styles.filter((it) => it && typeof it.id === 'string' && ID_RE.test(it.id) &&
            !BLOCKED_IDS.has(it.id) && sanitizeStyleItem(it))
        : [],
    };
    _vfxCache = result;
    _vfxCacheMtime = st.mtimeMs;
    return result;
  } catch (_) {
    return null;
  }
}

// ── UNIFIED MASTER item sanitizers (theme/typography/motion/audio) ──
// Each returns a normalized file entry (id/label file-level hoti hai, yahan
// sirf type-payload ka shape) ya null. Values MASTER schema se hi aate hain.
const clampNum = (v, cfg) =>
  typeof v === 'number' && Number.isFinite(v)
    ? Math.min(cfg.max, Math.max(cfg.min, v))
    : undefined;

function sanitizeMatchField(it) {
  if (!it || typeof it.match === 'undefined' || it.match === null) return undefined;
  if (it.match === '*') return '*';
  if (Array.isArray(it.match)) {
    const m = it.match.map((x) => String(x)).filter((x) => MATCH_RE.test(x));
    return m.length ? m : undefined;
  }
  return undefined;
}

function sanitizeThemeItem(it) {
  if (!it || typeof it !== 'object' || !it.payload || typeof it.payload !== 'object') return null;
  const payload = {};
  if (typeof it.payload.decor !== 'string' || !THEME_DECOR.has(it.payload.decor)) return null;
  payload.decor = it.payload.decor;
  const grade = {};
  if (it.payload.grade && typeof it.payload.grade === 'object') {
    for (const k of ['brightness', 'contrast', 'saturate']) {
      const v = clampNum(it.payload.grade[k], GRADE[k]);
      if (v !== undefined) grade[k] = v;
    }
  }
  if (Object.keys(grade).length) payload.grade = grade;
  const entry = {payload};
  const m = sanitizeMatchField(it);
  if (m) entry.match = m;
  const aff = Array.isArray(it.affinity)
    ? it.affinity.map((a) => String(a)).filter((a) => /^[a-z0-9_\-]{1,40}$/.test(a)).slice(0, 8)
    : [];
  if (aff.length) entry.affinity = aff;
  return entry;
}

function sanitizeTypographyItem(it) {
  if (!it || typeof it !== 'object') return null;
  if (typeof it.fontFamily !== 'string' || !FAMILY.has(it.fontFamily)) return null;
  const entry = {fontFamily: it.fontFamily};
  const base = clampNum(it.baseSize, TYPO_BASE);
  if (base !== undefined) entry.baseSize = Math.round(base);
  const mini = clampNum(it.minSize, TYPO_MIN);
  if (mini !== undefined) entry.minSize = Math.round(mini);
  const lh = clampNum(it.lineHeight, TYPO_LH);
  if (lh !== undefined) entry.lineHeight = lh;
  const m = sanitizeMatchField(it);
  if (m) entry.match = m;
  return entry;
}

function sanitizeMotionItem(it) {
  if (!it || typeof it !== 'object') return null;
  const entry = {};
  for (const k of Object.keys(MOTION_ENUMS)) {
    if (typeof it[k] === 'string' && MOTION_ENUMS[k].includes(it[k])) entry[k] = it[k];
  }
  if (!Object.keys(entry).length) return null;
  const m = sanitizeMatchField(it);
  if (m) entry.match = m;
  return entry;
}

function sanitizeAudioItem(it) {
  if (!it || typeof it !== 'object') return null;
  const entry = {};
  if (typeof it.voiceArabic === 'string' && VOICE_AR.has(it.voiceArabic)) entry.voiceArabic = it.voiceArabic;
  if (typeof it.voiceUrdu === 'string' && VOICE_UR.has(it.voiceUrdu)) entry.voiceUrdu = it.voiceUrdu;
  if (typeof it.sfxSet === 'string' && SFX_SET.has(it.sfxSet)) entry.sfxSet = it.sfxSet;
  if (!Object.keys(entry).length) return null;
  const m = sanitizeMatchField(it);
  if (m) entry.match = m;
  return entry;
}

// Generic master-item fingerprint (type-payload, id/label excluded).
function fingerprintItem(entry) {
  if (!entry || typeof entry !== 'object') return null;
  return sha256(JSON.stringify(canonicalize(entry))).slice(0, 12);
}

// ── ShapeSpec sanitizer (open-ended safe primitives) ──
const PRIM_TYPES = new Set(['line', 'circle', 'arc', 'polygon', 'path']);
const SHAPE_MAX_RAW = 200;
const SHAPE_MAX_EXPANDED = 200;
const SHAPE_PATH_MAX_CHARS = 512;
const SHAPE_PATH_ALLOWED = new Set('MLHVQCZmlhvqcaz'.split(''));
const SHAPE_PATH_BLOCKED_RE = /<script|javascript:|on\w+=|<svg|<foreignObject|<img|data:/i;

function clampPrimNum(v, min, max, def) {
  return typeof v === 'number' && Number.isFinite(v) ? Math.min(max, Math.max(min, v)) : def;
}

function sanitizePrimitive(raw, idx) {
  if (!raw || typeof raw !== 'object') return null;
  if (!PRIM_TYPES.has(raw.prim)) return null;
  if (!raw.params || typeof raw.params !== 'object') return null;
  const p = raw.params;

  switch (raw.prim) {
    case 'line':
      return {prim: 'line', params: {
        x1: clampPrimNum(p.x1, -500, 1500, 0),
        y1: clampPrimNum(p.y1, -500, 2500, 0),
        x2: clampPrimNum(p.x2, -500, 1500, 100),
        y2: clampPrimNum(p.y2, -500, 2500, 100),
      }};
    case 'circle':
      return {prim: 'circle', params: {
        cx: clampPrimNum(p.cx, -500, 1500, 50),
        cy: clampPrimNum(p.cy, -500, 2500, 50),
        r: clampPrimNum(p.r, 0, 500, 30),
      }};
    case 'arc':
      return {prim: 'arc', params: {
        cx: clampPrimNum(p.cx, -500, 1500, 50),
        cy: clampPrimNum(p.cy, -500, 2500, 50),
        r: clampPrimNum(p.r, 0, 500, 40),
        startAngle: clampPrimNum(p.startAngle, 0, 360, 0),
        endAngle: clampPrimNum(p.endAngle, 0, 360, 180),
      }};
    case 'polygon': {
      const pts = Array.isArray(p.points) ? p.points : [];
      const clamped = pts.slice(0, 50).map((pt) => {
        if (!Array.isArray(pt) || pt.length < 2) return [0, 0];
        return [clampPrimNum(pt[0], -500, 1500, 0), clampPrimNum(pt[1], -500, 2500, 0)];
      });
      return {prim: 'polygon', params: {points: clamped, close: p.close !== false}};
    }
    case 'path': {
      const d = typeof p.d === 'string' ? p.d : '';
      if (d.length > SHAPE_PATH_MAX_CHARS) return null;
      if (SHAPE_PATH_BLOCKED_RE.test(d)) return null;
      for (const ch of d) {
        if (!SHAPE_PATH_ALLOWED.has(ch) && !/[0-9.,\- ]/.test(ch)) return null;
      }
      return {prim: 'path', params: {d}};
    }
    default:
      return null;
  }
}

function sanitizeComposition(raw) {
  if (!raw || typeof raw !== 'object') return undefined;
  const out = {};

  if (raw.repeat && typeof raw.repeat === 'object') {
    const r = raw.repeat;
    out.repeat = {
      count: Math.max(1, Math.min(50, Math.round(clampPrimNum(r.count, 1, 50, 1)))),
      spacing: Math.max(0, Math.min(200, Math.round(clampPrimNum(r.spacing, 0, 200, 20)))),
      direction: r.direction === 'vertical' ? 'vertical' : 'horizontal',
    };
  }

  if (raw.rotate && typeof raw.rotate === 'object') {
    const r = raw.rotate;
    // angle = total angular spread (NOT per-copy increment)
    out.rotate = {
      centerX: clampPrimNum(r.centerX, -500, 1500, 50),
      centerY: clampPrimNum(r.centerY, -500, 2500, 50),
      angle: clampPrimNum(r.angle, 0, 360, 360),
      copies: Math.max(2, Math.min(12, Math.round(clampPrimNum(r.copies, 2, 12, 6)))),
    };
  }

  if (raw.mirror && typeof raw.mirror === 'object') {
    const axis = raw.mirror.axis;
    if (axis === 'x' || axis === 'y' || axis === 'both') {
      out.mirror = {axis};
    }
  }

  return Object.keys(out).length ? out : undefined;
}

function calcExpandedCount(rawLen, comp) {
  let expanded = rawLen;
  if (comp && comp.repeat && typeof comp.repeat.count === 'number') {
    expanded *= Math.max(1, Math.min(50, Math.round(comp.repeat.count)));
  }
  if (comp && comp.rotate && typeof comp.rotate.copies === 'number') {
    expanded *= Math.max(2, Math.min(12, Math.round(comp.rotate.copies)));
  }
  return expanded;
}

function sanitizeShapeSpec(raw) {
  if (!raw || typeof raw !== 'object') return null;
  if (!Array.isArray(raw.primitives)) return null;
  if (raw.primitives.length === 0) return null;
  if (raw.primitives.length > SHAPE_MAX_RAW) return null;

  const primitives = raw.primitives.map((p, i) => sanitizePrimitive(p, i)).filter(Boolean);
  if (primitives.length === 0) return null;

  const composition = sanitizeComposition(raw.composition);

  // Expansion cap: raw × repeat.count × rotate.copies <= 200
  const expanded = calcExpandedCount(primitives.length, composition);
  if (expanded > SHAPE_MAX_EXPANDED) return null;

  return {primitives, composition};
}

// ── Style Bundle sanitizer (7th type: combined look) ──
function sanitizeStyleItem(it) {
  if (!it || typeof it !== 'object') return null;
  if (it.type !== 'style') return null;

  const out = {type: 'style'};
  if (typeof it.label === 'string') out.label = it.label.slice(0, 64);

  // match validation
  const m = sanitizeMatchField(it);
  if (m !== undefined) out.match = m;

  // Validate nested sections (each optional)
  if (it.pattern !== undefined && it.pattern !== null) {
    // For style bundles, pattern section doesn't need kind (can be shapeSpec)
    // but must have zones at minimum
    if (typeof it.pattern === 'object' && Array.isArray(it.pattern.zones) && it.pattern.zones.length > 0) {
      const p = sanitizePattern(it.pattern);
      if (p) out.pattern = p;
    }
  }

  if (it.theme !== undefined && it.theme !== null) {
    const theme = sanitizeStyleThemeSection(it.theme);
    if (theme) out.theme = theme;
  }

  if (it.typography !== undefined && it.typography !== null) {
    const typo = sanitizeStyleTypographySection(it.typography);
    if (typo) out.typography = typo;
  }

  if (it.motion !== undefined && it.motion !== null) {
    const motion = sanitizeStyleMotionSection(it.motion);
    if (motion) out.motion = motion;
  }

  if (it.audio !== undefined && it.audio !== null) {
    const audio = sanitizeStyleAudioSection(it.audio);
    if (audio) out.audio = audio;
  }

  return out;
}

function sanitizeStyleThemeSection(raw) {
  if (!raw || typeof raw !== 'object') return undefined;
  const out = {};

  if (raw.payload && typeof raw.payload === 'object') {
    const payload = {};
    if (typeof raw.payload.decor === 'string' && THEME_DECOR.has(raw.payload.decor)) {
      payload.decor = raw.payload.decor;
    }
    const grade = {};
    if (raw.payload.grade && typeof raw.payload.grade === 'object') {
      for (const k of ['brightness', 'contrast', 'saturate']) {
        const v = clampNum(raw.payload.grade[k], GRADE[k]);
        if (v !== undefined) grade[k] = v;
      }
    }
    if (Object.keys(grade).length) payload.grade = grade;
    if (Object.keys(payload).length) out.payload = payload;
  }

  if (Array.isArray(raw.affinity)) {
    out.affinity = raw.affinity
      .filter((a) => typeof a === 'string' && /^[a-z0-9_\-]{1,40}$/.test(a))
      .slice(0, 8);
  }

  return Object.keys(out).length ? out : undefined;
}

function sanitizeStyleTypographySection(raw) {
  if (!raw || typeof raw !== 'object') return undefined;
  const out = {};
  if (typeof raw.fontFamily === 'string' && FAMILY.has(raw.fontFamily)) out.fontFamily = raw.fontFamily;
  const base = clampNum(raw.baseSize, TYPO_BASE);
  if (base !== undefined) out.baseSize = Math.round(base);
  const mini = clampNum(raw.minSize, TYPO_MIN);
  if (mini !== undefined) out.minSize = Math.round(mini);
  const lh = clampNum(raw.lineHeight, TYPO_LH);
  if (lh !== undefined) out.lineHeight = lh;
  return Object.keys(out).length ? out : undefined;
}

function sanitizeStyleMotionSection(raw) {
  if (!raw || typeof raw !== 'object') return undefined;
  const out = {};
  for (const k of Object.keys(MOTION_ENUMS)) {
    if (typeof raw[k] === 'string' && MOTION_ENUMS[k].includes(raw[k])) out[k] = raw[k];
  }
  return Object.keys(out).length ? out : undefined;
}

function sanitizeStyleAudioSection(raw) {
  if (!raw || typeof raw !== 'object') return undefined;
  const out = {};
  if (typeof raw.voiceArabic === 'string' && VOICE_AR.has(raw.voiceArabic)) out.voiceArabic = raw.voiceArabic;
  if (typeof raw.voiceUrdu === 'string' && VOICE_UR.has(raw.voiceUrdu)) out.voiceUrdu = raw.voiceUrdu;
  if (typeof raw.sfxSet === 'string' && SFX_SET.has(raw.sfxSet)) out.sfxSet = raw.sfxSet;
  return Object.keys(out).length ? out : undefined;
}

function matches(rule, duaId) {
  if (rule == null) return false;
  if (Array.isArray(rule)) return rule.includes(duaId);
  return rule === '*' || rule === duaId;
}

// Deterministic pick seed: look seed (per-dua random, look file me stable)
// ya fir duaId charCode hash — koi Math.random yahan nahi.
function stableSeed(n) {
  if (typeof n === 'number' && Number.isFinite(n)) return Math.abs(Math.trunc(n));
  return String(n == null ? '' : n).split('').reduce((a, c) => a + (c.charCodeAt(0) || 0), 0);
}

// Plugin rule ka attachment spec (frame + styleOverrides), san aksar ek plugin.
// OPTION B GLOBAL POOL: targeted (array-match, legacy) > string-match >
// combined pool (wildcard "*" plugins + bare standalone patterns) — seed se
// deterministic pick. Sab 18+ patterns render-capable bina wrapper ke; koi
// dua-id hardcoding engine level par nahi — data/custom_vfx.json hi bolti hai.
function resolvePluginSpec(pl, pack) {
  let frame = null;
  if (
    typeof pl.frameCustomId === 'string' &&
    !BLOCKED_IDS.has(pl.frameCustomId) &&
    pack.patterns[pl.frameCustomId]
  ) {
    frame = pack.patterns[pl.frameCustomId];
  } else if (pl.frameCustom && typeof pl.frameCustom === 'object') {
    frame = sanitizePattern(pl.frameCustom);
  }
  const styleOverrides = sanitizeOverrides(pl.styleOverrides);
  if (!frame && !styleOverrides) return null;
  return {
    kind: 'plugin',
    ...(frame ? {frame} : {}),
    ...(styleOverrides ? {styleOverrides} : {}),
  };
}

function applyVfx(spec, entry) {
  const vfx = {};
  if (entry && entry.frame) vfx.frame = entry.frame;
  if (entry && entry.styleOverrides) vfx.styleOverrides = entry.styleOverrides;
  if (!vfx.frame && !vfx.styleOverrides) return spec;
  spec.vfx = vfx;
  return spec;
}

function attachVfx(pack, duaId, spec) {
  if (!pack || !spec || typeof spec !== 'object') return spec;
  const plugins = (pack.plugins || []).filter((pl) => pl && typeof pl === 'object');
  const targeted = plugins.filter((pl) => Array.isArray(pl.match) && pl.match.includes(duaId));
  const strMatch = plugins.filter((pl) => typeof pl.match === 'string' && pl.match === duaId && pl.match !== '*');
  const seed = stableSeed(spec.seed != null ? spec.seed : duaId);
  const pickOne = (arr) => (arr.length === 1 ? arr[0] : arr[Math.floor(seed % arr.length)]);

  if (targeted.length) {
    const e = resolvePluginSpec(pickOne(targeted), pack);
    if (e) spec = applyVfx(spec, e);
  } else if (strMatch.length) {
    const e = resolvePluginSpec(pickOne(strMatch), pack);
    if (e) spec = applyVfx(spec, e);
  } else {
    // OPTION B combined rotation pool: wildcard "*" plugins AUR bare patterns
    const pool = [];
    for (const pl of plugins) {
      if (pl.match === '*') {
        const e = resolvePluginSpec(pl, pack);
        if (e) pool.push(e);
      }
    }
    const referenced = new Set();
    for (const pl of plugins) {
      if (typeof pl.frameCustomId === 'string') referenced.add(pl.frameCustomId);
    }
    for (const id of Object.keys(pack.patterns)) {
      if (referenced.has(id)) continue;
      pool.push({kind: 'bare', frame: pack.patterns[id]});
    }
    if (pool.length) {
      const picked = pickOne(pool);
      if (picked) spec = applyVfx(spec, picked);
    }
  }

  // ── STYLE BUNDLE consumption (always, regardless of plugin match) ──
  const styles = Array.isArray(pack.styles) ? pack.styles : [];
  for (const sty of styles) {
    if (!sty || typeof sty !== 'object') continue;
    if (!matches(sty.match, duaId)) continue;
    if (sty.pattern && typeof sty.pattern === 'object') {
      const vfx = spec.vfx || {};
      if (!vfx.frame) vfx.frame = sty.pattern;
      spec.vfx = vfx;
    }
    if (sty.theme && typeof sty.theme === 'object') {
      if (typeof spec.theme === 'string') {
        spec.themeOverrides = sty.theme;
      } else {
        spec.theme = Object.assign({}, spec.theme || {}, sty.theme);
      }
    }
    if (sty.typography && typeof sty.typography === 'object') {
      spec.typography = Object.assign({}, spec.typography || {}, sty.typography);
    }
    if (sty.motion && typeof sty.motion === 'object') {
      spec.motion = Object.assign({}, spec.motion || {}, sty.motion);
    }
    if (sty.audio && typeof sty.audio === 'object') {
      spec.audio = Object.assign({}, spec.audio || {}, sty.audio);
    }
  }
  return spec;
}

// Render cache signature: master pool file ki raw bytes ka hash. Imported item
// → signature badla → cacheKey badla → stale render nahi bach sakta.
function poolSignature(PROJECT) {
  try {
    const raw = fs.readFileSync(packPath(PROJECT));
    return crypto.createHash('sha256').update(raw).digest('hex').slice(0, 16);
  } catch (_) {
    return 'none';
  }
}

function masterSummary(pack) {
  return {
    themes: (pack && pack.themes ? pack.themes : []).length,
    typography: (pack && pack.typography ? pack.typography : []).length,
    motion: (pack && pack.motion ? pack.motion : []).length,
    audio: (pack && pack.audio ? pack.audio : []).length,
  };
}

// ══════════════════════════════════════════════════════════════
//  DEDUPE & IMPORT ENGINE — Phase 2
//  Fingerprint: SHA-256 over canonical (sorted-key, sorted-zones) sanitized
//  descriptor — label/id excluded (rename se false-duplicate na bane).
//  Similarity: exact signature (kind|colorToken|zones) pe normalized numeric
//  vector ka L1 distance + normalized-label char similarity.
//  importBatch(): schema-validate → slug-unique id (BLOCKED_IDS guard) →
//  dedupe → atomic append (dryRun=false pe). Yuk scratch registry frontier.
// ══════════════════════════════════════════════════════════════

const SIM_LABEL = 0.85;
const SIM_VEC = 0.12;

const makeErr = (code, msg) => { const e = new Error(msg); e.statusCode = code; return e; };

const canonicalize = (v) => {
  if (Array.isArray(v)) return v.map(canonicalize);
  if (v && typeof v === 'object') {
    const o = {};
    for (const k of Object.keys(v).sort()) o[k] = canonicalize(v[k]);
    return o;
  }
  return v;
};
const sha256 = (s) => crypto.createHash('sha256').update(s).digest('hex');

function fingerprintPattern(spec) {
  if (!spec || typeof spec !== 'object') return null;
  const c = Object.assign({}, spec, {
    zones: Array.isArray(spec.zones) ? spec.zones.slice().sort() : [],
  });
  delete c.id;
  delete c.label;
  if (!(spec.colorToken === 'solid' && typeof spec.solidColor === 'string')) delete c.solidColor;
  return sha256(JSON.stringify(canonicalize(c))).slice(0, 12);
}

function fingerprintPlugin(pl) {
  if (!pl || typeof pl !== 'object') return null;
  const o = {};
  if (Array.isArray(pl.match)) o.match = pl.match.slice().sort();
  else o.match = pl.match === '*' ? '*' : [];
  if (typeof pl.frameCustomId === 'string' && pl.frameCustomId) o.frameCustomId = pl.frameCustomId;
  if (pl.frameCustom && typeof pl.frameCustom === 'object') {
    const d = sanitizePattern(pl.frameCustom);
    if (d) o.frameCustom = canonicalize(d);
  }
  const ov = sanitizeOverrides(pl.styleOverrides);
  if (ov) o.styleOverrides = canonicalize(ov);
  return sha256(JSON.stringify(o)).slice(0, 12);
}

const normLabel = (s) =>
  String(s || '').toLowerCase()
    .replace(/[\u064B-\u065F\u0670\u0640]/g, '')
    .replace(/[^a-z0-9\u0600-\u06FF]+/g, ' ')
    .replace(/\s+/g, ' ').trim();

function charSim(a, b) {
  const len = Math.max(a.length, b.length);
  if (!len) return 0;
  let m = 0;
  for (let i = 0; i < a.length && i < b.length; i++) if (a[i] === b[i]) m++;
  return m / len;
}
const labelSim = (a, b) => {
  const x = normLabel(a);
  const y = normLabel(b);
  if (!x || !y) return 0;
  if (x === y) return 1;
  if (x.includes(y) || y.includes(x)) return 0.9;
  const rx = x.split('').reverse().join('');
  const ry = y.split('').reverse().join('');
  return Math.max(charSim(x, y), charSim(rx, ry));
};

const vecOf = (desc) => {
  const f = SCHEMA.pattern.fields;
  return Object.keys(f).map((k) => (desc[k] - f[k].min) / ((f[k].max - f[k].min) || 1));
};
const l1 = (a, b) => { let s = 0; for (let i = 0; i < a.length; i++) s += Math.abs(a[i] - b[i]); return s; };
const sigOf = (desc) =>
  desc.kind + '|' + desc.colorToken + '|' +
  (Array.isArray(desc.zones) ? desc.zones.slice().sort().join(',') : '');

function ovVec(ov) {
  const v = [];
  for (const o of SCHEMA.overrides) {
    if (o.type === 'boolean') {
      v.push(typeof ov[o.key] === 'boolean' ? (ov[o.key] ? 1 : 0) : 0);
      continue;
    }
    const val = typeof ov[o.key] === 'number' && Number.isFinite(ov[o.key]) ? ov[o.key] : o.def;
    v.push((val - o.min) / ((o.max - o.min) || 1));
  }
  return v;
}

const slugId = (label, fallback) => {
  const s = String(label || '').toLowerCase()
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40);
  return s || fallback || 'girih';
};
const uniqueId = (base, used) => {
  let id = base;
  if (BLOCKED_IDS.has(id)) id = id + '-tile';
  if (!used.has(id)) return id;
  let i = 1;
  while (used.has(id + '-' + i)) i++;
  return id + '-' + i;
};

const pluginMatchKey = (pl) =>
  Array.isArray(pl.match) ? pl.match.slice().sort().join('|') : String(pl.match || '*');
const pluginFrameKey = (pl) => {
  if (typeof pl.frameCustomId === 'string' && pl.frameCustomId) return 'id:' + pl.frameCustomId;
  if (pl.frameCustom && typeof pl.frameCustom === 'object') {
    const d = sanitizePattern(pl.frameCustom);
    return d ? 'in:' + fingerprintPattern(d) : 'in:?';
  }
  return 'id:?';
};

function buildIndex(pack) {
  const patternRecords = [];
  const patternFps = new Map();
  if (pack && pack.patterns) {
    for (const id of Object.keys(pack.patterns)) {
      const desc = pack.patterns[id];
      const fp = fingerprintPattern(desc);
      if (!fp) continue;
      patternRecords.push({id, label: String(desc.label || '').trim() || id, fp, desc});
      patternFps.set(fp, id);
    }
  }
  const pluginRecords = [];
  const pluginFps = new Map();
  const plugins = (pack && Array.isArray(pack.plugins)) ? pack.plugins : [];
  for (let i = 0; i < plugins.length; i++) {
    const pl = plugins[i];
    if (!pl || typeof pl !== 'object') continue;
    const fp = fingerprintPlugin(pl);
    if (!fp) continue;
    const label = String(pl.label || '').trim() || 'plugin-' + (i + 1);
    const id = String(pl.id || '').trim() || slugId(label, 'plugin-' + (i + 1));
    pluginRecords.push({id, label, fp, pl,
      mKey: pluginMatchKey(pl), fKey: pluginFrameKey(pl),
      ov: sanitizeOverrides(pl.styleOverrides) || {}});
    pluginFps.set(fp, id);
  }
  return {patternRecords, patternFps, pluginRecords, pluginFps};
}

// san atomic write (dryRun=false ke waqt) — temp + rename, koi partial file nahi.
function writePackAtomic(f, obj) {
  const tmp = f + '.' + Date.now() + '.' + process.pid + '.tmp.json';
  fs.writeFileSync(tmp, JSON.stringify(obj, null, 2) + '\n', 'utf8');
  fs.renameSync(tmp, f);
}

function importBatch(PROJECT, opts) {
  const {items, dryRun, allowSimilar} = opts || {};
  const dry = !!dryRun;
  const allowSim = !!allowSimilar;
  const arr = Array.isArray(items) ? items : null;
  if (!arr) throw makeErr(400, 'items array required');
  if (arr.length > 12) throw makeErr(400, 'max 12 items per batch');

  const pack = load(PROJECT);
  const idx = buildIndex(pack);
  const usedPatternIds = new Set(Object.keys((pack && pack.patterns) || {}));
  const usedPluginIds = new Set(idx.pluginRecords.map((r) => r.id));
  const pendingPatterns = [];
  const pendingPlugins = [];
  const pendingStyles = [];

  // variant limit: max 1 variant per matchedId (even with allowSimilar)
  const existingVariantOf = (matchedId, allIds) => {
    if (!matchedId) return null;
    for (const id of allIds) {
      if (id === matchedId) continue;
      if (id.startsWith(matchedId + '-') && /-\d+$/.test(id)) return id;
    }
    return null;
  };
  const patternAllIds = new Set([...usedPatternIds, ...pendingPatterns.map(p => p.id)]);
  const pluginAllIds = new Set([...usedPluginIds, ...pendingPlugins.map(p => p.id)]);
  const styleAllIds = new Set([...((pack && pack.styles) || []).map(s => s.id), ...pendingStyles.map(s => s.id)]);

  // ── UNIFIED MASTER realms (theme/typography/motion/audio) ──
  const TYPE_TO_REALM = {theme: 'themes', typography: 'typography', motion: 'motion', audio: 'audio'};
  const SANITIZE_FN = {
    themes: sanitizeThemeItem,
    typography: sanitizeTypographyItem,
    motion: sanitizeMotionItem,
    audio: sanitizeAudioItem,
  };
  const MASTER_REALMS = ['themes', 'typography', 'motion', 'audio'];
  const pendingMaster = {themes: [], typography: [], motion: [], audio: []};
  const usedMasterIds = {};
  const masterFpMap = {};
  for (const realm of MASTER_REALMS) {
    const items = (pack && pack[realm]) || [];
    usedMasterIds[realm] = new Set(items.map((it) => it && it.id).filter(Boolean));
    masterFpMap[realm] = new Map();
    for (const it of items) {
      const s = SANITIZE_FN[realm](it);
      if (s) masterFpMap[realm].set(fingerprintItem(s), it.id);
    }
  }
  const results = [];

  for (let i = 0; i < arr.length; i++) {
    const item = arr[i];
    if (!item || typeof item !== 'object') {
      results.push({index: i, type: '?', status: 'invalid', reason: 'item must be an object'});
      continue;
    }
    const label = String(item.label || '').trim().slice(0, 64);

    if (item.type === 'pattern') {
      const desc = sanitizePattern(item);
      if (!desc) {
        results.push({index: i, type: 'pattern', status: 'invalid',
          reason: 'invalid descriptor (kind/colorToken/zones/solid)'});
        continue;
      }
      const fp = fingerprintPattern(desc);
      const dupId = idx.patternFps.get(fp);
      if (dupId) {
        results.push({index: i, type: 'pattern', id: dupId, label, status: 'duplicate',
          fingerprint: fp, matchedId: dupId});
        continue;
      }
      let sim = null;
      const sig = sigOf(desc);
      const candVec = vecOf(desc);
      for (const r of idx.patternRecords) {
        if (r.fp === fp) continue;
        if (sigOf(r.desc) !== sig) continue;
        const d = l1(candVec, vecOf(r.desc));
        if (d <= SIM_VEC && (label && labelSim(label, r.label) >= SIM_LABEL)) {
          sim = {id: r.id, dist: Math.round(d * 100) / 100};
          break;
        }
      }
      const id = uniqueId(slugId(label, 'girih'), usedPatternIds);
      const entry = Object.assign({id}, desc);
      if (label) entry.label = label;
      const rec = {id, label: label || id, fp, desc};
      if (sim && !dry && !allowSim) {
        results.push({index: i, type: 'pattern', id, label, status: 'blocked-similar',
          fingerprint: fp, matchedId: sim.id, dist: sim.dist,
          reason: 'similar to existing "' + sim.id + '" (dist ' + sim.dist + ') — use allowSimilar: true to override'});
        continue;
      }
      if (sim && !dry && allowSim) {
        const existingVar = existingVariantOf(sim.id, patternAllIds);
        if (existingVar) {
          results.push({index: i, type: 'pattern', id, label, status: 'variant-exists',
            fingerprint: fp, matchedId: sim.id, dist: sim.dist,
            reason: 'variant already exists (' + existingVar + '). Delete it first or change label'});
          continue;
        }
      }
      pendingPatterns.push(entry);
      usedPatternIds.add(id);
      idx.patternRecords.push(rec);
      idx.patternFps.set(fp, id);
      pack.patterns[id] = desc; // same-batch plugin refs ke liye
      results.push(sim
        ? {index: i, type: 'pattern', id, label, status: 'similar', fingerprint: fp, matchedId: sim.id, dist: sim.dist}
        : {index: i, type: 'pattern', id, label, status: 'added', fingerprint: fp});
      continue;
    }

    if (item.type === 'plugin') {
      let frameRef = null;
      if (
        typeof item.frameCustomId === 'string' && item.frameCustomId &&
        !BLOCKED_IDS.has(item.frameCustomId) &&
        (pack.patterns[item.frameCustomId] || pendingPatterns.some((pp) => pp.id === item.frameCustomId))
      ) {
        frameRef = {kind: 'id', id: item.frameCustomId};
      } else if (item.frameCustom && typeof item.frameCustom === 'object') {
        const fd = sanitizePattern(item.frameCustom);
        if (!fd) {
          results.push({index: i, type: 'plugin', status: 'invalid',
            reason: 'plugin.frameCustom invalid'});
          continue;
        }
        frameRef = {kind: 'inline', desc: fd};
      } else {
        results.push({index: i, type: 'plugin', status: 'invalid',
          reason: 'plugin requires frameCustomId (existing/same-batch pattern) ya inline frameCustom'});
        continue;
      }

      let match;
      if (item.match === '*') {
        match = '*';
      } else if (!item.match || item.match === '') {
        // Empty string or undefined - default to wildcard with warning
        match = '*';
      } else if (Array.isArray(item.match) && item.match.length) {
        match = item.match.map((m) => String(m)).filter((m) => /^[a-z0-9_\-]{1,80}$/.test(m));
        if (!match.length) match = '*'; // fallback if no valid IDs remain
      } else {
        match = '*'; // fail-safe default
      }

      const entry = {match};
      if (label) entry.label = label;
      if (frameRef.kind === 'id') entry.frameCustomId = frameRef.id;
      else entry.frameCustom = frameRef.desc;
      const ov = sanitizeOverrides(item.styleOverrides);
      if (ov) entry.styleOverrides = ov;

      const fp = fingerprintPlugin(entry);
      const dupId = idx.pluginFps.get(fp);
      if (dupId) {
        results.push({index: i, type: 'plugin', id: dupId, label, status: 'duplicate',
          fingerprint: fp, matchedId: dupId});
        continue;
      }
      let sim = null;
      const mKey = pluginMatchKey(entry);
      const fKey = pluginFrameKey(entry);
      const ovv = ovVec(ov || {});
      for (const r of idx.pluginRecords) {
        if (r.fp === fp || r.mKey !== mKey || r.fKey !== fKey) continue;
        const d = l1(ovv, ovVec(r.ov));
        if (d <= SIM_VEC && (label && labelSim(label, r.label) >= SIM_LABEL)) {
          sim = {id: r.id, dist: Math.round(d * 100) / 100};
          break;
        }
      }
      const id = uniqueId(slugId(label, 'plugin'), usedPluginIds);
      entry.id = id;
      const rec = {id, label: label || id, fp, pl: entry, mKey, fKey, ov: ov || {}};
      if (sim && !dry && !allowSim) {
        results.push({index: i, type: 'plugin', id, label, status: 'blocked-similar',
          fingerprint: fp, matchedId: sim.id, dist: sim.dist,
          reason: 'similar to existing "' + sim.id + '" (dist ' + sim.dist + ') — use allowSimilar: true to override'});
        continue;
      }
      if (sim && !dry && allowSim) {
        const existingVar = existingVariantOf(sim.id, pluginAllIds);
        if (existingVar) {
          results.push({index: i, type: 'plugin', id, label, status: 'variant-exists',
            fingerprint: fp, matchedId: sim.id, dist: sim.dist,
            reason: 'variant already exists (' + existingVar + '). Delete it first or change label'});
          continue;
        }
      }
      pendingPlugins.push(entry);
      usedPluginIds.add(id);
      idx.pluginRecords.push(rec);
      idx.pluginFps.set(fp, id);
      results.push(sim
        ? {index: i, type: 'plugin', id, label, status: 'similar', fingerprint: fp, matchedId: sim.id, dist: sim.dist}
        : {index: i, type: 'plugin', id, label, status: 'added', fingerprint: fp});
      continue;
    }

    if (item.type === 'typography' || item.type === 'theme' ||
        item.type === 'motion' || item.type === 'audio') {
      const realm = TYPE_TO_REALM[item.type];
      const san = SANITIZE_FN[realm];
      const s = san(item);
      if (!s) {
        results.push({index: i, type: item.type, status: 'invalid',
          reason: 'invalid ' + item.type + ' payload (schema enums par check karo)'});
        continue;
      }
      const fp = fingerprintItem(s);
      const dupId = masterFpMap[realm].get(fp);
      if (dupId) {
        results.push({index: i, type: item.type, id: dupId, label, status: 'duplicate',
          fingerprint: fp, matchedId: dupId});
        continue;
      }
      // Similarity check for master items (theme/typography/motion/audio)
      let sim = null;
      const existingItems = (pack && pack[realm]) || [];
      for (const existing of existingItems) {
        const existingSan = san(existing);
        if (!existingSan) continue;
        const existingFp = fingerprintItem(existingSan);
        if (existingFp === fp) continue;
        // Simple similarity: compare JSON stringify of sanitized objects
        const newJson = JSON.stringify(canonicalize(s));
        const existJson = JSON.stringify(canonicalize(existingSan));
        if (newJson === existJson) {
          sim = {id: existing.id, dist: 0};
          break;
        }
        // Label similarity check
        if (label && labelSim(label, existing.label || '') >= SIM_LABEL) {
          sim = {id: existing.id, dist: 0.1};
          break;
        }
      }
      const id = uniqueId(slugId(label, item.type), usedMasterIds[realm]);
      const entry = Object.assign({id}, s);
      if (label) entry.label = label;
      pendingMaster[realm].push(entry);
      usedMasterIds[realm].add(id);
      masterFpMap[realm].set(fp, id);
      results.push(sim
        ? {index: i, type: item.type, id, label, status: 'similar', fingerprint: fp, matchedId: sim.id, dist: sim.dist}
        : {index: i, type: item.type, id, label, status: 'added', fingerprint: fp});
      continue;
    }

    // ── STYLE bundle (7th type: combined look) ──
    if (item.type === 'style') {
      const s = sanitizeStyleItem(item);
      if (!s) {
        results.push({index: i, type: 'style', status: 'invalid',
          reason: 'invalid style bundle (check nested sections: pattern/theme/typography/motion/audio)'});
        continue;
      }
      const fp = fingerprintItem(s);
      // Check for exact duplicate
      const usedStyles = new Set(((pack && pack.styles) || []).map((it) => it && it.id).filter(Boolean));
      const existingStyleFps = new Map();
      for (const it of ((pack && pack.styles) || [])) {
        const sf = fingerprintItem(it);
        if (sf) existingStyleFps.set(sf, it.id);
      }
      const dupId = existingStyleFps.get(fp);
      if (dupId) {
        results.push({index: i, type: 'style', id: dupId, label, status: 'duplicate',
          fingerprint: fp, matchedId: dupId});
        continue;
      }
      // Similarity check
      let sim = null;
      const existingStyles = (pack && pack.styles) || [];
      for (const existing of existingStyles) {
        const existingFp = fingerprintItem(existing);
        if (existingFp === fp) continue;
        const newJson = JSON.stringify(canonicalize(s));
        const existJson = JSON.stringify(canonicalize(existing));
        if (newJson === existJson) {
          sim = {id: existing.id, dist: 0};
          break;
        }
        if (label && labelSim(label, existing.label || '') >= SIM_LABEL) {
          sim = {id: existing.id, dist: 0.1};
          break;
        }
      }
      const id = uniqueId(slugId(label, 'style'), usedStyles);
      const entry = Object.assign({id}, s);
      if (label) entry.label = label;
      if (sim && !dry && !allowSim) {
        results.push({index: i, type: 'style', id, label, status: 'blocked-similar',
          fingerprint: fp, matchedId: sim.id, dist: sim.dist,
          reason: 'similar to existing "' + sim.id + '" (dist ' + sim.dist + ') — use allowSimilar: true to override'});
        continue;
      }
      if (sim && !dry && allowSim) {
        const existingVar = existingVariantOf(sim.id, styleAllIds);
        if (existingVar) {
          results.push({index: i, type: 'style', id, label, status: 'variant-exists',
            fingerprint: fp, matchedId: sim.id, dist: sim.dist,
            reason: 'variant already exists (' + existingVar + '). Delete it first or change label'});
          continue;
        }
      }
      pendingStyles.push(entry);
      usedStyles.add(id);
      results.push(sim
        ? {index: i, type: 'style', id, label, status: 'similar', fingerprint: fp, matchedId: sim.id, dist: sim.dist}
        : {index: i, type: 'style', id, label, status: 'added', fingerprint: fp});
      continue;
    }

    results.push({index: i, type: item.type || '?', status: 'invalid',
      reason: 'unknown type (pattern|plugin|theme|typography|motion|audio|style only)'});
  }

  let changed = false;
  const hasMaster = MASTER_REALMS.some((r) => pendingMaster[r].length);
  if (!dry && (pendingPatterns.length || pendingPlugins.length || hasMaster || pendingStyles.length)) {
    let raw = null;
    try { raw = JSON.parse(fs.readFileSync(packPath(PROJECT), 'utf8')); } catch (_) {}
    const base = (raw && typeof raw === 'object') ? raw : {};
    const next = Object.assign({}, base, {
      version: 2,
      patterns: (Array.isArray(base.patterns) ? base.patterns : []).concat(pendingPatterns),
      plugins: (Array.isArray(base.plugins) ? base.plugins : []).concat(pendingPlugins),
      styles: (Array.isArray(base.styles) ? base.styles : []).concat(pendingStyles),
    });
    for (const realm of MASTER_REALMS) {
      if (!pendingMaster[realm].length) continue;
      next[realm] = (Array.isArray(base[realm]) ? base[realm] : []).concat(pendingMaster[realm]);
    }
    writePackAtomic(packPath(PROJECT), next);
    changed = true;
  }

  return {
    ok: true, dryRun: dry, changed,
    added: results.filter((r) => r.status === 'added').length,
    similar: results.filter((r) => r.status === 'similar').length,
    blockedSimilar: results.filter((r) => r.status === 'blocked-similar').length,
    variantExists: results.filter((r) => r.status === 'variant-exists').length,
    duplicates: results.filter((r) => r.status === 'duplicate').length,
    invalid: results.filter((r) => r.status === 'invalid').length,
    results, file: packPath(PROJECT),
  };
}

module.exports = {packPath, load, sanitizePattern, sanitizeOverrides, attachVfx,
  fingerprintPattern, fingerprintPlugin, fingerprintItem, buildIndex, importBatch,
  slugId, poolSignature, masterSummary,
  sanitizeThemeItem, sanitizeTypographyItem, sanitizeMotionItem, sanitizeAudioItem,
  sanitizeShapeSpec, sanitizeStyleItem};