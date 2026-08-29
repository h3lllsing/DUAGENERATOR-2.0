// Shared easing helpers for Remotion components (M6 · easing kit).
// Mirrors core/easing.py so motion design feels consistent end-to-end.
// All functions take p in [0,1] and return t in [0,1] (p is assumed clamped
// by interpolate unless you pass a raw fraction — clamp yourself if raw).

export const clamp01 = (v: number): number => Math.max(0, Math.min(1, v));

export const easeOut = (p: number): number => 1 - Math.pow(1 - clamp01(p), 3);

export const easeOutCubic = easeOut;

export const easeOutQuart = (p: number): number =>
  1 - Math.pow(1 - clamp01(p), 4);

export const easeOutQuint = (p: number): number =>
  1 - Math.pow(1 - clamp01(p), 5);

export const easeOutExpo = (p: number): number => {
  const q = clamp01(p);
  return q === 0 ? 0 : 1 - Math.pow(2, -10 * q);
};

export const easeIn = (p: number): number => Math.pow(clamp01(p), 3);

export const easeInOut = (p: number): number => {
  const q = clamp01(p);
  return q < 0.5
    ? 4 * q * q * q
    : 1 - Math.pow(-2 * q + 2, 3) / 2;
};

export const easeOutBack = (p: number): number => {
  const q = clamp01(p);
  const c1 = 1.70158;
  const c3 = c1 + 1;
  return 1 + c3 * Math.pow(q - 1, 3) + c1 * Math.pow(q - 1, 2);
};

// ---- cubic-bezier -----------------
const bezier = (t: number, x1: number, y1: number, x2: number, y2: number) => {
  const q = clamp01(t);
  const cx = 3.0 * x1;
  const bx = 3.0 * (x2 - x1) - cx;
  const ax = 1.0 - cx - bx;
  let tt = q;
  for (let i = 0; i < 6; i++) {
    const x = ((ax * tt + bx) * tt + cx) * tt;
    if (Math.abs(x - q) < 1e-6) break;
    const dx = (3 * ax * tt + 2 * bx) * tt + cx;
    if (Math.abs(dx) < 1e-6) break;
    tt = tt - (x - q) / dx;
  }
  tt = clamp01(tt);
  const cy = 3.0 * y1;
  const by = 3.0 * (y2 - y1) - cy;
  const ay = 1.0 - cy - by;
  return ((ay * tt + by) * tt + cy) * tt;
};

export const appleEase = (p: number): number => bezier(p, 0.16, 1.0, 0.3, 1.0);

export const materialEase = (p: number): number =>
  bezier(p, 0.4, 0.0, 0.2, 1.0);

export const EASINGS: Record<string, (p: number) => number> = {
  easeOut,
  easeOutCubic,
  easeOutQuart,
  easeOutQuint,
  easeOutExpo,
  easeIn,
  easeInOut,
  easeOutBack,
  apple: appleEase,
  material: materialEase,
};

export const applyEasing = (name: string, p: number): number =>
  (EASINGS[name] || easeOut)(p);
