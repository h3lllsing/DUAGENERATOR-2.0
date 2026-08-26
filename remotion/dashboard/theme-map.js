// Theme resolver - mirrors remotion/scripts/make_manifest.py CATEGORY_THEME
'use strict';
const CATEGORY_THEME = {
  sleep: 'mosque',
  evening: 'mosque',
  morning: 'sunset',
  travel: 'sunset',
  food: 'emerald',
  bathroom: 'emerald',
  prayer: 'manuscript',
  // PILLAR 1 · taxonomy v2 aliases (legacy ids above stay untouched)
  protection: 'dark',
  rizq: 'emerald',
  forgiveness: 'manuscript',
  morning_evening: 'sunset',
  guidance: 'manuscript',
  health: 'ocean',
  anxiety_relief: 'ocean',
  gratitude: 'eid',
  family: 'royal',
  occasions: 'ramadan',
};

const VALID = ['dark', 'mosque', 'sunset', 'manuscript', 'emerald',
  'ocean', 'desert', 'royal', 'ramadan', 'eid', 'qadr'];

// STYLE-ROTATION v2 (2026-08-23): mirrors make_manifest.py CATEGORY_ROTATIONS
// byte-for-byte (same seed formula) so both sides always agree.
const CATEGORY_ROTATIONS = {
  protection: ['desert', 'qadr'],
  guidance: ['royal', 'manuscript'],
  gratitude: ['eid', 'emerald'],
  health: ['ocean', 'emerald'],
};
const GENERAL_ROTATION = ['manuscript', 'dark', 'royal', 'emerald'];

function seedPick(list, seed) {
  let s = 0;
  const t = String(seed || '');
  for (let i = 0; i < t.length; i++) s += t.charCodeAt(i);
  return list[s % list.length];
}

function resolve(dua) {
  const t = String(dua.template || '').trim().toLowerCase();
  // Non-dark explicit choice wins; dark stamps = legacy default -> rotation.
  if (t && VALID.includes(t) && t !== 'dark') return t;
  const cat = dua.category || '';
  if (cat === 'general') {
    return seedPick(GENERAL_ROTATION, dua.id);
  }
  const rot = CATEGORY_ROTATIONS[cat];
  if (rot) return seedPick(rot, dua.id);
  return CATEGORY_THEME[cat] || 'dark';
}

module.exports = {resolve};
