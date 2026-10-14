import { Platform, type TextStyle } from 'react-native';

/** One dark, cinema-like theme for the whole app. */
export const colors = {
  bg: '#0B0B0F',
  surface: '#15151B',
  surface2: '#1E1E26',
  surface3: '#282832',
  border: '#2A2A34',
  text: '#F5F5F7',
  textDim: '#A3A3B1',
  textFaint: '#6E6E7C',
  accent: '#FF7A3D',
  accentSoft: 'rgba(255, 122, 61, 0.16)',
  music: '#9C8CFF',
  musicSoft: 'rgba(156, 140, 255, 0.16)',
  star: '#FFC24B',
  like: '#FF4D6D',
  success: '#3DDC97',
  danger: '#FF5A5F',
  overlay: 'rgba(0, 0, 0, 0.55)',
  white: '#FFFFFF',
  black: '#000000',
} as const;

export const space = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 28,
  xxxl: 40,
} as const;

export const radius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 22,
  pill: 999,
} as const;

/** Horizontal page padding. */
export const gutter = space.lg;

export const font = {
  hero: { fontSize: 30, fontWeight: '800', letterSpacing: -0.6 } as TextStyle,
  title: { fontSize: 24, fontWeight: '800', letterSpacing: -0.4 } as TextStyle,
  h2: { fontSize: 19, fontWeight: '700', letterSpacing: -0.2 } as TextStyle,
  h3: { fontSize: 16, fontWeight: '700' } as TextStyle,
  body: { fontSize: 15, fontWeight: '400', lineHeight: 21 } as TextStyle,
  bodyStrong: { fontSize: 15, fontWeight: '600', lineHeight: 21 } as TextStyle,
  small: { fontSize: 13, fontWeight: '400', lineHeight: 18 } as TextStyle,
  smallStrong: { fontSize: 13, fontWeight: '600', lineHeight: 18 } as TextStyle,
  caption: { fontSize: 11, fontWeight: '600', letterSpacing: 0.4 } as TextStyle,
  mono: {
    fontSize: 15,
    fontWeight: '700',
    fontFamily: Platform.select({ ios: 'Menlo', android: 'monospace', default: 'monospace' }),
    letterSpacing: 3,
  } as TextStyle,
} as const;

/** Accent color of a domain: films are warm orange, music is violet. */
export function domainColor(domain: 'film' | 'music'): string {
  return domain === 'film' ? colors.accent : colors.music;
}

const GRADIENTS: readonly [string, string][] = [
  ['#3A1C71', '#D76D77'],
  ['#0F2027', '#2C5364'],
  ['#42275A', '#734B6D'],
  ['#1D2B64', '#F8CDDA'],
  ['#232526', '#414345'],
  ['#5A3F37', '#2C7744'],
  ['#4B134F', '#C94B4B'],
  ['#141E30', '#243B55'],
  ['#3E5151', '#DECBA4'],
  ['#2B5876', '#4E4376'],
  ['#603813', '#B29F94'],
  ['#16222A', '#3A6073'],
];

/** Stable two-color gradient for placeholder posters and avatars. */
export function gradientFor(seed: number): [string, string] {
  return GRADIENTS[Math.abs(seed) % GRADIENTS.length] as [string, string];
}
