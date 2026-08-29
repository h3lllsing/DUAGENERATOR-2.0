import React, {useMemo} from 'react';
import {
  AbsoluteFill,
  continueRender,
  delayRender,
  interpolate,
  OffthreadVideo,
  spring,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from 'remotion';
import {noise2D} from '@remotion/noise';
import type {Theme} from './themes';
import {accentTint} from './themes';
import {resolveStyle, getAurora, type AuroraConfig, type ResolvedStyle} from './stylePresets';
import {FrameDecor} from './FrameStyles';

const mulberry32 = (seed: number) => {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

interface Particle {
  x: number;
  y: number;
  size: number;
  speed: number;
  sway: number;
  phase: number;
  baseAlpha: number;
  blur: number;
}

interface ParticleLayerSpec {
  key: string;
  seed: number;
  sizeMin: number;
  sizeMax: number;
  speedMin: number;
  speedMax: number;
  swayMin: number;
  swayMax: number;
  alphaMin: number;
  alphaMax: number;
  blurMin: number;
  blurMax: number;
  parallax: number;
}

/* BATCH 2 · 3-depth atmospheric particle layers */
const PARTICLE_LAYERS: ParticleLayerSpec[] = [
  {
    key: 'fg',
    seed: 301,
    sizeMin: 5,
    sizeMax: 8,
    speedMin: 46,
    speedMax: 86,
    swayMin: 26,
    swayMax: 56,
    alphaMin: 0.45,
    alphaMax: 0.8,
    blurMin: 1.5,
    blurMax: 3,
    parallax: 1.65,
  },
  {
    key: 'mg',
    seed: 77,
    sizeMin: 2.5,
    sizeMax: 4.5,
    speedMin: 18,
    speedMax: 48,
    swayMin: 14,
    swayMax: 34,
    alphaMin: 0.35,
    alphaMax: 0.75,
    blurMin: 0,
    blurMax: 0,
    parallax: 1,
  },
  {
    key: 'bg',
    seed: 42,
    sizeMin: 1,
    sizeMax: 2,
    speedMin: 6,
    speedMax: 16,
    swayMin: 8,
    swayMax: 18,
    alphaMin: 0.15,
    alphaMax: 0.35,
    blurMin: 0,
    blurMax: 0,
    parallax: 0.35,
  },
];

const GRAIN_SIZE = 160;

/* BATCH 4 · single source of truth for moon placement (Stars + MoonHalo) */
export const MOON_ANCHOR = {
  rightPct: '12%',
  topPct: '9%',
  diameter: 110,
} as const;

/* BATCH 4 · 3-frame organic film-stock flutter (zero extra render cost:
   same grain texture, sampled through a cycling background-position offset) */
const GRAIN_FLICKER = ['0px 0px', '-59px 1px', '-123px 0px'] as const;

/* M3 · starfield DEPTH: 3 parallax planes, desynced per-star twinkle.
   Plane 0 (far, tiny/slow) -> Plane 2 (near, bigger/faster drop). Every star
   has its own speed `si` and phase `pi`, twinkle = 0.3 + 0.7*|sin(t*si+pi)|.
   Nearer stars also drift slightly faster on a slow Perlin breeze. */
const STAR_PLANES: {count: number; size: [number, number]; speed: number}[] = [
  {count: 46, size: [0.8, 1.6], speed: 0.05},
  {count: 38, size: [1.3, 2.4], speed: 0.16},
  {count: 26, size: [1.9, 3.2], speed: 0.34},
];

const StarField: React.FC = () => {
  const frame = useCurrentFrame();
  const {width, height} = useVideoConfig();
  const stars = useMemo(() => {
    const rand = mulberry32(77);
    return STAR_PLANES.map((plane) =>
      Array.from({length: plane.count}, () => ({
        x: rand() * width,
        y: rand() * height * 0.6,
        s: plane.size[0] + rand() * (plane.size[1] - plane.size[0]),
        si: 0.8 + rand() * 1.6, // per-star twinkle speed
        pi: rand() * Math.PI * 2, // per-star phase
        speed: plane.speed,
      })),
    );
  }, [width, height]);
  return (
    <>
      {stars.map((plane, pIdx) =>
        plane.map((st, i) => {
          // desynced twinkle: different star, different rhythm
          const t = frame / 24;
          const twinkle = 0.3 + 0.7 * Math.abs(Math.sin(t * st.si + st.pi));
          // slow perlin breeze drift so nearby stars feel closest
          const breeze =
            pIdx === 2
              ? noise2D('star-breeze', t * 0.02, st.x * 0.01) * 6
              : 0;
          return (
            <div
              key={`${pIdx}-${i}`}
              style={{
                position: 'absolute',
                left: st.x,
                top: st.y,
                width: st.s,
                height: st.s,
                borderRadius: '50%',
                background:
                  pIdx === 2
                    ? 'radial-gradient(circle, #ffffff 0%, #e6ecff 50%, rgba(230,236,255,0) 75%)'
                    : '#dfe8ff',
                opacity: (pIdx === 0 ? 0.32 : pIdx === 1 ? 0.5 : 0.72) * twinkle,
                transform: `translateY(${breeze.toFixed(2)}px)`,
                filter: pIdx === 2 ? `blur(${(st.s < 2 ? 0 : 0.3).toFixed(1)}px)` : undefined,
              }}
            />
          );
        }),
      )}
    </>
  );
};

/* BATCH 2 · moon stays on the MIDGROUND plane */
const Stars: React.FC<{theme: Theme}> = () => {
  const frame = useCurrentFrame();
  const t = frame / 24;
  return (
    <div
      style={{
        position: 'absolute',
        right: MOON_ANCHOR.rightPct,
        top: MOON_ANCHOR.topPct,
        width: MOON_ANCHOR.diameter,
        height: MOON_ANCHOR.diameter,
        borderRadius: '50%',
        background:
          'radial-gradient(circle at 38% 38%, #fdf6dd 0%, #e8dbA0 55%, rgba(232,219,160,0) 72%)',
        boxShadow: `0 0 ${90 + 22 * Math.sin(t * 1.1)}px ${
          28 + 8 * Math.sin(t * 1.1)
        }px rgba(240,230,180,${(0.16 + 0.05 * Math.sin(t * 1.1)).toFixed(3)})`,
      }}
    />
  );
};

const MosqueSilhouette: React.FC<{accent: string}> = () => {
  const {width} = useVideoConfig();
  const h = Math.round(width * 0.42);
  const domeW = Math.round(width * 0.34);
  const towerW = Math.round(width * 0.055);
  const col = 'rgba(3,5,14,0.82)';
  return (
    <div style={{position: 'absolute', bottom: 0, left: 0, right: 0, height: h}}>
      <div
        style={{
          position: 'absolute',
          bottom: 0,
          left: '50%',
          transform: 'translateX(-50%)',
          width: domeW,
          height: domeW * 0.62,
          background: col,
          borderRadius: `${domeW / 2}px ${domeW / 2}px 0 0`,
        }}
      />
      <div
        style={{
          position: 'absolute',
          bottom: 0,
          left: '50%',
          transform: 'translateX(-50%)',
          width: domeW * 1.5,
          height: h * 0.22,
          background: col,
        }}
      />
      {[16, 84].map((leftPct) => (
        <React.Fragment key={leftPct}>
          <div
            style={{
              position: 'absolute',
              bottom: 0,
              left: `${leftPct}%`,
              transform: 'translateX(-50%)',
              width: towerW,
              height: h * 0.86,
              background: col,
            }}
          />
          <div
            style={{
              position: 'absolute',
              bottom: h * 0.86,
              left: `${leftPct}%`,
              transform: 'translateX(-50%)',
              width: towerW * 1.7,
              height: towerW * 2.1,
              background: col,
              borderRadius: `${towerW}px ${towerW}px 0 0`,
            }}
          />
          <div
            style={{
              position: 'absolute',
              bottom: h * 0.86 + towerW * 2.1,
              left: `${leftPct}%`,
              transform: 'translateX(-50%)',
              width: 3,
              height: towerW * 1.1,
              background: col,
            }}
          />
        </React.Fragment>
      ))}
    </div>
  );
};

const SunDisc: React.FC = () => {
  const frame = useCurrentFrame();
  const zoom = interpolate(frame, [0, 600], [1, 1.06]);
  return (
    <div
      style={{
        position: 'absolute',
        left: '50%',
        top: '30%',
        transform: `translate(-50%,-50%) scale(${zoom})`,
        width: 340,
        height: 340,
        borderRadius: '50%',
        background:
          'radial-gradient(circle, rgba(255,190,110,0.5) 0%, rgba(255,150,70,0.22) 45%, rgba(255,140,60,0) 70%)',
      }}
    />
  );
};

const PatternLattice: React.FC<{accent: string}> = ({accent}) => {
  const frame = useCurrentFrame();
  const c = encodeURIComponent(accent);
  const svg = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='120' height='120' viewBox='0 0 120 120'%3E%3Cg fill='none' stroke='${c}' stroke-opacity='0.10' stroke-width='1.2'%3E%3Cpath d='M60 8 L74 46 L112 60 L74 74 L60 112 L46 74 L8 60 L46 46 Z'/%3E%3Ccircle cx='60' cy='60' r='17'/%3E%3Cpath d='M0 0 L20 20 M120 0 L100 20 M0 120 L20 100 M120 120 L100 100'/%3E%3C/g%3E%3C/svg%3E")`;
  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        backgroundImage: svg,
        backgroundSize: '120px 120px',
        // slow diagonal drift + gentle breathing so it never reads static
        backgroundPositionX: `${(frame * 0.12) % 120}px`,
        backgroundPositionY: `${(frame * 0.07) % 120}px`,
        opacity: 0.85 + 0.15 * Math.sin(frame / 100),
      }}
    />
  );
};

