'use strict';
// FX GUARDRAILS - theme-affinity taste table.
// Har pool me sirf wo options jo tasteful hain; exclude-maps clash rules.
// Phase A (borders) / B (sky) / C (islamic art) yahan registries badhenge -
// look-spec.js logic ko chhue ki zaroorat nahi.

const STYLE_PRESETS = ['classic', 'royal', 'minimal', 'cinematic',
  'masterpiece', 'volumetric', 'raytrace', 'embernight', 'glitterroyal',
  'desertmirage', 'waterripple', 'silkmarble', 'cinemafocus',
  'auroranova', 'qadrtilt'];

// Taste rules: preset jo kisi theme par clash karta hai
const PRESET_EXCLUDE = {
  manuscript: ['embernight'],   // purana kaagaz + urte angaare = jalne ka look
};

// PHASE A (2026-08-23): Border basics FX live
const BORDER_FX = ['none', 'clouds', 'birds', 'flags', 'wind'];

// Positive affinity: fx sirf in themes par (null/missing = sab allowed)
const BORDER_ALLOWED = {
  clouds: ['dark', 'mosque', 'qadr', 'ramadan', 'sunset', 'royal'],
  flags: ['ramadan', 'eid', 'mosque', 'royal'],
  wind: ['desert', 'sunset', 'emerald', 'ocean'],
};

// PHASE B (2026-08-23): Sky / Weather FX live
const SKY_FX = ['none', 'rain', 'storm', 'snow',
  'fog', 'smoke', 'fireflies', 'petals'];

const SKY_ALLOWED = {
  rain: ['dark', 'mosque', 'qadr', 'royal', 'ocean', 'emerald'],
  storm: ['dark', 'qadr', 'mosque'],
  snow: ['dark', 'qadr', 'ramadan', 'mosque'],
  fog: ['dark', 'mosque', 'emerald', 'ocean', 'desert'],
  fireflies: ['emerald', 'ocean', 'dark', 'eid'],
  petals: ['eid', 'emerald', 'royal', 'manuscript', 'ramadan'],
  // smoke = sab themes (bakhur universal)
};

// PHASE C (2026-08-23): Islamic Art FX live
const ART_FX = ['none', 'rosette', 'sitare', 'vines',
  'lanterns', 'caravan', 'palms'];

const ART_ALLOWED = {
  caravan: ['desert', 'sunset'],
  palms: ['desert', 'sunset', 'emerald', 'ocean'],
  vines: ['emerald', 'manuscript', 'royal', 'eid', 'ocean', 'qadr'],
  lanterns: ['dark', 'mosque', 'royal', 'ramadan', 'eid', 'qadr'],
};

// Manual override valid lists (portal dropdowns) - auto + sab fx ids
const ART_SELECT = ['auto'].concat(ART_FX);
const SKY_SELECT = ['auto'].concat(SKY_FX);
const BORDER_SELECT = ['auto'].concat(BORDER_FX);

function filterAffinity(pool, allowed, theme) {
  return pool.filter((fx) => fx === 'none' ||
    !allowed[fx] || allowed[fx].includes(theme));
}

function filterArtPool(theme) {
  return filterAffinity(ART_FX, ART_ALLOWED, theme);
}

function filterSkyPool(theme) {
  return filterAffinity(SKY_FX, SKY_ALLOWED, theme);
}

function filterBorderPool(theme) {
  return filterAffinity(BORDER_FX, BORDER_ALLOWED, theme);
}

// MASTER LOOK v2 (2026-08-24): frame designs + preset-mood canvas tints.
// Ek look => poora package (preset + fx + frame + colors).
const FRAME_VARIANTS = ['classic', 'arch', 'deco', 'rosette'];

