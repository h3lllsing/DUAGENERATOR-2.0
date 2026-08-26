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
  masterpiece?: boolean;
  arabicWords: WordTiming[];
  urduWords: WordTiming[];
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