/* BATCH 2 · wave silhouette bands moved to the FAR depth plane */
const WaveBands: React.FC = () => {
  const frame = useCurrentFrame();
  const {width} = useVideoConfig();
  const drift = (frame * 0.6) % width;
  const {waveA, waveB} = React.useMemo(() => {
    const waveSvg = (op: number) =>
      `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='${width}' height='200' viewBox='0 0 ${width} 200'%3E%3Cpath d='M0 90 Q ${width * 0.125} 30 ${width * 0.25} 90 T ${width * 0.5} 90 T ${width * 0.75} 90 T ${width} 90 L ${width} 200 L 0 200 Z' fill='%23020810' fill-opacity='${op}'/%3E%3C/svg%3E")`;
    return {waveA: waveSvg(0.55), waveB: waveSvg(0.85)};
  }, [width]);
  return (
    <>
      <div
        style={{
          position: 'absolute',
          bottom: 40,
          left: -drift,
          right: -width + drift,
          top: undefined,
          height: 200,
          backgroundImage: waveA,
          backgroundRepeat: 'repeat-x',
        }}
      />
      <div
        style={{
          position: 'absolute',
          bottom: 0,
          left: -drift * 1.6,
          right: -width + drift * 1.6,
          height: 170,
          backgroundImage: waveB,
          backgroundRepeat: 'repeat-x',
        }}
      />
    </>
  );
};

/* BATCH 2 · crescent stays on the MIDGROUND plane */
const WaveCrescent: React.FC<{accent: string}> = ({accent}) => {
  return (
    <div
      style={{
        position: 'absolute',
        left: '50%',
        top: '12%',
        transform: 'translateX(-50%)',
        width: 0,
        height: 0,
      }}
    >
      <div
        style={{
          position: 'absolute',
          right: -55,
          top: -55,
          width: 110,
          height: 110,
          borderRadius: '50%',
          boxShadow: `inset -22px 8px 0 2px ${accent}`,
          opacity: 0.75,
          filter: 'drop-shadow(0 0 26px rgba(140,215,255,0.35))',
        }}
      />
    </div>
  );
};

const Dunes: React.FC = () => {
  const {width} = useVideoConfig();
  const h = Math.round(width * 0.3);
  return (
    <div style={{position: 'absolute', bottom: 0, left: 0, right: 0, height: h}}>
      <div
        style={{
          position: 'absolute',
          bottom: -h * 0.45,
          left: '-18%',
          width: '80%',
          height: h,
          background: 'rgba(28,16,4,0.75)',
          borderRadius: '50%',
        }}
      />
      <div
        style={{
          position: 'absolute',
          bottom: -h * 0.5,
          right: '-22%',
          width: '95%',
          height: h * 0.95,
          background: 'rgba(16,9,2,0.9)',
          borderRadius: '50%',
        }}
      />
    </div>
  );
};

const RoyalOrnament: React.FC<{accent: string}> = ({accent}) => {
  const frame = useCurrentFrame();
  const c = encodeURIComponent(accent);
  const svg = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160' viewBox='0 0 160 160'%3E%3Cg fill='none' stroke='${c}' stroke-opacity='0.13' stroke-width='1.2'%3E%3Cpath d='M80 4 L96 64 L156 80 L96 96 L80 156 L64 96 L4 80 L64 64 Z'/%3E%3Ccircle cx='80' cy='80' r='24'/%3E%3Ccircle cx='80' cy='80' r='44'/%3E%3Cpath d='M80 36 L80 124 M36 80 L124 80'/%3E%3C/g%3E%3C/svg%3E")`;
  return (
    <>
      <div
        style={{
          position: 'absolute',
          inset: 0,
          backgroundImage: svg,
          backgroundSize: '160px 160px',
          backgroundPositionX: `${(frame * 0.1) % 160}px`,
          opacity: 0.85 + 0.15 * Math.sin(frame / 110),
        }}
      />
      <div
        style={{
          position: 'absolute',
          left: '50%',
          top: '48%',
          transform: `translate(-50%,-50%) rotate(${frame * 0.06}deg)`,
          width: 520,
          height: 520,
          borderRadius: '50%',
          border: `1.5px solid ${accent}`,
          opacity: 0.14,
        }}
      />
      <div
        style={{
          position: 'absolute',
          left: '50%',
          top: '48%',
          transform: `translate(-50%,-50%) rotate(${45 - frame * 0.045}deg)`,
          width: 480,
          height: 480,
          border: `1.5px solid ${accent}`,
          opacity: 0.1,
        }}
      />
    </>
  );
};

// BATCH 1: metallic gold palette — shadow -> warm base -> specular -> deep edge
const GOLD_SHADOW = '#5d4510';
const GOLD_BASE = '#dcb93f';
const GOLD_SPEC = '#fff6d4';
const GOLD_DEEP = '#7c5c18';

// M4 · sine-eased 17-stop metallic gold gradient (no banding). Backbone of
// the premium shimmer — extra stops give a buttery light-sheen instead of
// a flat 6-band loop. backgroundSize 200% + eased position slide.
const metallicGoldStops = (): string => {
  const c = (hex: string) => {
    const h = hex.replace('#', '');
    return `${parseInt(h.slice(0, 2), 16)},${parseInt(h.slice(2, 4), 16)},${parseInt(h.slice(4, 6), 16)}`;
  };
  // dark -> base -> highlight -> base -> deep, wrapped as smooth sine
  const dark = c(GOLD_SHADOW);
  const base = c(GOLD_BASE);
  const hi = c(GOLD_SPEC);
  const mid = c('#ffe08a');
  const deep = c(GOLD_DEEP);
  const stops: string[] = [];
  const ramp = [dark, base, hi, mid, base, deep, dark];
  for (let i = 0; i < 17; i++) {
    // sine-smoothed interpolation across the ramp so consecutive stops
    // never jump — zero banding.
    const t = i / 16;
    const f = Math.sin(Math.PI * t);
    const idx = Math.round(f * (ramp.length - 1));
    stops.push(`rgba(${ramp[idx]},1) ${((i / 16) * 100).toFixed(1)}%`);
  }
  return stops.join(', ');
};

