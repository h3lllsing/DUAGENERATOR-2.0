// Per-video styling presets: THEME colors deta hai, PRESET decor/VFX
// intensity deta hai — dono alag layers hain, freely combinable.

export interface ResolvedStyle {
  // corner L-ornaments
  cornerInset: number;
  cornerSize: number;
  cornerOpacity: number;
  // double hairline gold frame (non-paper themes)
  frameEnabled: boolean;
  frameOpacity1: number;
  frameOpacity2: number;
  // top star+crescent ornament
  ornamentScale: number;
  ornamentSwayDeg: number;
  // atmosphere
  raysOpacity: number;
  orbsOpacity: number;
  particlesScale: number;
  grainOpacityDark: number;
  grainOpacityPaper: number;
  vignetteScale: number;
  // light sweeps
  sweepCycleSec: number;
  sweepAmbientAlpha: number;
  sweepPhaseAlpha: number;
  paperTreatment: PaperTreatment;
  // ===== CGI/VFX EXTENSION (2026-08-23 batch-2) =====
  // DoF bokeh: peeche tairte soft glowing dots (0 = off)
  bokehCount: number;
  bokehOpacity: number;
  // lens fringe: edges par RGB split ghost (0 = off, px offset)
  chromaticAberration: number;
  // displacement distortions: garmi ki lehrein / paani ki lahrein / resham
  shimmerMode: ShimmerMode;
  shimmerStrength: number; // 0..1
  // text/metal par tez golden sheen ka specular sweep (0 = off, seconds/cycle)
  glossSweepCycleSec: number;
  // particle look: dhool / chamak / angaare / sitare
  particleStyle: ParticleStyle;
  // Matrix3D jaisa halka perspective tilt (degrees, 0 = off)
  tilt3dDeg: number;
  // procedural Perlin-noise veil (feTurbulence, 0 = off)
  noiseVeilOpacity: number;
  // god-rays ka base angle (har preset ki apni roshni direction)
  raysAngleDeg: number;
}

export type ShimmerMode = 'none' | 'heat' | 'ripple' | 'silk';
export type ParticleStyle = 'dust' | 'glitter' | 'embers' | 'stars';

type PresetOverrides = Partial<ResolvedStyle>;

// BATCH 3 · paper/manuscript individualization per preset
export type PaperTreatment = 'none' | 'royal' | 'cinematic' | 'minimal';

// Aurora = bare rangin glows jo background me dheere tairte hain
// (preset ki asli pehchan — har mood ka apna palette)
export interface AuroraBlob {
  // base rgb (alpha code me lagti hai)
  r: number;
  g: number;
  b: number;
  a: number; // peak alpha
  size: number; // px diameter approx
  drift: number; // wander amplitude fraction of frame
  speed: number; // noise time multiplier
}

export interface AuroraConfig {
  blobs: AuroraBlob[];
  breathePeriod: number; // frames
}

