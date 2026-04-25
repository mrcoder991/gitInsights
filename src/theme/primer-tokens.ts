// Primer Primitives → typed TS tokens.
//
// Source of truth: `@primer/primitives/src/tokens/base/color/{dark,light}/*.json5`
// (Primer's design tokens, MIT). The package only ships JSON5 / CSS files, so we
// transcribe the scales we use into typed TS once. This is the *only* file in
// the repo where raw hex literals are allowed (see eslint.config.js).
//
// To extend: copy the relevant scale from
//   node_modules/@primer/primitives/src/tokens/base/color/<scheme>/<scheme>.json5
// here, keep the 0..N order, and re-export it through `mantineTheme` in
// `./mantine-theme.ts` so consumers always read it via the Mantine theme.

export type Scale10 = readonly [
  string,
  string,
  string,
  string,
  string,
  string,
  string,
  string,
  string,
  string,
];

// --- Base scales ----------------------------------------------------------
//
// Mantine 7 expects exactly 10 shades per palette. Primer's color scales are
// also 10 shades (0–9) for chromatic colors. For neutral/gray, Primer ships
// 14 shades (0–13); we pick a representative 10-shade slice that matches
// Mantine's lightest→darkest convention.

export const primerDark = {
  // Surface neutrals (used for borders / muted backgrounds / text).
  // Selected from Primer dark `base.color.neutral` 1..12.
  gray: [
    '#0d1117',
    '#151b23',
    '#212830',
    '#262c36',
    '#2a313c',
    '#2f3742',
    '#3d444d',
    '#656c76',
    '#9198a1',
    '#b7bdc8',
  ] as Scale10,
  blue: [
    '#cae8ff',
    '#a5d6ff',
    '#79c0ff',
    '#58a6ff',
    '#388bfd',
    '#1f6feb',
    '#1158c7',
    '#0d419d',
    '#0c2d6b',
    '#051d4d',
  ] as Scale10,
  green: [
    '#aff5b4',
    '#7ee787',
    '#56d364',
    '#3fb950',
    '#2ea043',
    '#238636',
    '#196c2e',
    '#0f5323',
    '#033a16',
    '#04260f',
  ] as Scale10,
  yellow: [
    '#f8e3a1',
    '#f2cc60',
    '#e3b341',
    '#d29922',
    '#bb8009',
    '#9e6a03',
    '#845306',
    '#693e00',
    '#4b2900',
    '#341a00',
  ] as Scale10,
  orange: [
    '#ffdfb6',
    '#ffc680',
    '#ffa657',
    '#f0883e',
    '#db6d28',
    '#bd561d',
    '#9b4215',
    '#762d0a',
    '#5a1e02',
    '#3d1300',
  ] as Scale10,
  red: [
    '#ffdcd7',
    '#ffc1ba',
    '#ffa198',
    '#ff7b72',
    '#f85149',
    '#da3633',
    '#b62324',
    '#8e1519',
    '#67060c',
    '#490202',
  ] as Scale10,
  purple: [
    '#eddeff',
    '#e2c5ff',
    '#d2a8ff',
    '#be8fff',
    '#ab7df8',
    '#8957e5',
    '#6e40c9',
    '#553098',
    '#3c1e70',
    '#271052',
  ] as Scale10,
  pink: [
    '#ffdaec',
    '#ffbedd',
    '#ff9bce',
    '#f778ba',
    '#db61a2',
    '#bf4b8a',
    '#9e3670',
    '#7d2457',
    '#5e103e',
    '#42062a',
  ] as Scale10,
} as const;

export const primerLight = {
  gray: [
    '#f6f8fa',
    '#eaeef2',
    '#d0d7de',
    '#afb8c1',
    '#8c959f',
    '#6e7781',
    '#57606a',
    '#424a53',
    '#32383f',
    '#24292f',
  ] as Scale10,
  blue: [
    '#ddf4ff',
    '#b6e3ff',
    '#80ccff',
    '#54aeff',
    '#218bff',
    '#0969da',
    '#0550ae',
    '#033d8b',
    '#0a3069',
    '#002155',
  ] as Scale10,
  green: [
    '#dafbe1',
    '#aceebb',
    '#6fdd8b',
    '#4ac26b',
    '#2da44e',
    '#1a7f37',
    '#116329',
    '#044f1e',
    '#003d16',
    '#002d11',
  ] as Scale10,
  yellow: [
    '#fff8c5',
    '#fae17d',
    '#eac54f',
    '#d4a72c',
    '#bf8700',
    '#9a6700',
    '#7d4e00',
    '#633c01',
    '#4d2d00',
    '#3b2300',
  ] as Scale10,
  orange: [
    '#fff1e5',
    '#ffd8b5',
    '#ffb77c',
    '#fb8f44',
    '#e16f24',
    '#bc4c00',
    '#953800',
    '#762c00',
    '#5c2200',
    '#471700',
  ] as Scale10,
  red: [
    '#ffebe9',
    '#ffcecb',
    '#ffaba8',
    '#ff8182',
    '#fa4549',
    '#cf222e',
    '#a40e26',
    '#82071e',
    '#660018',
    '#4c0014',
  ] as Scale10,
  purple: [
    '#fbefff',
    '#ecd8ff',
    '#d8b9ff',
    '#c297ff',
    '#a475f9',
    '#8250df',
    '#6639ba',
    '#512a97',
    '#3e1f79',
    '#2e1461',
  ] as Scale10,
  pink: [
    '#ffeff7',
    '#ffd3eb',
    '#ffadda',
    '#ff80c8',
    '#e85aad',
    '#bf3989',
    '#99286e',
    '#772057',
    '#611347',
    '#4d0336',
  ] as Scale10,
} as const;

