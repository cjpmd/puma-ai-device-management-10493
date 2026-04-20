import type React from 'react';

// Origin Sports iOS — Design Tokens
// Purple oklch palette, liquid glass surfaces, SF Pro type stack.

export const T = {
  purple: {
    50:  'oklch(0.97 0.02 295)',
    100: 'oklch(0.93 0.05 295)',
    200: 'oklch(0.85 0.10 295)',
    300: 'oklch(0.76 0.14 295)',
    400: 'oklch(0.66 0.18 295)',
    500: 'oklch(0.58 0.19 295)',
    600: 'oklch(0.50 0.19 292)',
    700: 'oklch(0.42 0.17 290)',
    800: 'oklch(0.32 0.14 288)',
    900: 'oklch(0.22 0.10 286)',
    950: 'oklch(0.14 0.06 285)',
  },
  magenta: 'oklch(0.66 0.18 340)',
  cyan:    'oklch(0.72 0.14 220)',
  amber:   'oklch(0.78 0.14 75)',
  red:     'oklch(0.62 0.22 25)',
  green:   'oklch(0.70 0.15 155)',

  // Dark surfaces
  bg:        '#0A0511',
  bg2:       '#150A1F',
  surface:   'rgba(28, 18, 38, 0.72)',
  surfaceHi: 'rgba(42, 28, 58, 0.82)',
  glass:     'rgba(255,255,255,0.06)',
  glassHi:   'rgba(255,255,255,0.10)',
  hairline:  'rgba(255,255,255,0.08)',

  // Text
  fg:  '#FFFFFF',
  fg2: 'rgba(235,235,245,0.60)',
  fg3: 'rgba(235,235,245,0.30)',
  fg4: 'rgba(235,235,245,0.18)',

  // Type
  font: '-apple-system, BlinkMacSystemFont, "SF Pro Text", "SF Pro Display", system-ui, sans-serif',
  mono: 'ui-monospace, "SF Mono", Menlo, monospace',

  // Radii (concentric with 48 device radius)
  r: { sm: 8, md: 14, lg: 20, xl: 26, xxl: 32 } as const,

  // iOS type scale
  type: {
    largeTitle: { size: 34, weight: 700, line: 41, track: 0.4 },
    title1:     { size: 28, weight: 700, line: 34, track: 0.36 },
    title2:     { size: 22, weight: 700, line: 28, track: 0.35 },
    title3:     { size: 20, weight: 600, line: 25, track: 0.38 },
    headline:   { size: 17, weight: 600, line: 22, track: -0.43 },
    body:       { size: 17, weight: 400, line: 22, track: -0.43 },
    callout:    { size: 16, weight: 400, line: 21, track: -0.31 },
    subhead:    { size: 15, weight: 400, line: 20, track: -0.24 },
    footnote:   { size: 13, weight: 400, line: 18, track: -0.08 },
    caption1:   { size: 12, weight: 500, line: 16, track: 0 },
    caption2:   { size: 11, weight: 500, line: 13, track: 0.07 },
  },
} as const;

export type TypeKey = keyof typeof T.type;

export function tType(key: TypeKey, extra: React.CSSProperties = {}): React.CSSProperties {
  const t = T.type[key];
  return {
    fontFamily: T.font,
    fontSize: t.size,
    fontWeight: t.weight,
    lineHeight: `${t.line}px`,
    letterSpacing: `${t.track}px`,
    ...extra,
  };
}

export const Wallpapers = {
  dawn: `
    radial-gradient(1200px 800px at 20% -10%, oklch(0.58 0.22 320 / 0.75), transparent 60%),
    radial-gradient(1000px 700px at 100% 20%, oklch(0.52 0.2 270 / 0.85), transparent 60%),
    radial-gradient(900px 800px at 50% 110%, oklch(0.45 0.2 295 / 0.9), transparent 65%),
    linear-gradient(180deg, #15081f 0%, #0a0511 100%)
  `,
  twilight: `
    radial-gradient(1100px 900px at 80% -10%, oklch(0.50 0.20 275 / 0.85), transparent 55%),
    radial-gradient(800px 700px at 0% 60%, oklch(0.55 0.22 340 / 0.55), transparent 60%),
    linear-gradient(180deg, #120823 0%, #070311 100%)
  `,
  aurora: `
    radial-gradient(1000px 800px at 70% 0%, oklch(0.60 0.20 300 / 0.8), transparent 55%),
    radial-gradient(900px 800px at 20% 40%, oklch(0.62 0.18 210 / 0.45), transparent 60%),
    radial-gradient(800px 700px at 60% 110%, oklch(0.40 0.22 295 / 0.9), transparent 60%),
    linear-gradient(180deg, #0e0820 0%, #050310 100%)
  `,
} as const;
