export interface WordTiming {
  t: string;
  start: number;
  end: number;
}

export interface DuaManifest {
  dua_id: string;
  title: string;
  reference: string;
  // PILLAR 1 · additive optional schema fields (absent on legacy manifests)
  transliteration?: string;
  reference_source?: string;
  reference_no?: number | string;
  fps: number;
  width: number;
  height: number;
  totalDuration: number;
  audioFile: string;
  template?: string;
  // NEXT-LEVEL LOOK: when 'luminous' the video/thumbnail render through the
  // Direction-A "Luminous Modern" system (page-karaoke, crossfade phases,
  // procedural geometry, minimal editorial layout); when 'editorial' through
  // the Direction-C "Editorial" system (bismillah poster, whole-verse
  // calligraphy, Urdu meaning block, closing panel). Absent|'classic' = legacy.
  visualDirection?: 'classic' | 'luminous' | 'editorial';
  masterpiece?: boolean;
  arabicWords: WordTiming[];
  urduWords: WordTiming[];
  // Optional photo/video background path (relative to remotion/public/).
  // e.g. "backgrounds/prayer_29832018.jpg" — set by make_manifest via asset_registry.
  background?: string;
  backgroundKind?: 'image' | 'video';
  sections: {
    arabicEnd: number;
    urduStart: number;
  };
  channel?: {
    name?: string;
    handle?: string;
  };
  sfx?: {
    whoosh?: string;
    riser?: string;
    tick?: string;
  };
}