// --- Functional surface tokens -------------------------------------------
//
// These are the per-scheme variables that drive page chrome. Subset of
// Primer's `functional/color/{bg,fg,border}Color.json5`. They're applied to
// Mantine's CSS variables via `cssVariablesResolver` in `./mantine-theme.ts`,
// so every Mantine + styled(MantineComponent) surface picks them up.

type FunctionalSurfaces = {
  bgDefault: string;
  bgMuted: string;
  bgSubtle: string;
  bgOverlay: string;
  fgDefault: string;
  fgMuted: string;
  fgSubtle: string;
  fgOnEmphasis: string;
  borderDefault: string;
  borderMuted: string;
  accentFg: string;
  accentEmphasis: string;
  successFg: string;
  successEmphasis: string;
  attentionFg: string;
  dangerFg: string;
  dangerEmphasis: string;
  focusOutline: string;
};

export const primerSurfaces: { dark: FunctionalSurfaces; light: FunctionalSurfaces } = {
  dark: {
    bgDefault: '#0d1117',
    bgMuted: '#151b23',
    bgSubtle: '#212830',
    bgOverlay: '#262c36',
    fgDefault: '#f0f6fc',
    fgMuted: '#9198a1',
    fgSubtle: '#656c76',
    fgOnEmphasis: '#ffffff',
    borderDefault: '#3d444d',
    borderMuted: '#262c36',
    accentFg: '#4493f8',
    accentEmphasis: '#1f6feb',
    successFg: '#3fb950',
    successEmphasis: '#238636',
    attentionFg: '#d29922',
    dangerFg: '#f85149',
    dangerEmphasis: '#da3633',
    focusOutline: '#1f6feb',
  },
  light: {
    bgDefault: '#ffffff',
    bgMuted: '#f6f8fa',
    bgSubtle: '#eaeef2',
    bgOverlay: '#ffffff',
    fgDefault: '#1f2328',
    fgMuted: '#59636e',
    fgSubtle: '#6e7781',
    fgOnEmphasis: '#ffffff',
    borderDefault: '#d1d9e0',
    borderMuted: '#d1d9e0b3',
    accentFg: '#0969da',
    accentEmphasis: '#0969da',
    successFg: '#1a7f37',
    successEmphasis: '#1f883d',
    attentionFg: '#9a6700',
    dangerFg: '#d1242f',
    dangerEmphasis: '#cf222e',
    focusOutline: '#0969da',
  },
};

// --- Shared design tokens (both schemes) ---------------------------------

export const primerSpacing = {
  xs: '0.25rem', // 4px
  sm: '0.5rem', // 8px
  md: '1rem', // 16px
  lg: '1.5rem', // 24px
  xl: '2rem', // 32px
} as const;

export const primerRadius = {
  xs: '0.1875rem', // 3px
  sm: '0.375rem', // 6px
  md: '0.5rem', // 8px
  lg: '0.75rem', // 12px
  xl: '1rem', // 16px
} as const;

export const primerShadows = {
  xs: '0 1px 0 rgba(31, 35, 40, 0.04)',
  sm: '0 3px 6px rgba(140, 149, 159, 0.15)',
  md: '0 8px 24px rgba(140, 149, 159, 0.2)',
  lg: '0 12px 28px rgba(140, 149, 159, 0.3)',
  xl: '0 16px 32px rgba(140, 149, 159, 0.4)',
} as const;

// Primer's typography stack (matches GitHub's product UI).
export const primerFontFamily =
  '-apple-system, BlinkMacSystemFont, "Segoe UI", "Noto Sans", Helvetica, Arial, sans-serif, "Apple Color Emoji", "Segoe UI Emoji"';

// JetBrains Mono is self-hosted via `@fontsource/jetbrains-mono` (see `main.tsx`).
export const primerMonoFamily =
  '"JetBrains Mono", ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, "Liberation Mono", monospace';