// 3.5s parametric specular sweep; eased in/out so the sheen accelerates
// and decelerates like a light gliding across metal (not a teleport loop).
const goldGrad = (
  frame: number,
  fps: number,
  phaseOffset = 0,
): React.CSSProperties => {
  const cycle = (frame / (fps * 4.0) + phaseOffset) % 1;
  const eased =
    cycle < 0.5
      ? 2 * cycle * cycle
      : 1 - Math.pow(-2 * cycle + 2, 2) / 2;
  return {
    backgroundImage: `linear-gradient(115deg, ${metallicGoldStops()})`,
    backgroundSize: '200% 100%',
    backgroundPositionX: `${(eased * 100).toFixed(2)}%`,
  };
};

const CornerOrnaments: React.FC<{
  accent: string;
  light: boolean;
  inset?: number;
  size?: number;
  opacityMult?: number;
}> = ({accent, light, inset = 30, size = 74, opacityMult = 1}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const col = light ? 'rgba(122,92,34,0.65)' : accent;
  const s = size;
  // BATCH 1 cascade: TL(0ms) -> TR(120ms) -> BR(240ms) -> BL(360ms)
  // array order [TL, TR, BL, BR] hai isliye delays us hisaab se aligned
  const DELAY_MS = [0, 120, 360, 240];
  // har corner ka spring lock-in + decaying micro-wobble
  const cornerAnim = (i: number) => {
    const startF = 6 + (DELAY_MS[i] / 1000) * fps;
    const f = Math.max(0, frame - startF);
    const scale = spring({
      frame: f,
      fps,
      config: {damping: 12, stiffness: 150},
    });
    const wobble =
      f > 0 ? Math.sin(f / 2.5) * 2.2 * Math.exp(-f / (fps * 0.7)) : 0;
    return {
      scale,
      wobble,
      visible: f > 0,
    };
  };
  const breathe = 0.82 + 0.18 * Math.sin(frame / 48);
  return (
    <>
      {[
        // har corner ki lines USI corner se andar ki taraf — mirrored
        {top: inset, left: inset, origin: 'top left',
          h: {top: 0, left: 0}, v: {top: 0, left: 0}},
        {top: inset, right: inset, origin: 'top right',
          h: {top: 0, right: 0}, v: {top: 0, right: 0}},
        {bottom: inset, left: inset, origin: 'bottom left',
          h: {bottom: 0, left: 0}, v: {bottom: 0, left: 0}},
        {bottom: inset, right: inset, origin: 'bottom right',
          h: {bottom: 0, right: 0}, v: {bottom: 0, right: 0}},
      ].map((pos, i) => {
        const anim = cornerAnim(i);
        const fadeIn = interpolate(
          frame,
          [6 + (DELAY_MS[i] / 1000) * fps,
            11 + (DELAY_MS[i] / 1000) * fps],
          [0, 1],
          {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'},
        );
        return (
          <div
            key={i}
            style={{
              position: 'absolute',
              width: s,
              height: s,
              top: pos.top,
              bottom: pos.bottom,
              left: pos.left,
              right: pos.right,
              transformOrigin: pos.origin,
              opacity: (light ? 1 : 0.55) *
                opacityMult * breathe * fadeIn,
              transform:
                `scale(${Math.max(0, anim.scale)}) rotate(${anim.wobble}deg)`,
              visibility: anim.visible ? 'visible' : 'hidden',
            }}
          >
            <div
              style={{
                position: 'absolute',
                width: s,
                height: 2,
                ...(light ? {background: col} : goldGrad(frame, fps, i * 0.22)),
                ...pos.h,
              }}
            />
            <div
              style={{
                position: 'absolute',
                width: 2,
                height: s,
                ...(light ? {background: col} : goldGrad(frame, fps, i * 0.22 + 0.5)),
                ...pos.v,
              }}
            />
            <div
              style={{
                position: 'absolute',
                width: 9,
                height: 9,
                ...(light ? {background: col} : goldGrad(frame, fps, i * 0.37)),
                transform: `rotate(${45 + Math.sin(frame / 40 + i * 1.57) * 10}deg)`,
                left: s / 2 - 4.5,
                top: s / 2 - 4.5,
              }}
            />
            <div
              style={{
                position: 'absolute',
                width: 6,
                height: 6,
                left: s / 2 - 3,
                top: s / 2 - 3,
                background:
                  'radial-gradient(circle, ' +
                  'rgba(255,255,240,0.95) 0%, rgba(255,240,200,0.5) 45%, ' +
                  'rgba(212,175,55,0) 72%)',
                transform: `scale(${0.6 + 0.4 * Math.abs(Math.sin(frame / 34 + i * 1.9))})`,
                filter: 'blur(0.4px)',
              }}
            />
          </div>
        );
      })}
    </>
  );
};

const Lanterns: React.FC<{accent: string}> = ({accent}) => {
  const frame = useCurrentFrame();
  const {width} = useVideoConfig();
  const lanterns = useMemo(() => {
    const rand = mulberry32(99);
    return Array.from({length: 6}, (_, i) => ({
      x: (8 + i * 16.5 + rand() * 5) * width / 100,
      drop: 90 + rand() * 240,
      h: 92 + rand() * 46,
      w: 54 + rand() * 22,
      phase: rand() * Math.PI * 2,
      speed: 0.45 + rand() * 0.35,
    }));
  }, [width]);
  return (
    <>
      <div
        style={{
          position: 'absolute',
          left: '14%',
          top: '7%',
          width: 130,
          height: 130,
          borderRadius: '50%',
          background:
            'radial-gradient(circle at 34% 34%, #fdf3cf 0%, #ecd9a4 52%, rgba(236,217,164,0) 74%)',
          boxShadow: '0 0 110px 36px rgba(250,225,160,0.20)',
          clipPath:
            'polygon(100% 0, 100% 62%, 38% 78%, 38% 100%, 30% 100%, 30% 80%, 0 66%, 12% 58%)',
        }}
      />
      {lanterns.map((l, i) => {
        const sway = Math.sin(frame / 42 * l.speed + l.phase) * 4.5;
        return (
          <div
            key={i}
            style={{
              position: 'absolute',
              left: l.x,
              top: -10,
              transformOrigin: 'top center',
              transform: `rotate(${sway}deg)`,
            }}
          >
            <div
              style={{
                width: 2,
                height: l.drop,
                margin: '0 auto',
                background: `linear-gradient(180deg, rgba(255,200,120,0.06), ${accent}55)`,
              }}
            />
            <div
              style={{
                width: l.w,
                height: l.h,
                margin: '0 auto',
                borderRadius: `${l.w / 2.6}px ${l.w / 2.6}px ${l.w / 3.4}px ${l.w / 3.4}px`,
                background: `radial-gradient(ellipse at 50% 42%, rgba(255,214,140,0.95) 0%, rgba(240,150,50,0.75) 55%, rgba(120,60,15,0.9) 100%)`,
                boxShadow: '0 0 60px 18px rgba(255,170,60,0.28)',
                border: '2px solid rgba(255,205,125,0.5)',
              }}
            >
              <div
                style={{
                  width: l.w * 0.42,
                  height: 7,
                  margin: '-2px auto 0',
                  borderRadius: 3,
                  background: accent,
                  opacity: 0.85,
                }}
              />
              <div
                style={{
                  width: l.w * 0.5,
                  height: 8,
                  margin: '2px auto 0',
                  borderRadius: '0 0 6px 6px',
                  background: accent,
                  opacity: 0.7,
                }}
              />
            </div>
          </div>
        );
      })}
    </>
  );
};

const FestiveOrnament: React.FC<{accent: string}> = ({accent}) => {
  const frame = useCurrentFrame();
  const {width} = useVideoConfig();
  const flags = useMemo(() => {
    const rand = mulberry32(123);
    return Array.from({length: 14}, (_, i) => ({
      x: (3 + i * 7) * width / 100,
      s: 26 + rand() * 14,
      phase: rand() * Math.PI * 2,
    }));
  }, [width]);
  const twinkle = 0.55 + 0.45 * Math.sin(frame / 19);
  return (
    <>
      <svg
        style={{position: 'absolute', top: 0, left: 0}}
        width={width}
        height={150}
      >
        <path
          d={`M-20 40 Q ${width * 0.25} 96 ${width * 0.5} 64 T ${width + 20} 44`}
          fill="none"
          stroke={accent}
          strokeOpacity={0.55}
          strokeWidth={2.5}
        />
        {flags.map((f, i) => {
          const y =
            40 +
            Math.sin((i / 13) * Math.PI) * 24 +
            Math.sin(frame / 30 + f.phase) * 2;
          return (
            <g key={i}>
              <rect
                x={f.x}
                y={y}
                width={f.s}
                height={f.s}
                rx={4}
                transform={`rotate(45 ${f.x + f.s / 2} ${y + f.s / 2})`}
                fill={i % 2 ? accent : '#0d3320'}
                stroke={accent}
                strokeOpacity={0.8}
                strokeWidth={1.6}
                opacity={0.9}
              />
            </g>
          );
        })}
      </svg>
      {[{r: '6%', b: '8%'}, {r: '6%', b: '', l: '6%'}, {l: '6%', b: '8%'}].map(
        (pos, i) => (
          <div
            key={i}
            style={{
              position: 'absolute',
              right: pos.r || undefined,
              left: pos.l || undefined,
              bottom: pos.b || undefined,
              width: 120,
              height: 120,
              opacity: 0.5 * twinkle + 0.25,
              background: `radial-gradient(circle at 70% 70%, ${accent}44 0%, transparent 62%)`,
            }}
          />
        ),
      )}
    </>
  );
};

const QadrSky: React.FC<{theme: Theme}> = ({theme}) => {
  const frame = useCurrentFrame();
  const {width, height, durationInFrames} = useVideoConfig();
  const stars = useMemo(() => {
    const rand = mulberry32(4242);
    return Array.from({length: 130}, () => ({
      x: rand() * width,
      y: rand() * height * 0.72,
      s: 0.8 + rand() * 2.4,
      p: rand() * Math.PI * 2,
    }));
  }, [width, height]);
  const descend = interpolate(frame, [0, durationInFrames], [0, 1]);
  return (
    <>
      {stars.map((st, i) => (
        <div
          key={i}
          style={{
            position: 'absolute',
            left: st.x,
            top: st.y,
            width: st.s,
            height: st.s,
            borderRadius: '50%',
            background: '#e8eeff',
            opacity: 0.2 + 0.55 * Math.abs(Math.sin(frame / 21 + st.p)),
          }}
        />
      ))}
      <div
        style={{
          position: 'absolute',
          left: '50%',
          top: '-6%',
          transform: 'translateX(-50%)',
          width: 720,
          height: height * 1.05,
          background: `linear-gradient(180deg, ${theme.glowColor} 0%, rgba(190,210,255,0.05) 46%, transparent 74%)`,
          clipPath: 'polygon(38% 0, 62% 0, 88% 100%, 12% 100%)',
          opacity: 0.65 + 0.35 * descend,
          pointerEvents: 'none',
        }}
      />
      <div
        style={{
          position: 'absolute',
          left: '50%',
          bottom: '4%',
          transform: 'translateX(-50%)',
          width: 420,
          height: 130,
          borderRadius: '50%',
          background:
            'radial-gradient(ellipse, rgba(200,215,255,0.16) 0%, transparent 68%)',
        }}
      />
    </>
  );
};

// AURORA: bare rangin glows jo frame me dheere-dheere tairte hain
// (preset ki asli pehchan — har mood ka apna palette, screen blend)
const AuroraGlows: React.FC<{cfg: AuroraConfig}> = ({cfg}) => {  const frame = useCurrentFrame();
  const {width, height} = useVideoConfig();
  const breathe =
    0.82 + 0.18 * Math.sin((frame / cfg.breathePeriod) * Math.PI * 2);
  return (
    <>
      {cfg.blobs.map((b, i) => {
        const nx = noise2D('aur-x' + i, frame * b.speed, i * 7.7);
        const ny = noise2D('aur-y' + i, frame * b.speed, i * 3.3);
        // anchors frame me phaile hue (blob overlap kare to depth banta hai)
        const ax = width * (0.28 + 0.44 * ((i * 0.37 + 0.2) % 1));
        const ay = height * (0.24 + 0.52 * ((i * 0.61 + 0.15) % 1));
        const x = ax + nx * width * b.drift;
        const y = ay + ny * height * b.drift;
        const c = `${b.r},${b.g},${b.b}`;
        return (
          <div
            key={i}
            style={{
              position: 'absolute',
              left: x - b.size / 2,
              top: y - b.size / 2,
              width: b.size,
              height: b.size,
              borderRadius: '50%',
              background:
                `radial-gradient(circle, rgba(${c},${b.a}) 0%, ` +
                `rgba(${c},${(b.a * 0.45).toFixed(3)}) 45%, transparent 70%)`,
              mixBlendMode: 'screen',
              opacity: breathe,
              pointerEvents: 'none',
            }}
          />
        );
      })}
    </>
  );
};

// MASTERPIECE EXTRA 1: shooting stars — deterministic meteor streaks
const ShootingStars: React.FC = () => {
  const frame = useCurrentFrame();
  const {width, height, durationInFrames} = useVideoConfig();
  // BATCH 4 · spawn schedule scales with clip length so 15s and 45s
  // videos both get naturally spaced meteors (no hardcoded frame triggers).
  const meteors = useMemo(() => {
    const D = durationInFrames;
    const rand = mulberry32(20260);
    return [
      {x0: 0.72, y0: 0.10, len: 34},
      {x0: 0.18, y0: 0.06, len: 38},
      {x0: 0.55, y0: 0.16, len: 36},
    ].map((m, i) => {
      // even anchors across the timeline (+-5% jitter) -> natural spacing
      const frac = Math.min(
        Math.max((i + 0.5) / 3 + (rand() - 0.5) * 0.1, 0.04),
        0.86,
      );
      return {
        ...m,
        start: Math.max(
          24,
          Math.min(Math.round(D * frac), D - m.len - 12),
        ),
      };
    });
  }, [durationInFrames]);
  return (
    <>
      {meteors.map((m, i) => {
        const f = frame - m.start;
        if (f < 0 || f > m.len) return null;
        const p = f / m.len;
        const alpha = Math.sin(p * Math.PI);
        const dx = width * 0.22;
        const dy = height * 0.09;
        return (
          <div
            key={i}
            style={{
              position: 'absolute',
              left: width * m.x0 + dx * p,
              top: height * m.y0 + dy * p,
              width: 150,
              height: 2.5,
              borderRadius: 2,
              transform: `rotate(${(Math.atan2(dy, dx) * 180) / Math.PI}deg)`,
              background:
                `linear-gradient(90deg, rgba(255,248,225,${alpha}) 0%, ` +
                `rgba(255,236,190,${alpha * 0.5}) 40%, transparent 100%)`,
              boxShadow: `0 0 9px rgba(255,240,200,${alpha * 0.85})`,
              pointerEvents: 'none',
            }}
          />
        );
      })}
    </>
  );
};

// MASTERPIECE EXTRA 2: moon ke gird breathing halo rings
const MoonHalo: React.FC<{accent: string}> = ({accent}) => {
  const frame = useCurrentFrame();
  const r1 = 74 + Math.sin(frame / 90) * 7;
  const r2 = 104 + Math.sin(frame / 120 + 2.1) * 10;
  const a1 = 0.28 + 0.14 * Math.sin(frame / 90);
  const a2 = 0.17 + 0.11 * Math.sin(frame / 120 + 2.1);
  const ring = (size: number, a: number): React.CSSProperties => ({
    position: 'absolute',
    right: MOON_ANCHOR.rightPct,
    top: MOON_ANCHOR.topPct,
    width: size,
    height: size,
    marginRight: -(size - MOON_ANCHOR.diameter) / 2,
    marginTop: -(size - MOON_ANCHOR.diameter) / 2,
    borderRadius: '50%',
    border: `1.5px solid ${accent}`,
    opacity: a,
    pointerEvents: 'none',
  });
  return (
    <>
      <div style={ring(r1 * 2, a1)} />
      <div style={ring(r2 * 2, a2)} />
    </>
  );
};

// MASTERPIECE EXTRA 3: golden motes jo UPAR ki taraf tairte hain
const RisingMotes: React.FC<{color: string}> = ({color}) => {
  const frame = useCurrentFrame();
  const {width, height} = useVideoConfig();
  const t = frame / 24;
  const motes = useMemo(() => {
    const rand = mulberry32(777);
    return Array.from({length: 15}, () => ({
      x: rand(),
      y0: rand(),
      speed: 0.008 + rand() * 0.02,
      size: 5 + rand() * 12,
      blur: 1 + rand() * 2,
      phase: rand() * Math.PI * 2,
      alpha: 0.25 + rand() * 0.45,
      sway: 20 + rand() * 46,
    }));
  }, []);
  return (
    <>
      {motes.map((m, i) => {
        const y = (((m.y0 - t * m.speed) % 1) + 1) % 1;
        const nx = noise2D('mote-x', t * 0.1 + m.phase, i * 4.4);
        const x = m.x * width + nx * m.sway;
        const twinkle = m.alpha * (0.6 + 0.4 * Math.sin(t * 1.5 + m.phase));
        return (
          <div
            key={i}
            style={{
              position: 'absolute',
              left: x,
              top: y * height,
              width: m.size,
              height: m.size,
              borderRadius: '50%',
              background: color,
              filter: `blur(${m.blur}px)`,
              opacity: twinkle,
              boxShadow: `0 0 ${m.size * 1.6}px ${color}`,
              pointerEvents: 'none',
            }}
          />
        );
      })}
    </>
  );
};

const GodRays: React.FC<{
  theme: Theme;
  opacity?: number;
  angleDeg?: number;
}> = ({
  theme,
  opacity = 0.55,
  angleDeg = 0,
}) => {
  const frame = useCurrentFrame();
  const sway = Math.sin(frame / 140) * 3;
  return (
    <div
      style={{
        position: 'absolute',
        top: '-12%',
        left: '50%',
        width: 1600,
        height: 1100,
        marginLeft: -800,
        background: `repeating-conic-gradient(from -42deg at 50% 0%, ${theme.glowColor} 0deg 3deg, transparent 3deg 21deg)`,
        transform: `rotate(${sway + angleDeg}deg)`,
        opacity,
        maskImage:
          'radial-gradient(ellipse 52% 50% at 50% 0%, black 0%, transparent 68%)',
        WebkitMaskImage:
          'radial-gradient(ellipse 52% 50% at 50% 0%, black 0%, transparent 68%)',
        pointerEvents: 'none',
      }}
    />
  );
};

// ambient depth: two large soft glow orbs drifting on Perlin noise
const AmbientOrbs: React.FC<{theme: Theme; opacityMult?: number}> = ({
  theme,
  opacityMult = 1,
}) => {  const frame = useCurrentFrame();
  const {width, height} = useVideoConfig();
  const o1x = width * 0.24 + noise2D('orb1-x', frame * 0.005, 3.1) * width * 0.05;
  const o1y = height * 0.66 + noise2D('orb1-y', frame * 0.005, 8.7) * height * 0.04;
  const o2x = width * 0.78 + noise2D('orb2-x', frame * 0.004, 15.2) * width * 0.06;
  const o2y = height * 0.28 + noise2D('orb2-y', frame * 0.004, 21.9) * height * 0.05;
  const breathe = 0.75 + 0.25 * Math.sin(frame / 96);
  return (
    <>
      <div
        style={{
          position: 'absolute',
          left: o1x - 260,
          top: o1y - 260,
          width: 520,
          height: 520,
          borderRadius: '50%',
          background: `radial-gradient(circle, ${theme.accent}22 0%, transparent 65%)`,
          mixBlendMode: 'screen',
          opacity: 0.55 * breathe * opacityMult,
          pointerEvents: 'none',
        }}
      />
      <div
        style={{
          position: 'absolute',
          left: o2x - 190,
          top: o2y - 190,
          width: 380,
          height: 380,
          borderRadius: '50%',
          background: `radial-gradient(circle, ${theme.accent}18 0%, transparent 60%)`,
          mixBlendMode: 'screen',
          opacity: 0.45 * (1.25 - breathe * 0.5) * opacityMult,
          pointerEvents: 'none',
        }}
      />
    </>
  );
};

/* BATCH 2 · front atmospheric glows on the FOREGROUND plane */
/* BATCH 3 · ROYAL paper: double-gold filigree frame + ink contrast boost */
const PaperFiligree: React.FC<{accent: string}> = ({accent}) => {
  const frame = useCurrentFrame();
  const shimmer = 0.85 + 0.15 * Math.sin(frame / 95);
  return (
    <>
      <div
        style={{
          position: 'absolute',
          inset: 28,
          border: '2px solid rgba(150,112,38,0.72)',
          borderRadius: 6,
          boxShadow: 'inset 0 0 26px rgba(96,66,24,0.18)',
          opacity: shimmer,
        }}
      />
      <div
        style={{
          position: 'absolute',
          inset: 40,
          border: `1px solid ${accent}66`,
          borderRadius: 4,
        }}
      />
      {[
        {top: 23, left: 23},
        {top: 23, right: 23},
        {bottom: 23, left: 23},
        {bottom: 23, right: 23},
      ].map((pos, i) => (
        <div
          key={i}
          style={{
            position: 'absolute',
            width: 9,
            height: 9,
            transform: 'rotate(45deg)',
            background: `linear-gradient(135deg, #e8c76a, ${accent})`,
            boxShadow: '0 0 6px rgba(212,175,55,0.55)',
            ...pos,
          }}
        />
      ))}
      {/* rich ink contrast boost */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background:
            'radial-gradient(ellipse 90% 90% at 50% 50%, transparent 58%, rgba(62,42,12,0.13) 100%)',
        }}
      />
    </>
  );
};

