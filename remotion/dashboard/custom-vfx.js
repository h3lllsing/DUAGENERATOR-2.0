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
  if (typeof p.kind !== 'string' || !KIND_RE.test(p.kind)) return null;
  let zones = Array.isArray(p.zones)
    ? p.zones.map((z) => String(z)).filter((z) => ZONE_RE.test(z))
    : ['frame', 'corners'];
  zones = Array.from(new Set(zones));
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
  return {
    kind: p.kind,
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
function load(PROJECT) {
  try {
    const p = packPath(PROJECT);
    if (!fs.existsSync(p)) return null;
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
    return {
      patterns,
      plugins: Array.isArray(raw.plugins) ? raw.plugins : [],
      themes: loadRealm(raw.themes, sanitizeThemeItem),
      typography: loadRealm(raw.typography, sanitizeTypographyItem),
      motion: loadRealm(raw.motion, sanitizeMotionItem),
      audio: loadRealm(raw.audio, sanitizeAudioItem),
    };
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
    if (e) return applyVfx(spec, e);
  } else if (strMatch.length) {
    const e = resolvePluginSpec(pickOne(strMatch), pack);
    if (e) return applyVfx(spec, e);
  }
  // OPTION B combined rotation pool: wildcard "*" plugins AUR bare patterns
  // (jinhe koi plugin frameCustomId se reference nahi karta) ek sath — doosri
  // choti dopahar min ek pattern/plugin har dua render hota hai. Deterministic
  // (seed), pool change = cache-bump (render.js cacheKey → poolSignature).
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
  if (pool.length) return applyVfx(spec, pickOne(pool));
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
  const {items, dryRun} = opts || {};
  const dry = !!dryRun;
  const arr = Array.isArray(items) ? items : null;
  if (!arr) throw makeErr(400, 'items array required');
  if (arr.length > 12) throw makeErr(400, 'max 12 items per batch');

  const pack = load(PROJECT);
  const idx = buildIndex(pack);
  const usedPatternIds = new Set(Object.keys((pack && pack.patterns) || {}));
  const usedPluginIds = new Set(idx.pluginRecords.map((r) => r.id));
  const pendingPatterns = [];
  const pendingPlugins = [];

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
      } else if (Array.isArray(item.match) && item.match.length) {
        match = item.match.map((m) => String(m)).filter((m) => /^[a-z0-9_\-]{1,80}$/.test(m));
        if (!match.length) {
          results.push({index: i, type: 'plugin', status: 'invalid',
            reason: 'plugin.match empty ya bad ids'});
          continue;
        }
      } else {
        results.push({index: i, type: 'plugin', status: 'invalid',
          reason: 'plugin.match required (* ya id array)'});
        continue;
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
      const id = uniqueId(slugId(label, item.type), usedMasterIds[realm]);
      const entry = Object.assign({id}, s);
      if (label) entry.label = label;
      pendingMaster[realm].push(entry);
      usedMasterIds[realm].add(id);
      masterFpMap[realm].set(fp, id);
      results.push({index: i, type: item.type, id, label, status: 'added', fingerprint: fp});
      continue;
    }

    results.push({index: i, type: item.type || '?', status: 'invalid',
      reason: 'unknown type (pattern|plugin|theme|typography|motion|audio only)'});
  }

  let changed = false;
  const hasMaster = MASTER_REALMS.some((r) => pendingMaster[r].length);
  if (!dry && (pendingPatterns.length || pendingPlugins.length || hasMaster)) {
    let raw = null;
    try { raw = JSON.parse(fs.readFileSync(packPath(PROJECT), 'utf8')); } catch (_) {}
    const base = (raw && typeof raw === 'object') ? raw : {};
    const next = Object.assign({}, base, {
      version: 2,
      patterns: (Array.isArray(base.patterns) ? base.patterns : []).concat(pendingPatterns),
      plugins: (Array.isArray(base.plugins) ? base.plugins : []).concat(pendingPlugins),
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
    duplicates: results.filter((r) => r.status === 'duplicate').length,
    invalid: results.filter((r) => r.status === 'invalid').length,
    results, file: packPath(PROJECT),
  };
}

module.exports = {packPath, load, sanitizePattern, sanitizeOverrides, attachVfx,
  fingerprintPattern, fingerprintPlugin, fingerprintItem, buildIndex, importBatch,
  slugId, poolSignature, masterSummary,
  sanitizeThemeItem, sanitizeTypographyItem, sanitizeMotionItem, sanitizeAudioItem};