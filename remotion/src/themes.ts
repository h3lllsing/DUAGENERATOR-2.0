export interface Theme {
  id: string;
  label: string;
  bgGradient: string;
  glowColor: string;
  particleColor: string;
  particleCount: number;
  vignette: string;
  arabicColor: string;
  urduColor: string;
  pastColor: string;
  futureColor: string;
  pillFrom: string;
  pillTo: string;
  activeText: string;
  accent: string;
  decor:
    | 'stars'
    | 'mosque'
    | 'sun'
    | 'paper'
    | 'pattern'
    | 'waves'
    | 'dunes'
    | 'royal'
    | 'lanterns'
    | 'festive'
    | 'qadr';
  // per-theme color treatment: dark scenes lift shadows, light scenes
  // control highlights (applied as CSS filter on the scene root)
  grade: {
    brightness: number;
    contrast: number;
    saturate: number;
  };
}

export const THEMES: Record<string, Theme> = {
  dark: {
    id: 'dark',
    label: 'Dark Gold',
    bgGradient:
      'linear-gradient(165deg, #0d1015 0%, #131a24 55%, #1a2333 100%)',
    glowColor: 'rgba(212,175,55,0.13)',
    particleColor: 'rgba(230,196,110,1)',
    particleCount: 46,
    vignette: 'rgba(0,0,0,0.42)',
    arabicColor: '#f7f2e6',
    urduColor: '#eee5c9',
    pastColor: 'rgba(212,175,55,0.75)',
    futureColor: 'rgba(245,240,230,0.22)',
    pillFrom: '#d4af37',
    pillTo: '#f0d488',
    activeText: '#1a1208',
    accent: '#d4af37',
    decor: 'stars',
    grade: {brightness: 1.22, contrast: 1.03, saturate: 1.05},
  },
  mosque: {
    id: 'mosque',
    label: 'Mosque Night',
    bgGradient:
      'linear-gradient(180deg, #070b1c 0%, #0e1631 52%, #1a2547 100%)',
    glowColor: 'rgba(150,175,255,0.14)',
    particleColor: 'rgba(210,220,255,1)',
    particleCount: 60,
    vignette: 'rgba(2,4,12,0.6)',
    arabicColor: '#f2ecdc',
    urduColor: '#e6e2d2',
    pastColor: 'rgba(226,192,108,0.78)',
    futureColor: 'rgba(235,238,250,0.2)',
    pillFrom: '#d4af37',
    pillTo: '#f0d488',
    activeText: '#141a30',
    accent: '#e2c06c',
    decor: 'mosque',
    grade: {brightness: 1.13, contrast: 1.02, saturate: 1.05},
  },
  sunset: {
    id: 'sunset',
    label: 'Sunset Dawn',
    bgGradient:
      'linear-gradient(180deg, #190d16 0%, #341a24 55%, #5c2b2b 100%)',
    glowColor: 'rgba(255,145,70,0.17)',
    particleColor: 'rgba(255,214,170,1)',
    particleCount: 40,
    vignette: 'rgba(20,6,10,0.55)',
    arabicColor: '#fdf3e4',
    urduColor: '#f7e8d2',
    pastColor: 'rgba(255,177,92,0.78)',
    futureColor: 'rgba(253,243,228,0.22)',
    pillFrom: '#ff9d4d',
    pillTo: '#ffd08a',
    activeText: '#2a1206',
    accent: '#ffb35c',
    decor: 'sun',
    grade: {brightness: 1.05, contrast: 1.04, saturate: 1.07},
  },
  manuscript: {
    id: 'manuscript',
    label: 'Old Manuscript',
    bgGradient:
      'linear-gradient(165deg, #f6edd9 0%, #efe2c4 60%, #e6d4ae 100%)',
    glowColor: 'rgba(160,120,40,0.10)',
    particleColor: 'rgba(140,105,45,1)',
    particleCount: 18,
    vignette: 'rgba(96,66,24,0.28)',
    arabicColor: '#2a1c08',
    urduColor: '#3d2c14',
    pastColor: 'rgba(120,84,20,0.95)',
    futureColor: 'rgba(51,35,15,0.52)',
    pillFrom: '#6e4c14',
    pillTo: '#96682a',
    activeText: '#fff8e6',
    accent: '#8a6a28',
    decor: 'paper',
    grade: {brightness: 0.985, contrast: 1.06, saturate: 0.97},
  },
  emerald: {
    id: 'emerald',
    label: 'Emerald Pattern',
    bgGradient:
      'linear-gradient(165deg, #07130d 0%, #0c2018 55%, #12362a 100%)',
    glowColor: 'rgba(90,225,160,0.11)',
    particleColor: 'rgba(185,255,215,1)',
    particleCount: 42,
    vignette: 'rgba(1,10,6,0.58)',
    arabicColor: '#f0f7ee',
    urduColor: '#e2efe0',
    pastColor: 'rgba(110,232,166,0.75)',
    futureColor: 'rgba(240,247,238,0.2)',
    pillFrom: '#46d68c',
    pillTo: '#8af0bc',
    activeText: '#04150c',
    accent: '#6fe0a8',
    decor: 'pattern',
    grade: {brightness: 1.10, contrast: 1.03, saturate: 1.06},
  },
  ocean: {
    id: 'ocean',
    label: 'Ocean Night',
    bgGradient:
      'linear-gradient(180deg, #04101c 0%, #0a2233 55%, #0f3a4a 100%)',
    glowColor: 'rgba(90,200,255,0.13)',
    particleColor: 'rgba(160,225,255,1)',
    particleCount: 50,
    vignette: 'rgba(1,8,14,0.6)',
    arabicColor: '#eef7fb',
    urduColor: '#dff0f5',
    pastColor: 'rgba(110,205,255,0.78)',
    futureColor: 'rgba(238,247,251,0.2)',
    pillFrom: '#4db8e8',
    pillTo: '#9fe2ff',
    activeText: '#03141f',
    accent: '#6fd0f5',
    decor: 'waves',
    grade: {brightness: 1.12, contrast: 1.03, saturate: 1.05},
  },
  desert: {
    id: 'desert',
    label: 'Desert Gold',
    bgGradient:
      'linear-gradient(180deg, #1c1206 0%, #3a2810 50%, #6b4a1e 100%)',
    glowColor: 'rgba(255,200,90,0.16)',
    particleColor: 'rgba(255,220,150,1)',
    particleCount: 36,
    vignette: 'rgba(18,10,2,0.55)',
    arabicColor: '#fdf4df',
    urduColor: '#f5e8cc',
    pastColor: 'rgba(255,196,87,0.8)',
    futureColor: 'rgba(253,244,223,0.22)',
    pillFrom: '#e8b54a',
    pillTo: '#ffd98a',
    activeText: '#241503',
    accent: '#ffc457',
    decor: 'dunes',
    grade: {brightness: 1.06, contrast: 1.04, saturate: 1.06},
  },
  royal: {
    id: 'royal',
    label: 'Royal Purple',
    bgGradient:
      'linear-gradient(165deg, #12081f 0%, #221040 55%, #341a5e 100%)',
    glowColor: 'rgba(190,140,255,0.15)',
    particleColor: 'rgba(225,195,255,1)',
    particleCount: 44,
    vignette: 'rgba(6,2,12,0.58)',
    arabicColor: '#f5effc',
    urduColor: '#eadff7',
    pastColor: 'rgba(196,150,255,0.78)',
    futureColor: 'rgba(245,239,252,0.2)',
    pillFrom: '#9d6bff',
    pillTo: '#cdaaff',
    activeText: '#150826',
    accent: '#b88aff',
    decor: 'royal',
    grade: {brightness: 1.10, contrast: 1.03, saturate: 1.06},
  },
  ramadan: {
    id: 'ramadan',
    label: 'Ramadan Lanterns',
    bgGradient:
      'linear-gradient(180deg, #0a0618 0%, #1c1038 52%, #2d1b4e 100%)',
    glowColor: 'rgba(255,170,60,0.15)',
    particleColor: 'rgba(255,205,120,1)',
    particleCount: 40,
    vignette: 'rgba(4,2,10,0.58)',
    arabicColor: '#fdf3e0',
    urduColor: '#f5e7cd',
    pastColor: 'rgba(255,178,74,0.78)',
    futureColor: 'rgba(253,243,224,0.2)',
    pillFrom: '#f0a83c',
    pillTo: '#ffd489',
    activeText: '#1d1002',
    accent: '#ffb44a',
    decor: 'lanterns',
    grade: {brightness: 1.07, contrast: 1.03, saturate: 1.06},
  },
  eid: {
    id: 'eid',
    label: 'Eid Gold Green',
    bgGradient:
      'linear-gradient(165deg, #04170e 0%, #0a2b1a 55%, #11422a 100%)',
    glowColor: 'rgba(240,200,90,0.16)',
    particleColor: 'rgba(255,225,140,1)',
    particleCount: 48,
    vignette: 'rgba(1,10,5,0.56)',
    arabicColor: '#fdf6df',
    urduColor: '#f3ecd0',
    pastColor: 'rgba(235,195,85,0.82)',
    futureColor: 'rgba(253,246,223,0.22)',
    pillFrom: '#e9bd4e',
    pillTo: '#ffe08f',
    activeText: '#1a1204',
    accent: '#ecc45c',
    decor: 'festive',
    grade: {brightness: 1.07, contrast: 1.03, saturate: 1.05},
  },
  qadr: {
    id: 'qadr',
    label: 'Laylatul Qadr',
    bgGradient:
      'linear-gradient(180deg, #01020a 0%, #050a1e 55%, #0b1430 100%)',
    glowColor: 'rgba(190,210,255,0.13)',
    particleColor: 'rgba(215,228,255,1)',
    particleCount: 64,
    vignette: 'rgba(0,1,5,0.62)',
    arabicColor: '#f4f7ff',
    urduColor: '#e4ebfa',
    pastColor: 'rgba(200,215,255,0.75)',
    futureColor: 'rgba(244,247,255,0.18)',
    pillFrom: '#aebfe8',
    pillTo: '#dde6ff',
    activeText: '#050a18',
    accent: '#c3d2f5',
    decor: 'qadr',
    grade: {brightness: 1.14, contrast: 1.02, saturate: 1.04},
  },
};

export const getTheme = (id?: string): Theme =>
  (id && THEMES[id]) || THEMES.dark;

// BATCH 4 · theme-adaptive light-sweep tint: accent lifted toward soft white
// (warm accents stay warm, cool themes like ocean/emerald/qadr tint cool)
export const accentTint = (accent: string, alpha: number): string => {
  const h = accent.replace('#', '');
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  const mix = (c: number) => Math.round(c * 0.45 + 255 * 0.55);
  return `rgba(${mix(r)},${mix(g)},${mix(b)},${alpha})`;
};
