'use strict';
// DYNAMIC VFX PACK — Option B (manifest/lookSpec path).
// `data/custom_vfx.json` (project root) ko padhta hai, sanitize karta hai aur
// processing ke waqt lookSpec.vfx me attach karta hai. Remotion ko koi fs/npm
// dep nahi chahiye — props ke saath deterministic render hota hai.
//
// Sangharsh hos: ye sirf JS-level shape-sanitization hai. Render-time strict
// validation Remotion fixture me hai (src/vfx/validate.ts) — wahan fail-loud.

const fs = require('fs');
const path = require('path');

const KIND_RE = /^(girih-band|arabesque-corners)$/;
const TOKEN_RE = /^(accent|glowColor|particleColor|solid)$/;
const ZONE_RE = /^(top|bottom|frame|corners)$/;
const ID_RE = /^[A-Za-z0-9_-]{1,48}$/;
const HEX_RE = /^#[0-9A-Fa-f]{3,8}$/;
// JS magic props — plain-object registries me kabhi lookup key nahi ban sakte.
const BLOCKED_IDS = new Set(['__proto__', 'constructor', 'prototype']);

const OVERRIDE_KEYS = [
  'cornerInset', 'cornerSize', 'cornerOpacity', 'frameEnabled', 'frameOpacity1',
  'frameOpacity2', 'ornamentScale', 'ornamentSwayDeg', 'raysOpacity',
  'orbsOpacity', 'particlesScale', 'grainOpacityDark', 'grainOpacityPaper',
  'vignetteScale', 'bokehCount', 'bokehOpacity', 'chromaticAberration',
  'shimmerStrength', 'noiseVeilOpacity', 'raysAngleDeg',
];

const packPath = (PROJECT) => path.join(PROJECT, 'data', 'custom_vfx.json');

const num = (v, lo, hi, def) =>
  typeof v === 'number' && Number.isFinite(v)
    ? Math.min(hi, Math.max(lo, v))
    : def;

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
    tileSize: Math.round(num(p.tileSize, 16, 256, 150)),
    strokeWidth: num(p.strokeWidth, 0.25, 8, 1.5),
    colorToken,
    solidColor,
    alpha: num(p.alpha, 0.05, 1, 0.5),
    zones,
    opacity: num(p.opacity, 0.05, 1, 0.5),
    bandSize: Math.round(num(p.bandSize, 24, 160, 64)),
    breathFrames: Math.max(0, Math.round(num(p.breathFrames, 0, 1000, 0))),
    breathAmpl: num(p.breathAmpl, 0, 0.25, 0),
    seedSalt: Math.max(0, Math.round(num(p.seedSalt, 0, 999, 0))),
  };
}

function sanitizeOverrides(o) {
  if (!o || typeof o !== 'object') return null;
  const out = {};
  for (const k of Object.keys(o)) {
    if (!OVERRIDE_KEYS.includes(k)) continue;
    const v = o[k];
    if (k === 'frameEnabled') {
      if (typeof v === 'boolean') out[k] = v;
    } else if (typeof v === 'number' && Number.isFinite(v)) {
      out[k] = v;
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
    return {patterns, plugins: Array.isArray(raw.plugins) ? raw.plugins : []};
  } catch (_) {
    return null;
  }
}

function matches(rule, duaId) {
  if (rule == null) return false;
  if (Array.isArray(rule)) return rule.includes(duaId);
  return rule === '*' || rule === duaId;
}

// Plugin rule ka attachment spec (frame + styleOverrides), san aksar ek plugin.
function attachVfx(pack, duaId, spec) {
  if (!pack || !spec || typeof spec !== 'object') return spec;
  for (const pl of pack.plugins) {
    if (!pl || typeof pl !== 'object') continue;
    if (!matches(pl.match, duaId)) continue;
    let frame;
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
    if (frame || styleOverrides) {
      spec.vfx = {
        ...(frame ? {frame} : {}),
        ...(styleOverrides ? {styleOverrides} : {}),
      };
      return spec;
    }
  }
  return spec;
}

module.exports = {packPath, load, sanitizePattern, sanitizeOverrides, attachVfx};