/* BATCH 3 · CINEMATIC paper: warm parchment aging + directional ink-bleed */
const ParchmentAging: React.FC = () => {
  const frame = useCurrentFrame();
  const breathe = 0.9 + 0.1 * Math.sin(frame / 170);
  return (
    <>
      <div
        style={{
          position: 'absolute',
          inset: 0,
          opacity: breathe,
          background: [
            'radial-gradient(circle 300px at 6% 8%, rgba(124,88,34,0.16), transparent 70%)',
            'radial-gradient(circle 360px at 96% 12%, rgba(124,88,34,0.12), transparent 72%)',
            'radial-gradient(circle 340px at 92% 94%, rgba(110,78,30,0.15), transparent 70%)',
            'radial-gradient(circle 260px at 4% 90%, rgba(124,88,34,0.11), transparent 68%)',
          ].join(', '),
        }}
      />
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background:
            'linear-gradient(90deg, rgba(70,50,20,0.10), transparent 16%)',
        }}
      />
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background:
            'linear-gradient(0deg, rgba(70,50,20,0.08), transparent 12%)',
        }}
      />
    </>
  );
};

const ForegroundHaze: React.FC<{theme: Theme}> = ({theme}) => {
  const frame = useCurrentFrame();
  const breathe = 0.85 + 0.15 * Math.sin(frame / 140);
  return (
    <>
      <div
        style={{
          position: 'absolute',
          left: '-16%',
          bottom: '-22%',
          width: '66%',
          height: '60%',
          borderRadius: '50%',
          background: `radial-gradient(circle, ${theme.accent}, transparent 68%)`,
          opacity: 0.07 * breathe,
          mixBlendMode: 'screen',
          filter: 'blur(10px)',
        }}
      />
      <div
        style={{
          position: 'absolute',
          right: '-14%',
          top: '6%',
          width: '52%',
          height: '48%',
          borderRadius: '50%',
          background: `radial-gradient(circle, ${theme.accent}, transparent 70%)`,
          opacity: 0.05 * breathe,
          mixBlendMode: 'screen',
          filter: 'blur(12px)',
        }}
      />
    </>
  );
};

