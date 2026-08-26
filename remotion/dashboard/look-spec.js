'use strict';
// RNG LOOK SPEC - "Har Bar Naya" random-look mode.
// Server har render se pehle POORA look chunta hai aur temp/<id>_look.json
// me save karta hai. Render, QC-retry aur thumbnail SAB usi file se padhte
// hain => video ke andar sab consistent, thumb hamesha match (audit F3/F4).
// Remotion me koi randomness NAHI - frame-determinism safe.
//
// MASTER LOOK v3: buildLookSpec ab LOOK_DIMENSIONS registry se chalta hai.
// Naya dimension add karna = fx-guardrails.js me ek entry. Yahan kuch nahi.

const g = require('./fx-guardrails');

function buildLookSpec(theme) {
  const th = theme || 'dark';
  const spec = {
    seed: Math.floor(Math.random() * 900000000) + 100000000,
    theme: th,
    generatedAt: new Date().toISOString(),
  };
  // Registry loop: har dimension ka pool (theme affinity + weights) se pick
  for (const dim of Object.keys(g.LOOK_DIMENSIONS)) {
    spec[dim] = g.pickWeighted(
      g.LOOK_DIMENSIONS[dim](th),
      g.LOOK_WEIGHTS[dim],
    );
  }
  // preset chunte hi canvas tint uske mood ka lagta hai
  spec.tint = g.PRESET_TINTS[spec.preset] || null;
  return spec;
}

module.exports = {buildLookSpec};
