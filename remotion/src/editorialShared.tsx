import React from 'react';
import {useCurrentFrame, useVideoConfig} from 'remotion';
import {measureText} from '@remotion/layout-utils';
import type {WordTiming} from './types';

export const ease = (k: number): number => k * k * (3 - 2 * k);
export const clamp01 = (n: number): number => Math.min(1, Math.max(0, n));

export const activeIdxAt = (
  words: WordTiming[],
  frame: number,
  fps: number
): number => {
  for (let i = words.length - 1; i >= 0; i--) {
    if (frame >= Math.floor(words[i].start * fps)) return i;
  }
  return -1;
};

export const fitFont = (opts: {
  text: string;
  fontFamily: string;
  base: number;
  min: number;
  maxWidth: number;
  maxLines: number;
}): number => {
  let size = opts.base;
  for (let i = 0; i < 8; i++) {
    const {width} = measureText({
      text: opts.text,
      fontFamily: opts.fontFamily,
      fontWeight: '400',
      fontSize: size,
    });
    const lines = Math.max(1, Math.ceil(width / opts.maxWidth));
    if (lines <= opts.maxLines || size <= opts.min) break;
    size = Math.max(opts.min, Math.floor(size * Math.sqrt(opts.maxLines / lines)));
  }
  return size;
};

export const ThinRule: React.FC<{width: number}> = ({width}) => (
  <div
    style={{
      width,
      height: 2,
      borderRadius: 99,
      background:
        'linear-gradient(90deg, transparent, #D8B25C 25%, #D8B25C 75%, transparent)',
    }}
  />
);

// word block with color-only cue (past dim-warm, active bright, future faint)
export const VerseBlock: React.FC<{
  words: WordTiming[];
  startFrame: number;
  fontFamily: string;
  baseSize: number;
  minSize: number;
  accent: string;
  dimColor: string;
  brightColor: string;
  withBrackets?: boolean;
  maxLines: number;
}> = ({
  words,
  startFrame,
  fontFamily,
  baseSize,
  minSize,
  accent,
  dimColor,
  brightColor,
  withBrackets,
  maxLines,
}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const local = frame - startFrame;
  const active = activeIdxAt(words, local, fps);
  const full = words.map((w) => w.t).join(' ');
  const size = fitFont({
    text: full,
    fontFamily,
    base: baseSize,
    min: minSize,
    maxWidth: 860,
    maxLines,
  });

  return (
    <div
      dir="rtl"
      style={{
        fontFamily,
        fontSize: size,
        lineHeight: 2.05,
        maxWidth: 860,
        textAlign: 'center',
        wordSpacing: '0.08em',
      }}
    >
      {withBrackets ? (
        <span style={{color: accent, opacity: 0.5}}>
          &#xFD3E;
        </span>
      ) : null}
      {words.map((w, i) => {
        const isActive = i === active;
        const isPast = w.end <= local / fps;
        const color = isActive
          ? brightColor
          : isPast
            ? dimColor
            : 'rgba(247,235,220,0.30)';
        return (
          <span
            key={i}
            dir="rtl"
            style={{
              display: 'inline-block',
              whiteSpace: 'pre-wrap',
              color,
              opacity: isActive ? 1 : isPast ? 0.92 : 0.3,
              transition: 'none',
              textShadow: isActive
                ? `0 0 34px ${accent}55`
                : '0 2px 14px rgba(0,0,0,0.55)',
            }}
          >
            {w.t}
          </span>
        );
      })}
      {withBrackets ? (
        <span style={{color: accent, opacity: 0.5}}>
          &#xFD3F;
        </span>
      ) : null}
    </div>
  );
};