/* ===== CGI/VFX BATCH-2 components (2026-08-23) ===== */

// DoF Bokeh: peeche tairte soft glowing dots - camera lens blur feel
const BokehLayer: React.FC<{
  count: number;
  opacity: number;
  accent: string;
}> = ({count, opacity, accent}) => {
  const frame = useCurrentFrame();
  const {width, height} = useVideoConfig();
  const dots = useMemo(() => {
    const r = mulberry32(9021);
    return Array.from({length: count}, () => ({
      x: r() * width,
      y: r() * height,
      s: 18 + r() * 46,
      sp: 0.25 + r() * 0.7,
      ph: r() * Math.PI * 2,
      bl: 6 + r() * 16,
      warm: r(),
    }));
  }, [count, width, height]);
  return (
    <>
      {dots.map((d, i) => {
        const y = (((d.y - frame * 0.55 * d.sp) % height) + height) % height;
        const x = d.x + noise2D('bok' + i, frame * 0.006, d.ph) * 40;
        const a = opacity * (0.35 + 0.4 * Math.sin(frame / 48 + d.ph));
        return (
          <div
            key={i}
            style={{
              position: 'absolute',
              left: x,
              top: y,
              width: d.s,
              height: d.s,
              borderRadius: '50%',
              background: `radial-gradient(circle, ${
                d.warm > 0.5 ? '#ffe9b8cc' : accent + 'bb'
              } 0%, transparent 70%)`,
              filter: `blur(${d.bl.toFixed(1)}px)`,
              mixBlendMode: 'screen',
              opacity: Math.max(0, a),
              pointerEvents: 'none',
            }}
          />
        );
      })}
    </>
  );
};