// Remotion/src/FrameStyles.tsx ke PRESET_TINTS ka mirror (single truth dono
// taraf same rakhi gayi hai).
const PRESET_TINTS = {
  classic: {c1: '#d9ad59', c2: '#ffecbe', a: 0.08},
  royal: {c1: '#e6b95f', c2: '#2a9d70', a: 0.1},
  minimal: {c1: '#f0dcaf', c2: '#ffffff', a: 0.05},
  cinematic: {c1: '#3a54dc', c2: '#803eeb', a: 0.12},
  masterpiece: {c1: '#2d50e1', c2: '#843af2', a: 0.13},
  volumetric: {c1: '#ffecbe', c2: '#fff5dd', a: 0.12},
  raytrace: {c1: '#e6b95f', c2: '#ffcd78', a: 0.11},
  embernight: {c1: '#ff7a1f', c2: '#c83c14', a: 0.14},
  glitterroyal: {c1: '#f0c86e', c2: '#2a9d70', a: 0.11},
  desertmirage: {c1: '#e8be78', c2: '#b48c50', a: 0.12},
  waterripple: {c1: '#1e8ca0', c2: '#3c64dc', a: 0.13},
  silkmarble: {c1: '#f5eee4', c2: '#ebc8be', a: 0.09},
  cinemafocus: {c1: '#283ca0', c2: '#6e37c8', a: 0.13},
  auroranova: {c1: '#23dcbe', c2: '#ff78be', a: 0.14},
  qadrtilt: {c1: '#2d50e1', c2: '#eeaa76', a: 0.12},
};

// ==========================================================================
// MASTER LOOK v3 - LOOK DIMENSIONS REGISTRY (plugin architecture)
// -------------------------------------------------------------------------
// Naya randomizable dimension add karna ho to SIRF 2 steps:
//   1. Neeche pool array banao + LOOK_DIMENSIONS me entry daalo
//   2. Remotion/src/LookVariants.tsx me component banao + ID list export
// buildLookSpec() khud naya dimension chun lega - koi aur jagah change nahi.
// ==========================================================================

// Dimension pools (Remotion ke ID lists ka mirror)
const TEXT_FX = ['glide', 'blurin', 'typewriter', 'popwave'];
const MOTIF_FX = ['none', 'tasbih', 'kaaba', 'rehal', 'star8'];
const GRADE_MOODS = ['auto', 'warmgold', 'coolnight', 'sepia', 'dreamy'];
const CAMERA_MOVES = ['static', 'zoomin', 'panx', 'kenburns', 'driftbreathe'];
const INTRO_STYLES = ['classic', 'crescentfade', 'patternwipe'];
const ORNAMENT_STYLES = ['starcrescent', 'lanternjhumka', 'medallion', 'geostar'];

// Weighted taste: kuch defaults zyada baar aayein (naye cheezein showcase
// hoti rahen magar classic feel kabhi kharab na ho)
const LOOK_WEIGHTS = {
  frame: {classic: 0.55},
  textFx: {glide: 1.35},
  gradeFx: {auto: 2.2},
  introFx: {classic: 1.4},
};

function filterPresetPool(theme) {
  const ex = new Set(PRESET_EXCLUDE[theme] || []);
  return STYLE_PRESETS.filter((p) => !ex.has(p));
}

function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

// Registry: dimension -> pool factory (theme affinity support)
const LOOK_DIMENSIONS = {
  preset: (th) => filterPresetPool(th),
  borderFx: (th) => filterBorderPool(th),
  skyFx: (th) => filterSkyPool(th),
  artFx: (th) => filterArtPool(th),
  frame: () => FRAME_VARIANTS,
  textFx: () => TEXT_FX,
  motif: () => MOTIF_FX,
  gradeFx: () => GRADE_MOODS,
  camera: () => CAMERA_MOVES,
  introFx: () => INTRO_STYLES,
  ornament: () => ORNAMENT_STYLES,
};

// Weighted random pick (weights missing = uniform)
function pickWeighted(pool, weights) {
  if (!pool || !pool.length) return undefined;
  if (!weights) return pick(pool);
  const entries = pool.map((id) => [id, weights[id] != null ? weights[id] : 1]);
  const total = entries.reduce((a, c) => a + c[1], 0);
  let r = Math.random() * total;
  for (const [id, w] of entries) {
    r -= w;
    if (r <= 0) return id;
  }
  return entries[entries.length - 1][0];
}

module.exports = {
  STYLE_PRESETS, PRESET_EXCLUDE,
  BORDER_FX, SKY_FX, ART_FX,
  BORDER_ALLOWED, SKY_ALLOWED, ART_ALLOWED,
  ART_SELECT, SKY_SELECT, BORDER_SELECT,
  FRAME_VARIANTS, PRESET_TINTS,
  TEXT_FX, MOTIF_FX, GRADE_MOODS, CAMERA_MOVES, INTRO_STYLES, ORNAMENT_STYLES,
  LOOK_DIMENSIONS, LOOK_WEIGHTS, filterPresetPool, pickWeighted,
  filterArtPool, filterSkyPool, filterBorderPool, filterAffinity,
};
