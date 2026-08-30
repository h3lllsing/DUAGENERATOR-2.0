'use strict';
/* gen_master_schema.mjs — data/master-schema.json ko single source maan kar
 * UNIFIED artifacts banata hai (pattern | plugin | theme | typography |
 * motion | audio — sab item types same schema lineage se):
 *   - src/vfx/schema.generated.ts           (Remotion render-time: MASTER_SCHEMA
 *                                            + VFX_SCHEMA subset for validate.ts)
 *   - dashboard/master-schema.generated.cjs (server: new-type validation)
 *   - dashboard/vfx-schema.generated.cjs    (server VFX twin — byte-shape same)
 *   - dashboard/public/master-schema-ui.js  (browser MASTER prompt constants)
 *   - dashboard/public/vfx-schema-ui.js     (browser legacy VFX constants)
 * Drift-guard: contract checks neeche fail-loud hain — schema ghalat ho to
 * exit(1). Panchoo twins parse kar ke deep-equal check hote hain. No eval.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SRC_JSON = resolve(ROOT, '..', 'data', 'master-schema.json');
const OUT_TS = resolve(ROOT, 'src', 'vfx', 'schema.generated.ts');
const OUT_VFX_CJS = resolve(ROOT, 'dashboard', 'vfx-schema.generated.cjs');
const OUT_MASTER_CJS = resolve(ROOT, 'dashboard', 'master-schema.generated.cjs');
const OUT_UI = resolve(ROOT, 'dashboard', 'public', 'master-schema-ui.js');
const OUT_UI_LEGACY = resolve(ROOT, 'dashboard', 'public', 'vfx-schema-ui.js');

// ── VFX drift guards (8 kinds, 20 override keys — byte-identical to v1) ──
const EXPECTED_FIELDS = [
  'tileSize', 'strokeWidth', 'alpha', 'opacity', 'bandSize',
  'breathFrames', 'breathAmpl', 'seedSalt',
];
const EXPECTED_ENUMS = ['kind', 'colorToken', 'zones'];
const EXPECTED_KINDS = [
  'girih-band', 'girih-corners', 'arabesque-strip', 'arabesque-corners',
  'bead-band', 'starfield-dots', 'meander-band', 'geometric-rosette',
];
const INT_FIELDS = new Set(['tileSize', 'bandSize', 'breathFrames', 'seedSalt']);
const EXPECTED_OVERRIDES = [
  'cornerInset', 'cornerSize', 'cornerOpacity', 'frameEnabled', 'frameOpacity1',
  'frameOpacity2', 'ornamentScale', 'ornamentSwayDeg', 'raysOpacity',
  'orbsOpacity', 'particlesScale', 'grainOpacityDark', 'grainOpacityPaper',
  'vignetteScale', 'bokehCount', 'bokehOpacity', 'chromaticAberration',
  'shimmerStrength', 'noiseVeilOpacity', 'raysAngleDeg',
];

// ── theme / typography / motion / audio drift guards (mirror render side) ──
const EXPECTED_THEMES = ['dark', 'mosque', 'sunset', 'manuscript', 'emerald',
  'ocean', 'desert', 'royal', 'ramadan', 'eid', 'qadr'];
const EXPECTED_DECOR = ['stars', 'mosque', 'sun', 'paper', 'pattern', 'waves',
  'dunes', 'royal', 'lanterns', 'festive', 'qadr'];
const EXPECTED_FONTS = ['amiri-quran', 'noto-nastaliq-urdu', 'scheherazade-new'];
const EXPECTED_ROLES = ['arabic', 'urdu', 'ui', 'emoji'];
const EXPECTED_MOTION = {
  frame: ['classic', 'arch', 'deco', 'rosette'],
  textFx: ['glide', 'fade', 'none', 'typewriter', 'popwave'],
  motif: ['none', 'tasbih', 'kaaba', 'rehal', 'star8'],
  gradeFx: ['auto', 'warmgold', 'coolnight', 'sepia', 'dreamy'],
  camera: ['static', 'zoomin', 'panx', 'kenburns'],
  introFx: ['classic', 'crescentfade', 'patternwipe'],
  ornament: ['starcrescent', 'lanternjhumka', 'medallion', 'geostar'],
  borderFx: ['none', 'clouds', 'birds', 'flags', 'wind'],
  skyFx: ['none', 'rain', 'storm', 'snow', 'fog', 'smoke', 'fireflies', 'petals'],
  artFx: ['none', 'rosette', 'sitare', 'vines', 'lanterns', 'caravan', 'palms'],
};
const EXPECTED_SIZES = ['arabicBase', 'urduBase', 'arabicMin', 'urduMin',
  'lineHeightAr', 'lineHeightUr'];

function fail(msg) {
  console.error('SCHEMA ERROR: ' + msg);
  process.exit(1);
}
const isFin = (v) => typeof v === 'number' && Number.isFinite(v);
const eqArr = (a, b) => Array.isArray(a) && Array.isArray(b) &&
  a.length === b.length && a.every((v, i) => v === b[i]);

let schema;
try {
  schema = JSON.parse(readFileSync(SRC_JSON, 'utf8'));
} catch (e) {
  fail('cannot read ' + SRC_JSON + ': ' + e.message);
}

// ── contract checks (drift-guard) ──
if (schema.schemaVersion !== 2) fail('schemaVersion must be 2 (unified master)');
if (typeof schema.hexColorPattern !== 'string' || !schema.hexColorPattern.length) {
  fail('hexColorPattern missing');
}

const pat = schema.pattern;
if (!pat || !pat.fields || !pat.enums) fail('pattern.fields / pattern.enums required');
for (const k of EXPECTED_FIELDS) {
  const f = pat.fields[k];
  if (!f || !isFin(f.min) || !isFin(f.max) || !isFin(f.def)) {
    fail('pattern field "' + k + '" needs numeric min/max/def');
  }
  if (f.min > f.def || f.def > f.max) fail('pattern field "' + k + '" violates min<=def<=max');
  if (INT_FIELDS.has(k) && f.type !== 'int') fail('pattern field "' + k + '" must be type int');
}
for (const k of EXPECTED_ENUMS) {
  const e = pat.enums[k];
  if (!Array.isArray(e) || !e.length || e.some((v) => typeof v !== 'string')) {
    fail('pattern enum "' + k + '" must be a non-empty string array');
  }
}
if (!eqArr(pat.enums.kind, EXPECTED_KINDS)) {
  fail('kind enum must be exactly the 8 render-level kinds (drift: tile engine vs schema)');
}
if (!eqArr(pat.enums.zones, ['top', 'bottom', 'frame', 'corners'])) {
  fail('zones enum drift (expected top|bottom|frame|corners)');
}
if (!eqArr(pat.enums.colorToken, ['accent', 'glowColor', 'particleColor', 'solid'])) {
  fail('colorToken enum drift (expected accent|glowColor|particleColor|solid)');
}
if (
  !Array.isArray(pat.zonesExclusive) ||
  pat.zonesExclusive.some((v) => !pat.enums.zones.includes(v))
) {
  fail('zonesExclusive must be a subset of the zones enum');
}

const ov = Array.isArray(schema.overrides) ? schema.overrides : null;
if (!ov || ov.length !== EXPECTED_OVERRIDES.length) {
  fail('overrides count != ' + EXPECTED_OVERRIDES.length);
}
const ovKeys = ov.map((x) => x.key);
if (EXPECTED_OVERRIDES.some((k) => !ovKeys.includes(k))) fail('overrides missing expected keys (drift)');
let numOv = 0;
let boolOv = 0;
for (const o of ov) {
  if (typeof o.key !== 'string' || !o.key.length) fail('override key required');
  if (o.type === 'boolean') {
    boolOv++;
    if (o.min !== undefined) fail('boolean override "' + o.key + '" cannot carry min/max/def');
  } else if (o.type === 'number') {
    numOv++;
    if (!isFin(o.min) || !isFin(o.max) || !isFin(o.def)) {
      fail('numeric override "' + o.key + '" needs numeric min/max/def');
    }
    if (o.min > o.def || o.def > o.max) fail('override "' + o.key + '" violates min<=def<=max');
  } else {
    fail('override "' + o.key + '" type must be number | boolean');
  }
}
if (numOv !== 19 || boolOv !== 1) fail('expected exactly 19 numeric + 1 boolean override');

// ── plugin section ──
const plg = schema.plugin;
if (!plg || typeof plg.matchWildcard !== 'string' || !plg.matchWildcard) {
  fail('plugin.matchWildcard required');
}
if (!plg.matchPattern || !plg.matchPattern.length) fail('plugin.matchPattern required (regex string)');
if (!plg.idPattern || !plg.idPattern.length) fail('plugin.idPattern required (regex string)');

// ── theme section ──
const thm = schema.theme;
if (!thm || !thm.enums || !thm.grade) fail('theme.enums / theme.grade required');
if (!eqArr(thm.enums.id, EXPECTED_THEMES)) fail('theme id enum drift (expected 11 themes)');
if (!eqArr(thm.enums.decor, EXPECTED_DECOR)) fail('theme decor enum drift (expected 11 decor values)');
for (const k of ['brightness', 'contrast', 'saturate']) {
  const g = thm.grade[k];
  if (!g || !isFin(g.min) || !isFin(g.max) || !isFin(g.def)) {
    fail('theme.grade."' + k + '" needs numeric min/max/def');
  }
  if (g.min > g.def || g.def > g.max) fail('theme.grade."' + k + '" violates min<=def<=max');
}

// ── typography section ──
const typ = schema.typography;
if (!typ || !typ.enums || !typ.sizes) fail('typography.enums / typography.sizes required');
if (!eqArr(typ.enums.family, EXPECTED_FONTS)) fail('typography family enum drift (3 packaged fonts)');
if (!eqArr(typ.enums.role, EXPECTED_ROLES)) fail('typography role enum drift (arabic|urdu|ui|emoji)');
for (const k of EXPECTED_SIZES) {
  const s = typ.sizes[k];
  if (!s || !isFin(s.min) || !isFin(s.max) || !isFin(s.def)) {
    fail('typography.sizes."' + k + '" needs numeric min/max/def');
  }
  if (s.min > s.def || s.def > s.max) fail('typography.sizes."' + k + '" violates min<=def<=max');
}

// ── motion section ──
const mot = schema.motion;
if (!mot || !mot.enums) fail('motion.enums required');
for (const k of Object.keys(EXPECTED_MOTION)) {
  if (!Array.isArray(mot.enums[k]) || mot.enums[k].length === 0 ||
    mot.enums[k].some((v) => typeof v !== 'string')) {
    fail('motion.enums."' + k + '" must be a non-empty string array');
  }
  if (!eqArr(mot.enums[k], EXPECTED_MOTION[k])) {
    fail('motion.enums."' + k + '" drift vs fx-guardrails pool');
  }
}

// ── audio section ──
const aud = schema.audio;
if (!aud || !aud.enums) fail('audio.enums required');
for (const k of ['voiceArabic', 'voiceUrdu', 'sfxSet']) {
  if (!Array.isArray(aud.enums[k]) || aud.enums[k].length === 0 ||
    aud.enums[k].some((v) => typeof v !== 'string')) {
    fail('audio.enums."' + k + '" must be a non-empty string array');
  }
}

// ── VFX subset (byte-shape same as v1) + UI projections ──
const vfxSubset = {
  schemaVersion: 1,
  description: schema.description,
  hexColorPattern: schema.hexColorPattern,
  pattern: schema.pattern,
  overrides: schema.overrides,
};
const MASTER_UI = {
  version: schema.schemaVersion,
  hexColorPattern: schema.hexColorPattern,
  pattern: {
    zonesExclusive: pat.zonesExclusive,
    fields: Object.keys(pat.fields).map((key) => ({
      key,
      type: pat.fields[key].type,
      min: pat.fields[key].min,
      max: pat.fields[key].max,
      def: pat.fields[key].def,
    })),
    enums: pat.enums,
  },
  overrides: ov,
  plugin: {matchWildcard: plg.matchWildcard, matchPattern: plg.matchPattern, idPattern: plg.idPattern},
  theme: {enums: thm.enums, grade: thm.grade},
  typography: {enums: typ.enums, sizes: typ.sizes},
  motion: {enums: mot.enums},
  audio: {enums: aud.enums},
};
const VFX_UI = {
  kind: pat.enums.kind,
  colorToken: pat.enums.colorToken,
  zones: pat.enums.zones,
  zonesExclusive: pat.zonesExclusive,
  hexColorPattern: schema.hexColorPattern,
  fields: Object.keys(pat.fields).map((key) => ({
    key,
    type: pat.fields[key].type,
    min: pat.fields[key].min,
    max: pat.fields[key].max,
    def: pat.fields[key].def,
  })),
  overrides: ov,
};

// ── render (string-template composition, no eval) ──
const ts = [
  '// AUTO-GENERATED by scripts/gen_master_schema.mjs — DO NOT EDIT. Edit data/master-schema.json.',
  '// Unified source of truth: pattern | plugin | theme | typography | motion | audio.',
  '// VFX consumers (src/vfx/validate.ts) VFX_SCHEMA export se padhte hain — wo isi se banta hai.',
  '',
  'export interface VfxNumBound {',
  "  type: 'int' | 'float';",
  '  min: number;',
  '  max: number;',
  '  def: number;',
  '}',
  '',
  'export interface VfxEnumSet {',
  '  [k: string]: readonly string[];',
  '}',
  '',
  'export interface VfxOverrideCfg {',
  '  key: string;',
  "  type: 'number' | 'boolean';",
  '  min?: number;',
  '  max?: number;',
  '  def?: number;',
  '}',
  '',
  'export const MASTER_SCHEMA = ' + JSON.stringify(schema, null, 2) + ' as const;',
  '',
  'export const VFX_SCHEMA = ' + JSON.stringify(vfxSubset, null, 2) + ' as const;',
  '',
].join('\n');
writeFileSync(OUT_TS, ts, 'utf8');

const deepFreeze = (v) => {
  if (v && typeof v === 'object') {
    for (const k of Object.keys(v)) deepFreeze(v[k]);
    Object.freeze(v);
  }
  return v;
};
const fresh = (v) => JSON.parse(JSON.stringify(v));

const masterCjs = [
  "'use strict';",
  '// AUTO-GENERATED by scripts/gen_master_schema.mjs — DO NOT EDIT. Edit data/master-schema.json.',
  '// Server-side UNIFIED twin — dashboard/custom-vfx.js new-type validation isi se chalta hai.',
  '',
  'module.exports = ' + JSON.stringify(deepFreeze(fresh(schema))) + ';',
  '',
].join('\n');
writeFileSync(OUT_MASTER_CJS, masterCjs, 'utf8');

const vfxCjs = [
  "'use strict';",
  '// AUTO-GENERATED by scripts/gen_master_schema.mjs — DO NOT EDIT. Edit data/master-schema.json.',
  '// Server-side VFX twin (byte-shape same as v1) — dashboard sanitizer isi ko consume karta hai.',
  '',
  'module.exports = ' + JSON.stringify(deepFreeze(fresh(vfxSubset))) + ';',
  '',
].join('\n');
writeFileSync(OUT_VFX_CJS, vfxCjs, 'utf8');

const uiJs = [
  "'use strict';",
  '// AUTO-GENERATED by scripts/gen_master_schema.mjs — DO NOT EDIT. Edit data/master-schema.json.',
  '// Browser UNIFIED twin — app.js (Master Studio prompt) isi se schema-exact enums/whitelist leta hai.',
  '// Jab tak ye file exist karti hai, prompt schemas se drift nahi kar sakta.',
  '',
  'window.MASTER_SCHEMA_UI = ' + JSON.stringify(MASTER_UI) + ';',
  '',
].join('\n');
writeFileSync(OUT_UI, uiJs, 'utf8');

const uiLegacyJs = [
  "'use strict';",
  '// AUTO-GENERATED by scripts/gen_master_schema.mjs — DO NOT EDIT. Edit data/master-schema.json.',
  '// Browser VFX twin (backward compat) — VFX_STUDIO prompt portion isi se nikalta hai.',
  '',
  'window.VFX_SCHEMA_UI = ' + JSON.stringify(VFX_UI) + ';',
  '',
].join('\n');
writeFileSync(OUT_UI_LEGACY, uiLegacyJs, 'utf8');

// ── parity check: har twin ko wapas parse/require kar ke deep-equal verify ──
const require = createRequire(import.meta.url);
const eq = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const parseTsConst = (txt, name) => {
  const start = txt.indexOf('export const ' + name + ' = ');
  if (start < 0) fail('ts twin me "' + name + '" nahi mila');
  let s = txt.indexOf('{', start);
  let depth = 0;
  let end = -1;
  for (let i = s; i < txt.length; i++) {
    if (txt[i] === '{') depth++;
    else if (txt[i] === '}') {
      depth--;
      if (depth === 0) { end = i; break; }
    }
  }
  if (end < 0) fail('ts twin "' + name + '" parse fail');
  return JSON.parse(txt.slice(s, end + 1));
};
const parseUiConst = (txt, name) => {
  const s = txt.indexOf(name + ' = ');
  if (s < 0) fail('ui twin me "' + name + '" nahi mila');
  const b = txt.indexOf('{', s);
  let depth = 0;
  let end = -1;
  for (let i = b; i < txt.length; i++) {
    if (txt[i] === '{') depth++;
    else if (txt[i] === '}') {
      depth--;
      if (depth === 0) { end = i; break; }
    }
  }
  if (end < 0) fail('ui twin "' + name + '" parse fail');
  return JSON.parse(txt.slice(b, end + 1));
};

if (!eq(parseTsConst(readFileSync(OUT_TS, 'utf8'), 'MASTER_SCHEMA'), schema)) {
  fail('ts twin MASTER_SCHEMA != data/master-schema.json (drift)');
}
if (!eq(parseTsConst(readFileSync(OUT_TS, 'utf8'), 'VFX_SCHEMA'), vfxSubset)) {
  fail('ts twin VFX_SCHEMA != vfx subset (drift)');
}
if (!eq(require(OUT_MASTER_CJS), schema)) fail('master cjs twin != data/master-schema.json (drift)');
if (!eq(require(OUT_VFX_CJS), vfxSubset)) fail('vfx cjs twin != vfx subset (drift)');
if (!eq(parseUiConst(readFileSync(OUT_UI, 'utf8'), 'window.MASTER_SCHEMA_UI'), MASTER_UI)) {
  fail('master-schema-ui.js projection drift');
}
if (!eq(parseUiConst(readFileSync(OUT_UI_LEGACY, 'utf8'), 'window.VFX_SCHEMA_UI'), VFX_UI)) {
  fail('vfx-schema-ui.js projection drift');
}

console.log('gen:master-schema OK (schema v2)');
console.log('  schema             ' + SRC_JSON);
console.log('  ts                 ' + OUT_TS + '  (MASTER_SCHEMA + VFX_SCHEMA)');
console.log('  cjs (master)       ' + OUT_MASTER_CJS);
console.log('  cjs (vfx twin)     ' + OUT_VFX_CJS + '  (' + EXPECTED_FIELDS.length + ' pattern fields, ' + ov.length + ' overrides)');
console.log('  ui (master)        ' + OUT_UI);
console.log('  ui (legacy vfx)    ' + OUT_UI_LEGACY);
console.log('  parity: ts/cjs/ui all deep-equal verified');