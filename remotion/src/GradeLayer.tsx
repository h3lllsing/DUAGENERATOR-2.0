import React from 'react';
import {AbsoluteFill} from 'remotion';

interface Grade {
  tint: string;
  blend: string;
  opacity: number;
  // soft luminous bloom at the scene's light source (screen blend, subtle)
  bloom?: {gradient: string; opacity: number};
}

const GRADES: Record<string, Grade> = {
  dark: {
    tint: 'linear-gradient(180deg, rgba(24,18,6,0.5), rgba(10,8,2,0.65))',
    blend: 'soft-light',
    opacity: 0.7,
    bloom: {
      gradient:
        'radial-gradient(ellipse 62% 44% at 50% 16%, rgba(255,226,150,0.20), transparent 70%)',
      opacity: 0.5,
    },
  },
  mosque: {
    tint: 'linear-gradient(180deg, rgba(14,26,58,0.55), rgba(6,10,24,0.7))',
    blend: 'soft-light',
    opacity: 0.9,
    bloom: {
      gradient:
        'radial-gradient(ellipse 60% 42% at 50% 14%, rgba(190,210,255,0.16), transparent 70%)',
      opacity: 0.45,
    },
  },
  sunset: {
    tint: 'linear-gradient(180deg, rgba(255,140,60,0.16), rgba(90,30,30,0.22))',
    blend: 'overlay',
    opacity: 0.55,
    bloom: {
      gradient:
        'radial-gradient(ellipse 58% 40% at 50% 30%, rgba(255,185,105,0.22), transparent 72%)',
      opacity: 0.5,
    },
  },
  manuscript: {
    tint: 'linear-gradient(180deg, rgba(120,84,40,0.16), rgba(60,40,16,0.26))',
    blend: 'multiply',
    opacity: 0.35,
    // light theme: warm richness instead of brightness bloom
    bloom: {
      gradient:
        'radial-gradient(ellipse 70% 50% at 50% 40%, rgba(255,238,196,0.22), transparent 75%)',
      opacity: 0.4,
    },
  },
  emerald: {
    tint: 'linear-gradient(180deg, rgba(16,80,50,0.2), rgba(6,36,22,0.3))',
    blend: 'soft-light',
    opacity: 0.7,
    bloom: {
      gradient:
        'radial-gradient(ellipse 58% 42% at 50% 16%, rgba(150,255,205,0.14), transparent 70%)',
      opacity: 0.45,
    },
  },
  ocean: {
    tint: 'linear-gradient(180deg, rgba(20,90,110,0.2), rgba(6,30,44,0.32))',
    blend: 'soft-light',
    opacity: 0.75,
    bloom: {
      gradient:
        'radial-gradient(ellipse 60% 42% at 50% 14%, rgba(145,220,255,0.15), transparent 70%)',
      opacity: 0.45,
    },
  },
  desert: {
    tint: 'linear-gradient(180deg, rgba(255,180,80,0.15), rgba(120,70,20,0.25))',
    blend: 'overlay',
    opacity: 0.5,
    bloom: {
      gradient:
        'radial-gradient(ellipse 58% 40% at 50% 28%, rgba(255,215,130,0.2), transparent 72%)',
      opacity: 0.5,
    },
  },
  royal: {
    tint: 'linear-gradient(180deg, rgba(90,40,140,0.2), rgba(40,12,70,0.32))',
    blend: 'soft-light',
    opacity: 0.75,
    bloom: {
      gradient:
        'radial-gradient(ellipse 58% 42% at 50% 16%, rgba(212,172,255,0.16), transparent 70%)',
      opacity: 0.45,
    },
  },
  ramadan: {
    tint: 'linear-gradient(180deg, rgba(70,40,130,0.22), rgba(30,14,60,0.34))',
    blend: 'soft-light',
    opacity: 0.8,
    bloom: {
      gradient:
        'radial-gradient(ellipse 60% 42% at 50% 14%, rgba(255,192,112,0.18), transparent 70%)',
      opacity: 0.5,
    },
  },
  eid: {
    tint: 'linear-gradient(180deg, rgba(240,200,90,0.10), rgba(6,40,24,0.28))',
    blend: 'soft-light',
    opacity: 0.7,
    bloom: {
      gradient:
        'radial-gradient(ellipse 60% 42% at 50% 16%, rgba(255,226,142,0.18), transparent 70%)',
      opacity: 0.5,
    },
  },
  qadr: {
    tint: 'linear-gradient(180deg, rgba(120,150,230,0.14), rgba(4,8,26,0.42))',
    blend: 'soft-light',
    opacity: 0.85,
    bloom: {
      gradient:
        'radial-gradient(ellipse 56% 46% at 50% 10%, rgba(202,222,255,0.22), transparent 68%)',
      opacity: 0.55,
    },
  },
};