// Specular sweep: metal par chalti tez golden sheen ki patti
const GlossSweep: React.FC<{cycleSec: number}> = ({cycleSec}) => {
  const {width, fps} = useVideoConfig();
  const f = useCurrentFrame();
  const cyc = Math.max(2, cycleSec) * fps;
  const p = (f % cyc) / cyc;
  // ease-in-out: behtar physics feel
  const eased = p < 0.5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2;
  const x = -0.35 * width + eased * 1.7 * width;
  return (
    <div
      style={{
        position: 'absolute',
        inset: '-20%',
        pointerEvents: 'none',
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          position: 'absolute',
          top: '-30%',
          left: x,
          width: Math.round(width * 0.16),
          height: '160%',
          transform: 'rotate(-24deg)',
          background:
            'linear-gradient(90deg, transparent, rgba(255,240,200,0.14) 45%, rgba(255,250,230,0.30) 50%, rgba(255,240,200,0.14) 55%, transparent)',
          mixBlendMode: 'screen',
          filter: 'blur(2px)',
        }}
      />
    </div>
  );
};

// Chromatic aberration: lens ke kinaron par RGB split fringe
const ChromaticEdges: React.FC<{strength: number}> = ({strength}) => (
  <>
    <div
      style={{
        position: 'absolute',
        inset: 0,
        pointerEvents: 'none',
        mixBlendMode: 'screen',
        opacity: 0.45,
        background:
          'radial-gradient(ellipse 80% 80% at 47% 50%, transparent 60%, rgba(255,70,70,0.17) 88%, transparent 100%)',
        transform: `translateX(${-strength}px)`,
      }}
    />
    <div
      style={{
        position: 'absolute',
        inset: 0,
        pointerEvents: 'none',
        mixBlendMode: 'screen',
        opacity: 0.45,
        background:
          'radial-gradient(ellipse 80% 80% at 53% 50%, transparent 60%, rgba(70,180,255,0.15) 88%, transparent 100%)',
        transform: `translateX(${strength}px)`,
      }}
    />
  </>
);

// Displacement shimmer: garmi ki lehrein / paani ki lahrein / resham
// SVG feTurbulence+feDisplacementMap - Remotion har frame fresh render
// karta hai is liye baseFrequency/seed ko frame se animate karte hain.
const ShimmerVeil: React.FC<{mode: string; strength: number}> = ({
  mode,
  strength,
}) => {
  const frame = useCurrentFrame();
  const scale =
    mode === 'heat'
      ? 26 * strength
      : mode === 'ripple'
        ? 34 * strength
        : 14 * strength;
  const bfX = mode === 'heat' ? 0.012 : mode === 'ripple' ? 0.006 : 0.004;
  const bfYBase = mode === 'heat' ? 0.09 : mode === 'ripple' ? 0.02 : 0.012;
  const bfY = bfYBase * (1 + 0.18 * Math.sin(frame / 17));
  const seed = 7 + (frame % 5);
  const bgPattern =
    mode === 'heat'
      ? 'repeating-linear-gradient(180deg, rgba(255,255,255,0.10) 0 6px, rgba(255,255,255,0.02) 6px 22px)'
      : mode === 'ripple'
        ? 'repeating-radial-gradient(circle at 50% 62%, rgba(255,255,255,0.10) 0 10px, rgba(255,255,255,0.02) 10px 30px)'
        : 'repeating-linear-gradient(115deg, rgba(255,255,255,0.08) 0 5px, rgba(255,255,255,0.015) 5px 18px)';
  return (
    <>
      <svg width="0" height="0" style={{position: 'absolute'}}>
        <filter
          id="duaShimmerFx"
          x="-20%"
          y="-20%"
          width="140%"
          height="140%"
        >
          <feTurbulence
            type="fractalNoise"
            baseFrequency={`${bfX} ${bfY.toFixed(4)}`}
            numOctaves={2}
            seed={seed}
          />
          <feDisplacementMap in="SourceGraphic" scale={scale} />
        </filter>
      </svg>
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: bgPattern,
          filter: 'url(#duaShimmerFx)',
          opacity: 0.5,
          mixBlendMode: 'overlay',
          pointerEvents: 'none',
        }}
      />
    </>
  );
};

// Procedural Perlin-noise veil (feTurbulence texture, soft-light)
const NoiseVeil: React.FC<{opacity: number}> = ({opacity}) => {
  const frame = useCurrentFrame();
  const s = 100 + (frame % 40);
  const url = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='300' height='300'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' seed='${s}'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`;
  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        backgroundImage: url,
        opacity,
        mixBlendMode: 'soft-light',
        pointerEvents: 'none',
      }}
    />
  );
};