const AURORA: Record<string, AuroraConfig> = {
  // Classic: warm subtle golds (current vibe preserved)
  classic: {
    blobs: [
      {r: 217, g: 173, b: 89, a: 0.11, size: 1150, drift: 0.1, speed: 0.004},
      {r: 255, g: 236, b: 190, a: 0.07, size: 850, drift: 0.13, speed: 0.0055},
    ],
    breathePeriod: 210,
  },
  // Royal: rich gold + emerald + teal (shahi feel)
  royal: {
    blobs: [
      {r: 230, g: 185, b: 95, a: 0.17, size: 1250, drift: 0.11, speed: 0.004},
      {r: 42, g: 157, b: 112, a: 0.13, size: 1050, drift: 0.15, speed: 0.005},
      {r: 24, g: 110, b: 118, a: 0.1, size: 950, drift: 0.09, speed: 0.0035},
    ],
    breathePeriod: 190,
  },
  // Minimal: ek hi halka warm glow
  minimal: {
    blobs: [
      {r: 240, g: 220, b: 175, a: 0.06, size: 1000, drift: 0.07, speed: 0.003},
    ],
    breathePeriod: 260,
  },
  // Cinematic: deep blue + violet + gold hint (raat ka samandar)
  cinematic: {
    blobs: [
      {r: 58, g: 84, b: 220, a: 0.14, size: 1300, drift: 0.12, speed: 0.0038},
      {r: 128, g: 62, b: 235, a: 0.11, size: 1000, drift: 0.15, speed: 0.0052},
      {r: 217, g: 173, b: 89, a: 0.08, size: 900, drift: 0.1, speed: 0.0045},
    ],
    breathePeriod: 230,
  },
  // Masterpiece: Laylatul-Qadr — gehri raat, benafsi dhund, gulabi sona
  masterpiece: {
    blobs: [
      {r: 45, g: 80, b: 225, a: 0.16, size: 1400, drift: 0.12, speed: 0.0035},
      {r: 132, g: 58, b: 242, a: 0.13, size: 1100, drift: 0.16, speed: 0.005},
      {r: 238, g: 168, b: 118, a: 0.1, size: 950, drift: 0.1, speed: 0.0042},
      {r: 255, g: 245, b: 225, a: 0.07, size: 800, drift: 0.14, speed: 0.006},
    ],
    breathePeriod: 240,
  },
  /* ===== CGI/VFX BATCH-2 palettes ===== */
  // Volumetric: safed-sone ki roshni ka ruzan
  volumetric: {
    blobs: [
      {r: 255, g: 236, b: 190, a: 0.15, size: 1500, drift: 0.08, speed: 0.003},
      {r: 217, g: 173, b: 89, a: 0.11, size: 1150, drift: 0.12, speed: 0.004},
      {r: 255, g: 250, b: 235, a: 0.08, size: 900, drift: 0.15, speed: 0.005},
    ],
    breathePeriod: 220,
  },
  // Ray-Traced: sona + taizka amber reflections
  raytrace: {
    blobs: [
      {r: 230, g: 185, b: 95, a: 0.16, size: 1250, drift: 0.09, speed: 0.0042},
      {r: 255, g: 205, b: 120, a: 0.12, size: 950, drift: 0.13, speed: 0.0058},
      {r: 120, g: 90, b: 40, a: 0.1, size: 1050, drift: 0.07, speed: 0.0032},
    ],
    breathePeriod: 200,
  },
  // Ember Night: aag ke rang - narangi, laal, sona
  embernight: {
    blobs: [
      {r: 255, g: 122, b: 31, a: 0.15, size: 1200, drift: 0.13, speed: 0.0048},
      {r: 200, g: 60, b: 20, a: 0.12, size: 1000, drift: 0.1, speed: 0.0038},
      {r: 217, g: 173, b: 89, a: 0.09, size: 900, drift: 0.15, speed: 0.0055},
    ],
    breathePeriod: 180,
  },
  // Glitter Royal: shahi sona + halka emerald jhalak
  glitterroyal: {
    blobs: [
      {r: 240, g: 200, b: 110, a: 0.17, size: 1300, drift: 0.1, speed: 0.004},
      {r: 42, g: 157, b: 112, a: 0.09, size: 1000, drift: 0.14, speed: 0.005},
      {r: 255, g: 245, b: 210, a: 0.07, size: 850, drift: 0.12, speed: 0.006},
    ],
    breathePeriod: 195,
  },
  // Desert Mirage: ret jaisa sunehra + garm safed
  desertmirage: {
    blobs: [
      {r: 232, g: 190, b: 120, a: 0.14, size: 1350, drift: 0.09, speed: 0.0036},
      {r: 255, g: 225, b: 170, a: 0.11, size: 1000, drift: 0.13, speed: 0.005},
      {r: 180, g: 140, b: 80, a: 0.09, size: 1100, drift: 0.07, speed: 0.003},
    ],
    breathePeriod: 215,
  },
  // Water Ripple: samandari teal + neela + chandi
  waterripple: {
    blobs: [
      {r: 30, g: 140, b: 160, a: 0.15, size: 1300, drift: 0.11, speed: 0.004},
      {r: 60, g: 100, b: 220, a: 0.12, size: 1100, drift: 0.14, speed: 0.005},
      {r: 200, g: 230, b: 240, a: 0.08, size: 900, drift: 0.09, speed: 0.0045},
    ],
    breathePeriod: 205,
  },
  // Silk Marble: moti, gulabi safed, halka sona
  silkmarble: {
    blobs: [
      {r: 245, g: 238, b: 228, a: 0.12, size: 1400, drift: 0.06, speed: 0.0028},
      {r: 235, g: 200, b: 190, a: 0.09, size: 1000, drift: 0.09, speed: 0.0038},
      {r: 217, g: 173, b: 89, a: 0.06, size: 850, drift: 0.08, speed: 0.004},
    ],
    breathePeriod: 265,
  },
  // Cinema Focus: gehri raat + neela violet + door ka sona
  cinemafocus: {
    blobs: [
      {r: 40, g: 60, b: 160, a: 0.15, size: 1450, drift: 0.1, speed: 0.0034},
      {r: 110, g: 55, b: 200, a: 0.11, size: 1050, drift: 0.14, speed: 0.005},
      {r: 217, g: 173, b: 89, a: 0.06, size: 800, drift: 0.11, speed: 0.0048},
    ],
    breathePeriod: 235,
  },
  // Aurora Nova: teal + banafsi + gulabi - shandar rang
  auroranova: {
    blobs: [
      {r: 35, g: 220, b: 190, a: 0.16, size: 1350, drift: 0.14, speed: 0.0052},
      {r: 150, g: 70, b: 250, a: 0.15, size: 1200, drift: 0.16, speed: 0.0046},
      {r: 255, g: 120, b: 190, a: 0.11, size: 1000, drift: 0.12, speed: 0.006},
      {r: 80, g: 140, b: 255, a: 0.1, size: 950, drift: 0.1, speed: 0.0055},
    ],
    breathePeriod: 175,
  },
  // Qadr Tilt: masterpiece palette + gehra nileel
  qadrtilt: {
    blobs: [
      {r: 45, g: 80, b: 225, a: 0.17, size: 1450, drift: 0.12, speed: 0.0037},
      {r: 132, g: 58, b: 242, a: 0.14, size: 1150, drift: 0.15, speed: 0.0052},
      {r: 238, g: 168, b: 118, a: 0.11, size: 950, drift: 0.1, speed: 0.0044},
    ],
    breathePeriod: 228,
  },
};