// GRADE MOODS (MASTER LOOK v3 - registry: fx-guardrails GRADE_MOODS)
// theme grade ke UPAR halki mood layer; 'auto' = sirf theme grade (default)
const MOOD_GRADES: Record<string, Grade> = {
  warmgold: {
    tint: 'linear-gradient(180deg, rgba(255,196,110,0.20), rgba(120,70,10,0.24))',
    blend: 'soft-light',
    opacity: 0.55,
    bloom: {
      gradient:
        'radial-gradient(ellipse 60% 42% at 50% 18%, rgba(255,214,140,0.22), transparent 72%)',
      opacity: 0.4,
    },
  },
  coolnight: {
    tint: 'linear-gradient(180deg, rgba(80,120,255,0.20), rgba(10,20,60,0.30))',
    blend: 'soft-light',
    opacity: 0.55,
    bloom: {
      gradient:
        'radial-gradient(ellipse 58% 40% at 50% 12%, rgba(150,190,255,0.18), transparent 70%)',
      opacity: 0.38,
    },
  },
  sepia: {
    tint: 'linear-gradient(180deg, rgba(172,130,64,0.22), rgba(84,58,20,0.30))',
    blend: 'multiply',
    opacity: 0.38,
  },
  dreamy: {
    tint: 'linear-gradient(180deg, rgba(255,160,220,0.13), rgba(120,60,160,0.18))',
    blend: 'screen',
    opacity: 0.35,
    bloom: {
      gradient:
        'radial-gradient(ellipse 62% 44% at 50% 22%, rgba(255,200,240,0.20), transparent 72%)',
      opacity: 0.42,
    },
  },
};

export const GradeLayer: React.FC<{themeId?: string; moodId?: string}> = ({
  themeId,
  moodId,
}) => {
  const g = GRADES[themeId || 'dark'] || GRADES.dark;
  const m =
    moodId && moodId !== 'auto' ? MOOD_GRADES[moodId] : undefined;
  return (
    <>
      <AbsoluteFill
        style={{
          background: g.tint,
          mixBlendMode: g.blend as React.CSSProperties['mixBlendMode'],
          opacity: g.opacity,
          pointerEvents: 'none',
        }}
      />
      {g.bloom && (
        <AbsoluteFill
          style={{
            background: g.bloom.gradient,
            mixBlendMode: 'screen',
            opacity: g.bloom.opacity,
            pointerEvents: 'none',
          }}
        />
      )}
      {m && (
        <AbsoluteFill
          style={{
            background: m.tint,
            mixBlendMode: m.blend as React.CSSProperties['mixBlendMode'],
            opacity: m.opacity,
            pointerEvents: 'none',
          }}
        />
      )}
      {m?.bloom && (
        <AbsoluteFill
          style={{
            background: m.bloom.gradient,
            mixBlendMode: 'screen',
            opacity: m.bloom.opacity,
            pointerEvents: 'none',
          }}
        />
      )}
    </>
  );
};