export const Background: React.FC<{
  theme: Theme;
  stylePreset?: ResolvedStyle;
  presetId?: string;
  masterpiece?: boolean;
  punchFrames?: number[];
  lookFrame?: string | null;
  // Dua-specific background photo/video (relative to public/), e.g.
  // "backgrounds/prayer_29832018.jpg" — set by make_manifest.
  bgOverride?: string | null;
  bgKind?: 'image' | 'video';
}> = ({theme, stylePreset, presetId, masterpiece, punchFrames, lookFrame, bgOverride, bgKind}) => {
  const S: ResolvedStyle = stylePreset || resolveStyle();
  const aurora: AuroraConfig = getAurora(presetId);
  // MASTER LOOK v2: non-classic frame variant => purana hairline+corner band
  // ho jata hai, FrameStyles ka naya design render hota hai.
  const lookFrameActive = !!lookFrame && lookFrame !== 'classic';
  const frame = useCurrentFrame();
  const {width, height, durationInFrames, fps} = useVideoConfig();
  const t = frame / 24;

  // Photo/video background — dua-specific first (staticFile(public/)),
  // else theme-based (public/backgrounds/<theme>.jpg). If bgKind is 'video'
  // it renders an <OffthreadVideo>; otherwise the existing image layer.
  const [bgImage, setBgImage] = React.useState<string | null>(null);
  React.useEffect(() => {
    const handle = delayRender('bg-img-' + theme.id);
    const url = bgOverride ? staticFile(bgOverride) : staticFile(`backgrounds/${theme.id}.jpg`);
    fetch(url, {method: 'HEAD'})
      .then((r) => {
        setBgImage(r.ok ? url : null);
        continueRender(handle);
      })
      .catch(() => continueRender(handle));
  }, [theme.id, bgOverride]);

  const zoom = interpolate(frame, [0, durationInFrames], [1.0, 1.055]);
  // organic camera drift (Perlin noise wander, smooth -1..1)
  const driftX = noise2D('cam-x', frame * 0.008, 11.3) * 18;
  const driftY = noise2D('cam-y', frame * 0.008, 47.7) * 14;

  /* BATCH 2 · multi-plane parallax: rig carries MID at 1.0x, so relative
     offsets give FAR a net 0.35x and FOREGROUND a net 1.65x drift */
  const farPX = -driftX * 0.65;
  const farPY = -driftY * 0.65;
  const fgPX = driftX * 0.65;
  const fgPY = driftY * 0.65;
  const borderPX = driftX * 1.65;
  const borderPY = driftY * 1.65;

  /* BATCH 3 · choreographed phase punches: 18-frame bell 1.0 -> 1.035 -> 1.0 */
  const PUNCH_LEN = 18;
  let punchAmt = 0;
  for (const pf of punchFrames ?? []) {
    const p = (frame - (pf - PUNCH_LEN / 2)) / PUNCH_LEN;
    if (p > 0 && p < 1) punchAmt += Math.sin(Math.PI * p);
  }

  /* BATCH 2 · organic atmosphere: fg bokeh / mg sharp / bg dust */
  const totalCount = Math.round(theme.particleCount * S.particlesScale);
  const makeLayer = (spec: ParticleLayerSpec, count: number): Particle[] => {
    const rand = mulberry32(spec.seed);
    return Array.from({length: count}, () => ({
      x: rand() * width,
      y: rand() * height,
      size: spec.sizeMin + rand() * (spec.sizeMax - spec.sizeMin),
      speed: spec.speedMin + rand() * (spec.speedMax - spec.speedMin),
      sway: spec.swayMin + rand() * (spec.swayMax - spec.swayMin),
      phase: rand() * Math.PI * 2,
      baseAlpha:
        spec.alphaMin + rand() * (spec.alphaMax - spec.alphaMin),
      blur: spec.blurMin + rand() * (spec.blurMax - spec.blurMin),
    }));
  };
  const fgCount = Math.round(totalCount * 0.15);
  const bgCount = Math.round(totalCount * 0.35);
  const mgCount = Math.max(0, totalCount - fgCount - bgCount);
  const layerCounts = [fgCount, mgCount, bgCount];
  const renderedLayers = useMemo(
    () =>
      PARTICLE_LAYERS.map((spec, li) => ({
        spec,
        list: makeLayer(spec, layerCounts[li]),
      })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [width, height, totalCount],
  );

  const renderParticles = (list: Particle[], spec: ParticleLayerSpec) =>
    list.map((p, i) => {
      // CGI/VFX: particle style ke hisaab se shape/rang/gati
      const pStyle = S.particleStyle || 'dust';
      const spdMul = pStyle === 'embers' ? 1.9 : 1;
      const y =
        (((p.y - t * p.speed * spdMul) % height) + height) % height;
      // organic per-particle wander + desynced turbulence jitter (BATCH 2)
      const nx =
        noise2D('pt-x', t * 0.12 + p.phase, i * 3.71) * p.sway +
        noise2D(`atmo-${spec.key}`, frame * 0.015, i * 7.31) *
          p.sway *
          0.45;
      const ny = noise2D('pt-y', t * 0.09 + p.phase, i * 2.93);
      // rig already applies 1.0x drift; offset by (parallax - 1) for net depth
      const pxAdj = spec.parallax - 1;
      const x = p.x + nx + driftX * pxAdj;
      const yDrift =
        y + ny * p.sway * 0.5 + driftY * pxAdj * 0.6;
      const flickSpeed =
        pStyle === 'embers' ? 3.4 : pStyle === 'glitter' ? 4.6 : 1.8;
      const alpha =
        p.baseAlpha * (0.55 + 0.45 * Math.sin(t * flickSpeed + p.phase));
      const glow =
        spec.key === 'mg'
          ? p.size * 2.4
          : spec.key === 'fg'
            ? p.size * 2.8
            : 4;
      let bgColor = theme.particleColor;
      let shadow = `0 0 ${glow}px ${theme.particleColor}`;
      let radius = '50%';
      let clip: string | undefined;
      let rot: string | undefined;
      if (pStyle === 'glitter') {
        radius = '0';
        rot = `rotate(${((p.phase * 57) % 90).toFixed(0)}deg)`;
      } else if (pStyle === 'embers') {
        bgColor = '#ffb066';
        shadow = `0 0 ${glow + 4}px #ff7a1f`;
      } else if (pStyle === 'stars') {
        bgColor = '#fff6d8';
        shadow = `0 0 ${glow + 6}px #ffe9a8`;
        clip =
          'polygon(50% 0%, 61% 39%, 100% 50%, 61% 61%, 50% 100%, 39% 61%, 0% 50%, 39% 39%)';
      }
      return (
        <div
          key={i}
          style={{
            position: 'absolute',
            left: x,
            top: yDrift,
            width: p.size,
            height: p.size,
            borderRadius: radius,
            clipPath: clip,
            transform: rot,
            background: bgColor,
            opacity: alpha,
            filter: p.blur > 0 ? `blur(${p.blur.toFixed(2)}px)` : undefined,
            boxShadow: shadow,
          }}
        />
      );
    });

  const grainTiles = useMemo(() => {
    const rand = mulberry32(1337);
    return Array.from({length: GRAIN_SIZE}, () => rand());
  }, []);

  // Grain SVG tiles are frame-independent (only backgroundPosition flickers
  // per frame), so build the data-URIs once instead of every frame.
  const grainUris = useMemo(
    () => ({
      dark:
        `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='${GRAIN_SIZE}' height='2'%3E%3Crect width='100%25' height='100%25' fill='white' fill-opacity='0'/%3E${Array.from(
          {length: GRAIN_SIZE},
          (_, i) =>
            `%3Crect x='${i}' y='0' width='1' height='1' fill='%23ffffff' fill-opacity='${
              grainTiles[i] * 0.9
            }'/%3E`,
        ).join('')}%3C/svg%3E")`,
      paper:
        `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='${GRAIN_SIZE}' height='2'%3E${Array.from(
          {length: GRAIN_SIZE},
          (_, i) =>
            `%3Crect x='${i}' y='0' width='1' height='1' fill='%235a4416' fill-opacity='${
              grainTiles[i] * 0.8
            }'/%3E`,
        ).join('')}%3C/svg%3E")`,
    }),
    [grainTiles],
  );

  const isPaper = theme.decor === 'paper';

  return (
    <AbsoluteFill
      style={{background: isPaper ? '#efe2c4' : '#0d1015', overflow: 'hidden'}}
    >
      <div
        style={{
          position: 'absolute',
          inset: -40,
          transform: `translate(${driftX}px, ${driftY}px) scale(${(
            zoom *
            (1 + 0.035 * punchAmt)
          ).toFixed(5)}) perspective(1600px) rotateX(${(
            -S.tilt3dDeg * 0.6
          ).toFixed(2)}deg) rotateY(${S.tilt3dDeg.toFixed(2)}deg)`,
        }}
      >
        <AbsoluteFill style={{background: theme.bgGradient}} />
        {bgImage && bgKind === 'video' && (
          <div style={{position: 'absolute', inset: 0, overflow: 'hidden'}}>
            <OffthreadVideo
              src={bgImage}
              style={{
                position: 'absolute',
                inset: 0,
                width: '100%',
                height: '100%',
                objectFit: 'cover',
              }}
            />
          </div>
        )}
        {bgImage && bgKind !== 'video' && (
          <div
            style={{
              position: 'absolute',
              inset: 0,
              backgroundImage: `url("${bgImage}")`,
              backgroundSize: 'cover',
              backgroundPosition: 'center',
            }}
          />
        )}
        {/* Readability scrim (2026 short-form standard): jab koi real
            photo/video background hota hai, iske upar halka dark gradient
            taake text ke peeche contrast rahe aur bright/faded backgrounds
            (jese Pexels white skylines) uniform cinematic tone me a jayen. */}
        {bgImage && (
          <div
            style={{
              position: 'absolute',
              inset: 0,
              background:
                'linear-gradient(180deg, rgba(6,9,18,0.35) 0%, rgba(6,9,18,0.18) 22%, rgba(6,9,18,0.16) 50%, rgba(6,9,18,0.34) 78%, rgba(6,9,18,0.5) 100%)',
            }}
          />
        )}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background: `radial-gradient(ellipse 70% 40% at 50% 16%, ${theme.glowColor}, transparent 65%)`,
          }}
        />
        {/* BATCH 3 · radial exposure bloom pulse at phase boundaries */}
        {!isPaper && punchAmt > 0 && (
          <div
            style={{
              position: 'absolute',
              inset: 0,
              background: `radial-gradient(circle ${Math.round(
                width * 0.42,
              )}px at 50% 16%, ${accentTint(
                theme.accent,
                Number((0.32 * punchAmt).toFixed(3)),
              )}, transparent 70%)`,
              mixBlendMode: 'screen',
              pointerEvents: 'none',
            }}
          />
        )}
        {!isPaper && <AuroraGlows cfg={aurora} />}
        {!isPaper && (
          <GodRays
            theme={theme}
            opacity={S.raysOpacity}
            angleDeg={S.raysAngleDeg}
          />
        )}
        {!isPaper && <AmbientOrbs theme={theme} opacityMult={S.orbsOpacity} />}
        {/* CGI/VFX: DoF bokeh dots (volumetric/cinemafocus/auroranova) */}
        {!isPaper && S.bokehCount > 0 && (
          <BokehLayer
            count={S.bokehCount}
            opacity={S.bokehOpacity}
            accent={theme.accent}
          />
        )}
        {/* BATCH 2 · FAR plane (net 0.35x drift): distant skyline layers */}
        <div
          style={{
            position: 'absolute',
            inset: -40,
            transform: `translate(${farPX}px, ${farPY}px)`,
          }}
        >
          {theme.decor === 'stars' && <StarField />}
          {theme.decor === 'stars' && (
            <MosqueSilhouette accent={theme.accent} />
          )}
          {theme.decor === 'waves' && <WaveBands />}
          {theme.decor === 'dunes' && <Dunes />}
        </div>
        {theme.decor === 'sun' && <SunDisc />}
        {theme.decor === 'stars' && <Stars theme={theme} />}
        {theme.decor === 'pattern' && <PatternLattice accent={theme.accent} />}
        {theme.decor === 'waves' && <WaveCrescent accent={theme.accent} />}
        {theme.decor === 'dunes' && <SunDisc />}
        {theme.decor === 'royal' && <RoyalOrnament accent={theme.accent} />}
        {theme.decor === 'festive' && <FestiveOrnament accent={theme.accent} />}
        {theme.decor === 'qadr' && <QadrSky theme={theme} />}
        {renderedLayers.map(({spec, list}) => renderParticles(list, spec))}
        {/* CGI/VFX: displacement shimmer (heat/ripple/silk) */}
        {S.shimmerMode !== 'none' && S.shimmerStrength > 0 && (
          <ShimmerVeil mode={S.shimmerMode} strength={S.shimmerStrength} />
        )}
        {/* CGI/VFX: procedural noise veil (silkmarble) */}
        {S.noiseVeilOpacity > 0 && (
          <NoiseVeil opacity={S.noiseVeilOpacity} />
        )}
        {masterpiece && !isPaper && <ShootingStars />}
        {/* halo sirf raat-wale decors pe (moon wahan hai) */}
        {masterpiece &&
          (theme.decor === 'stars' || theme.decor === 'qadr') && (
            <MoonHalo accent={theme.accent} />
          )}
        {/* BATCH 2 · FOREGROUND plane (net 1.65x drift): front elements */}
        <div
          style={{
            position: 'absolute',
            inset: -24,
            transform: `translate(${fgPX}px, ${fgPY}px)`,
          }}
        >
          {theme.decor === 'lanterns' && <Lanterns accent={theme.accent} />}
          {!isPaper && <ForegroundHaze theme={theme} />}
          {masterpiece && !isPaper && (
            <RisingMotes color={theme.accent + 'cc'} />
          )}
        </div>
      </div>

      {!isPaper && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            opacity: S.grainOpacityDark,
            backgroundPosition: GRAIN_FLICKER[frame % 3],
            backgroundImage: grainUris.dark,
            mixBlendMode: 'overlay',
          }}
        />
      )}
      {isPaper && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            opacity:
              S.grainOpacityPaper *
              (S.paperTreatment === 'minimal' ? 0.55 : 1),
            backgroundPosition: GRAIN_FLICKER[frame % 3],
            backgroundImage: grainUris.paper,
          }}
        />
      )}

      <div
        style={{
          position: 'absolute',
          inset: 0,
          opacity:
            S.vignetteScale *
            (isPaper && S.paperTreatment === 'royal' ? 1.18 : 1),
          background: `radial-gradient(ellipse 85% 85% at 50% 50%, transparent 52%, ${theme.vignette} 100%)`,
        }}
      />

      {/* CGI/VFX: chromatic aberration lens fringe (edges par RGB split) */}
      {!isPaper && S.chromaticAberration > 0 && (
        <ChromaticEdges strength={S.chromaticAberration} />
      )}
      {/* CGI/VFX: specular gloss sweep (metallic sheen) */}
      {!isPaper && S.glossSweepCycleSec > 0 && (
        <GlossSweep cycleSec={S.glossSweepCycleSec} />
      )}

      {/* BATCH 3 · per-preset paper treatments */}
      {isPaper && S.paperTreatment === 'royal' && (
        <PaperFiligree accent={theme.accent} />
      )}
      {isPaper && S.paperTreatment === 'cinematic' && <ParchmentAging />}
      {isPaper && S.paperTreatment !== 'royal' && (
        <div
          style={{
            position: 'absolute',
            inset: S.paperTreatment === 'minimal' ? 36 : 34,
            border:
              S.paperTreatment === 'minimal'
                ? '1px solid rgba(138,106,40,0.38)'
                : `2px solid rgba(138,106,40,0.55)`,
            borderRadius: S.paperTreatment === 'minimal' ? 4 : 6,
          }}
        />
      )}

      {/* BATCH 2 · border overlays ride the foreground at 1.65x drift */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          transform: `translate(${borderPX}px, ${borderPY}px)`,
          pointerEvents: 'none',
        }}
      >
        {!isPaper && S.frameEnabled && lookFrameActive === false && (
          <>
            {/* BATCH 1 metallic double hairline: gradient ring via mask-knockout */}
            {[
              {inset: 40, w: 1.5, r: 10, op: S.frameOpacity1, ph: 0.13},
              {inset: 48, w: 1, r: 8, op: S.frameOpacity2, ph: 0.41},
            ].map((fr, fi) => (
              <div
                key={fi}
                style={{
                  position: 'absolute',
                  inset: fr.inset,
                  borderRadius: fr.r,
                  padding: fr.w,
                  ...goldGrad(frame, fps, fr.ph),
                  maskImage:
                    'linear-gradient(#000,#000), linear-gradient(#000,#000)',
                  WebkitMaskImage:
                    'linear-gradient(#000,#000), linear-gradient(#000,#000)',
                  maskClip: 'content-box, border-box',
                  WebkitMaskClip: 'content-box, border-box',
                  maskComposite: 'exclude',
                  WebkitMaskComposite: 'xor',
                  opacity: fr.op * (0.85 + 0.15 * Math.sin(frame / 110)),
                  pointerEvents: 'none',
                }}
              />
            ))}
          </>
        )}

        {/* MASTER LOOK v2: naya frame design (arch/deco/rosette) */}
        {lookFrameActive && (
          <FrameDecor
            variant={lookFrame}
            accent={theme.accent}
            opMult={S.cornerOpacity}
          />
        )}

        {!lookFrameActive && (
          <CornerOrnaments
            accent={theme.accent}
            light={isPaper}
            inset={S.cornerInset}
            size={S.cornerSize}
            opacityMult={S.cornerOpacity}
          />
        )}
      </div>
    </AbsoluteFill>
  );
};
