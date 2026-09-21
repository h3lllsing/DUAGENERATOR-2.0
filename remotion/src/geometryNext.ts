// Procedural 8-fold Islamic-star geometry, deterministic from a numeric seed
// so a given dua always renders the same ornament (no framerandomness across
// renders). Returns star point-rings ready to draw as SVG polygons.

const hash = (seed: number, n: number): number => {
  let v = seed + n * 0x45d9f3b;
  v = Math.imul(v ^ (v >>> 16), 2246822507);
  v = Math.imul(v ^ (v >>> 13), 3266489909);
  return ((v ^ (v >>> 16)) >>> 0) / 4294967296;
};

const starPoints = (rr: number, n: number, phase = 0): string => {
  const pts: string[] = [];
  for (let i = 0; i < n; i++) {
    const a = (Math.PI / n) * (2 * i + 1) + phase;
    pts.push(`${(Math.cos(a) * rr).toFixed(1)},${(Math.sin(a) * rr).toFixed(1)}`);
  }
  return pts.join(' ');
};

export interface StarGeom {
  octo: {points: string; rotate: number};
  inner: {points: string};
  r: number;
}

export const starGeometry = (seed: number, size: number): StarGeom => {
  const r = size * (0.16 + hash(seed, 1) * 0.1);
  const rotate = hash(seed, 2) * 11 - 5.5;
  return {
    octo: {points: starPoints(r, 8), rotate},
    inner: {points: starPoints(r * 0.382, 8, Math.PI / 8)},
    r,
  };
};

// seed from a dua_id string (stable across reruns)
export const seedFromId = (id: string): number => {
  let h = 7;
  for (let i = 0; i < id.length; i++) h = Math.imul(h ^ id.charCodeAt(i), 2654435761);
  return h >>> 0;
};