export const getAurora = (id?: string | null): AuroraConfig =>
  AURORA[isValidPreset(id) ? id : 'classic'] || AURORA.classic;

// CLASSIC = exact current hardcoded values (backward-safe default)
const CLASSIC: ResolvedStyle = {
  cornerInset: 30,
  cornerSize: 74,
  cornerOpacity: 1,
  frameEnabled: true,
  frameOpacity1: 0.2,
  frameOpacity2: 0.11,
  ornamentScale: 1,
  ornamentSwayDeg: 8,
  raysOpacity: 0.55,
  orbsOpacity: 1,
  particlesScale: 1,
  grainOpacityDark: 0.05,
  grainOpacityPaper: 0.07,
  vignetteScale: 1,
  sweepCycleSec: 6.5,
  sweepAmbientAlpha: 1,
  sweepPhaseAlpha: 0.14,
  paperTreatment: 'none',
  // CGI/VFX defaults (neutral - classic look bilkul waisa hi)
  bokehCount: 0,
  bokehOpacity: 0.5,
  chromaticAberration: 0,
  shimmerMode: 'none',
  shimmerStrength: 0,
  glossSweepCycleSec: 0,
  particleStyle: 'dust',
  tilt3dDeg: 0,
  noiseVeilOpacity: 0,
  raysAngleDeg: 0,
};

