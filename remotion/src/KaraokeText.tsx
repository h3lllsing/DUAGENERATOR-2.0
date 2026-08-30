import React from 'react';
import {useCurrentFrame, useVideoConfig} from 'remotion';
import type {WordTiming} from './types';
import {appleEase} from './easing';

// TEXT FX MODES (MASTER LOOK v3 - registry: fx-guardrails TEXT_FX)
// Word-level animation only (RTL/Arabic ligature-safe - research note):
//   glide      = classic pill karaoke (default/backward-safe)
//   blurin     = aane wale lafz dhundhlay, bolte waqt sharp hote hain
//   typewriter = lafz ek-ek karke appear + blinking caret
//   popwave    = active lafz bada spring-pop, pichhle par halki wave

export const KaraokeText: React.FC<{
  words: WordTiming[];
  fontSize: number;
  fontFamily: string;
  color?: string;
  pastColor?: string;
  futureColor?: string;
  activeColor?: string;
  pillColor?: string;
  pillTo?: string;
  maxWidth?: number;
  lineHeight?: number;
  accentGlow?: string;
  mode?: string;
}> = ({
  words,
  fontSize,
  fontFamily,
  color = '#f7f2e6',
  pastColor = 'rgba(212,175,55,0.75)',
  futureColor = 'rgba(245,240,230,0.22)',
  activeColor = '#1a1208',
  pillColor = '#d4af37',
  pillTo,
  maxWidth,
  lineHeight = 2.0,
  accentGlow = 'rgba(212,175,55,0.45)',
  mode = 'glide',
}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const t = frame / fps;

  // PILLAR 2: word state is computed in the FRAME domain (floor-snapped
  // boundaries) so a word never flickers on/off inside a single frame.
  // Active word = the LATEST word that has started; this guarantees exactly
  // one active word per frame and never overlaps the previous word (no
  // ceil(end) extension bleeding into the next word's start frame).
  let activeIndex = -1;
  for (let i = words.length - 1; i >= 0; i--) {
    if (frame >= Math.floor(words[i].start * fps)) {
      activeIndex = i;
      break;
    }
  }

  const lastEnd = words.length ? words[words.length - 1].end : 0;
  const holdT = t >= lastEnd ? Math.min(1, (t - lastEnd) / 0.8) : 0;

  // Readability (2026 short-form standard): har word par black outline taake
  // bright/light backgrounds par bhi text crisp readable rahe. Stroke font ke
  // saath scale hota hai (4-6px @ ~80px font). paintOrder 'stroke fill' outline
  // ko text ke peeche paint karta hai => crisp edge, no bleed into glyph fill.
  const strokePx = Math.max(2.5, fontSize * 0.065);

  return (
    <div
      dir="rtl"
      style={{
        fontFamily,
        fontSize,
        lineHeight,
        color,
        textAlign: 'center',
        maxWidth,
        wordSpacing: '0.12em',
        opacity: 1 - 0.3 * holdT,
        filter: holdT > 0 ? `brightness(${1 - 0.15 * holdT})` : undefined,
        WebkitTextStroke: `${strokePx.toFixed(2)}px rgba(0,0,0,0.88)`,
        paintOrder: 'stroke fill',
        transition: 'none',
      }}
    >
      {words.map((w, i) => {
        const isActive = i === activeIndex;
        const isPast = w.end <= t;

        // ---- per-mode word styling (word-level only => RTL safe) ----
        let opacity = 1;
        let scale = 1;
        let blurPx = 0;
        let translateY = 0;
        let showPill = false;
        let showCaret = false;
        let txtColor = isActive ? activeColor : isPast ? pastColor : futureColor;

        // M3-STABLE · 6-frame Apple-eased crossfade (fade mode ke liye)
        const fadeK = appleEase(Math.min(1, Math.max(0, (frame - w.start * fps) / 6)));

        // M3-STABLE · koi per-frame translate/scale jitter nahi — word
        // positions bilkul static. Fade/none modes karaoke cue sirf opacity
        // se dete hain (6-frame Apple-eased crossfade only, zero transform).
        if (mode === 'blurin') {
          showPill = isActive;
          if (isActive) {
            // dhundhla -> sharp hone tak smooth sharpen (Apple ease curve)
            const sinceStart = frame - w.start * fps;
            const k = appleEase(Math.min(1, sinceStart / 6));
            blurPx = 7 * (1 - k);
            opacity = 0.2 + 0.8 * k;
            translateY = 0;
            scale = 1;
            txtColor = activeColor;
          } else if (!isPast) {
            // aane wale lafz: readable ghost (dim + halka blur), box ke
            // andar content hamesha visible rehta hai
            blurPx = 3;
            opacity = 0.38;
          } else {
            opacity = 1;
            txtColor = pastColor;
          }
        } else if (mode === 'typewriter') {
          if (isActive || isPast) {
            opacity = 1;
            txtColor = isActive ? activeColor : pastColor;
            showPill = isActive; // soft highlight under current word
            showCaret = isActive && Math.floor(frame / 3) % 2 === 0;
          } else {
            opacity = 0;
          }
        } else if (mode === 'popwave') {
          if (isActive) {
            // M3-STABLE · spring-pop hata di — glyphs bilkul static, sirf
            // color/pill switch se cue milta hai (scroll-bounce jitter zero)
            opacity = 1;
            txtColor = activeColor;
          } else if (isPast) {
            // M3-STABLE · residual sine wave hata di (micro-vibration source)
            scale = 1;
            opacity = 1;
            txtColor = pastColor;
          } else {
            opacity = 0.28;
          }
        } else if (mode === 'fade') {
          // new stable default: word opacity only, no motion/blur/scale
          showPill = isActive;
          if (!isPast) {
            opacity = isActive ? 0.15 + 0.85 * fadeK : 0.32;
          } else {
            opacity = 1;
            txtColor = pastColor;
          }
          if (isActive) txtColor = activeColor;
        } else if (mode === 'none') {
          // fully static: instant switch, no pill, no transition
          if (isActive) {
            opacity = 1;
            txtColor = activeColor;
          } else if (isPast) {
            opacity = 1;
            txtColor = pastColor;
          } else {
            opacity = 0.32;
          }
        } else {
          // glide (stable): soft Apple-eased settle, zero sine ripple
          showPill = isActive;
          if (isActive) {
            // M3-STABLE · 5% settle-scale hata di — word bilkul static (pill + color se active)
            scale = 1;
            opacity = 1;
          } else if (isPast) {
            opacity = 1;
          } else {
            opacity = 0.28;
          }
        }

        return (
          <span
            key={i}
            style={{
              display: 'inline-block',
              padding: '0 0.2em',
              margin: '0.05em 0',
              borderRadius: fontSize * 0.3,
              position: 'relative',
              transform:
                scale !== 1 || translateY !== 0
                  ? `scale(${scale})` +
                    (translateY ? ` translateY(${(translateY).toFixed(2)}px)` : '')
                  : 'none',
              filter: blurPx > 0.05 ? `blur(${blurPx.toFixed(2)}px)` : undefined,
              whiteSpace: 'pre-wrap',
            }}
          >
            {showPill && (
              <span
                style={{
                  position: 'absolute',
                  inset: `${fontSize * 0.06}px ${fontSize * 0.08}px`,
                  background: `linear-gradient(90deg, ${pillColor}, ${pillTo || '#f0d488'})`,
                  borderRadius: fontSize * 0.3,
                  boxShadow: `0 0 ${fontSize * 0.45}px ${pillColor}a8, 0 0 ${
                    fontSize * 0.9
                  }px ${pillColor}55`,
                  zIndex: 0,
                }}
              />
            )}
            <span
              style={{
                position: 'relative',
                zIndex: 1,
                color: txtColor,
                textShadow:
                  mode === 'typewriter'
                    ? isActive || isPast
                      ? `0 2px 16px rgba(0,0,0,0.55)`
                      : undefined
                    : isActive || isPast
                      ? mode === 'blurin' && isActive
                        ? `0 0 10px ${accentGlow}`
                        : 'none'
                      : `0 2px 16px rgba(0,0,0,0.5), 0 0 10px ${accentGlow}`,
                opacity,
              }}
            >
              {w.t}
              {showCaret && (
                <span
                  style={{
                    position: 'absolute',
                    right: -(fontSize * 0.14),
                    top: '0.12em',
                    width: fontSize * 0.09,
                    height: fontSize * 0.8,
                    background: pillColor,
                    boxShadow: `0 0 12px ${pillColor}`,
                  }}
                />
              )}
            </span>
          </span>
        );
      })}
    </div>
  );
};