const PRESETS: Record<string, {label: string; over: PresetOverrides}> = {
  classic: {label: 'Classic Gold (current)', over: {}},
  royal: {
    label: 'Royal Heavy',
    over: {
      cornerSize: 84,
      cornerOpacity: 1.25,
      frameOpacity1: 0.3,
      frameOpacity2: 0.16,
      ornamentScale: 1.22,
      ornamentSwayDeg: 10,
      raysOpacity: 0.75,
      orbsOpacity: 1.35,
      particlesScale: 1.25,
      vignetteScale: 1.05,
      sweepCycleSec: 7.5,
      sweepPhaseAlpha: 0.18,
      paperTreatment: 'royal',
    },
  },
  minimal: {
    label: 'Minimal Clean',
    over: {
      cornerSize: 64,
      cornerOpacity: 0.65,
      frameEnabled: false,
      ornamentScale: 0.85,
      ornamentSwayDeg: 5,
      raysOpacity: 0.3,
      orbsOpacity: 0.6,
      particlesScale: 0.6,
      grainOpacityDark: 0.03,
      grainOpacityPaper: 0.04,
      vignetteScale: 0.85,
      sweepCycleSec: 9,
      sweepAmbientAlpha: 0.55,
      sweepPhaseAlpha: 0.1,
      paperTreatment: 'minimal',
    },
  },
  cinematic: {
    label: 'Cinematic Deep',
    over: {
      cornerOpacity: 0.9,
      frameOpacity1: 0.24,
      ornamentScale: 1.05,
      ornamentSwayDeg: 6,
      raysOpacity: 0.65,
      orbsOpacity: 1.15,
      particlesScale: 0.8,
      grainOpacityDark: 0.065,
      vignetteScale: 1.25,
      sweepCycleSec: 10,
      sweepAmbientAlpha: 0.8,
      paperTreatment: 'cinematic',
    },
  },
  // hidden 5th: sirf data.masterpiece flag wali videos ke liye
  masterpiece: {
    label: 'Masterpiece (Qadr Night)',
    over: {
      cornerSize: 88,
      cornerOpacity: 1.3,
      frameEnabled: true,
      frameOpacity1: 0.32,
      frameOpacity2: 0.17,
      ornamentScale: 1.3,
      ornamentSwayDeg: 7,
      raysOpacity: 0.8,
      orbsOpacity: 1.4,
      particlesScale: 1.4,
      grainOpacityDark: 0.06,
      vignetteScale: 1.3,
      sweepCycleSec: 8,
      sweepAmbientAlpha: 0.85,
      sweepPhaseAlpha: 0.2,
    },
  },
  /* ===== CGI/VFX BATCH-2 (2026-08-23): 10 naye presets ===== */
  // Ruzan se aati roshni ke kiran - heavy volumetric god rays + dhund
  volumetric: {
    label: 'Volumetric Noor (God Rays)',
    over: {
      raysOpacity: 0.95,
      raysAngleDeg: -8,
      bokehCount: 26,
      bokehOpacity: 0.55,
      vignetteScale: 1.35,
      orbsOpacity: 0.9,
      particlesScale: 1.15,
      sweepPhaseAlpha: 0.16,
      chromaticAberration: 1.2,
    },
  },
  // metal surfaces par light-bounce gloss (ray-tracing feel)
  raytrace: {
    label: 'Ray-Traced Gold',
    over: {
      chromaticAberration: 1.6,
      glossSweepCycleSec: 5.2,
      frameOpacity1: 0.34,
      cornerOpacity: 1.2,
      orbsOpacity: 1.3,
      grainOpacityDark: 0.055,
      tilt3dDeg: 1.2,
      vignetteScale: 1.15,
      raysAngleDeg: 5,
    },
  },
  // urte hue angaare - warm ember particle system
  embernight: {
    label: 'Ember Night',
    over: {
      particleStyle: 'embers',
      particlesScale: 1.3,
      vignetteScale: 1.28,
      raysOpacity: 0.45,
      orbsOpacity: 1.1,
      grainOpacityDark: 0.06,
      raysAngleDeg: 3,
    },
  },
  // chamakti sona glitter + shahi frame + specular sheen
  glitterroyal: {
    label: 'Gold Glitter Royal',
    over: {
      particleStyle: 'glitter',
      particlesScale: 1.45,
      paperTreatment: 'royal',
      glossSweepCycleSec: 6.8,
      frameOpacity1: 0.32,
      cornerSize: 84,
      ornamentScale: 1.2,
    },
  },
  // garm ret par heat shimmer ka khamraab
  desertmirage: {
    label: 'Desert Mirage (Heat)',
    over: {
      shimmerMode: 'heat',
      shimmerStrength: 0.75,
      particlesScale: 0.9,
      vignetteScale: 1.22,
      raysAngleDeg: 12,
      orbsOpacity: 1.05,
    },
  },
  // paani par halke lehrein - ripple displacement
  waterripple: {
    label: 'Water Ripple',
    over: {
      shimmerMode: 'ripple',
      shimmerStrength: 0.7,
      orbsOpacity: 1.25,
      particlesScale: 1.05,
      vignetteScale: 1.18,
      raysAngleDeg: -4,
    },
  },
  // resham jaisi procedural silk/marble texture, narm decor
  silkmarble: {
    label: 'Silk Marble',
    over: {
      shimmerMode: 'silk',
      shimmerStrength: 0.5,
      noiseVeilOpacity: 0.14,
      cornerSize: 66,
      cornerOpacity: 0.8,
      raysOpacity: 0.35,
      orbsOpacity: 0.75,
      particlesScale: 0.7,
      vignetteScale: 1.08,
      paperTreatment: 'cinematic',
    },
  },
  // camera DoF: gehra bokeh + lens fringe + filmi grain
  cinemafocus: {
    label: 'Cinema Focus (DoF)',
    over: {
      bokehCount: 34,
      bokehOpacity: 0.65,
      chromaticAberration: 2.0,
      vignetteScale: 1.42,
      grainOpacityDark: 0.07,
      particlesScale: 0.7,
      sweepCycleSec: 11,
      raysOpacity: 0.5,
      raysAngleDeg: -12,
    },
  },
  // multi-color intense aurora + sitaron ki barish
  auroranova: {
    label: 'Aurora Nova',
    over: {
      particleStyle: 'stars',
      particlesScale: 1.35,
      orbsOpacity: 1.5,
      raysOpacity: 0.5,
      vignetteScale: 1.2,
      sweepPhaseAlpha: 0.18,
      bokehCount: 14,
      bokehOpacity: 0.4,
    },
  },
  // masterpiece FX + Matrix3D perspective tilt
  qadrtilt: {
    label: 'Qadr 3D Tilt',
    over: {
      tilt3dDeg: 2.2,
      particlesScale: 1.4,
      orbsOpacity: 1.4,
      glossSweepCycleSec: 7.4,
      chromaticAberration: 1.4,
      vignetteScale: 1.3,
      cornerSize: 86,
      ornamentScale: 1.25,
      raysAngleDeg: 8,
    },
  },
};

export const STYLE_PRESET_IDS = Object.keys(PRESETS);

export const stylePresetLabel = (id?: string): string =>
  (PRESETS[id || 'classic'] || PRESETS.classic).label;

export const isValidPreset = (id: unknown): id is string =>
  typeof id === 'string' && Object.prototype.hasOwnProperty.call(PRESETS, id);

export const listPresets = (): Array<{id: string; label: string}> =>
  Object.keys(PRESETS).map((k) => ({id: k, label: PRESETS[k].label}));

export const resolveStyle = (id?: string | null): ResolvedStyle => ({
  ...CLASSIC,
  ...(isValidPreset(id) ? PRESETS[id].over : {}),
});
