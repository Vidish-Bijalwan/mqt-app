/**
 * Design-system tokens for the MQT app (v1.1).
 * Single source of truth for new/changed UI. Values mirror the existing
 * BRAND palette in src/constants.ts where they overlap, so v1.1 styling
 * stays consistent with the site (teal #127C82 primary).
 * Builders: import { COLORS, SPACING, RADII, FONT, WEIGHT, DURATIONS,
 * TOUCH_MIN } from '../theme/tokens'. Do not rename these exports.
 */

export const COLORS = {
  primary: '#127C82',
  primaryDark: '#0E6368',
  darkGreen: '#0B3D2E',
  text: '#1A1A1A',
  muted: '#666666',
  background: '#FFFFFF',
  card: '#FFFFFF',
  border: '#E0E0E0',
  placeholderBg: '#E8E8E8',
  placeholderText: '#888888',
  estimatedBg: '#FFF4E0',
  estimatedText: '#8A5A00',
  errorBg: '#FDECEC',
  errorText: '#7A1F1F',
  white: '#FFFFFF',
  /** Input field background (light: white; dark: elevated surface). */
  inputBg: '#FFFFFF',
  /** Success notice background/text (e.g. confirmation banners). */
  successBg: '#E6F4EA',
  successText: '#1E6B2E',
} as const;

export const SPACING = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
} as const;

export const RADII = {
  card: 12,
  button: 10,
  chip: 20,
  pill: 999,
} as const;

/** Font sizes (pt). */
export const FONT = {
  title: 22,
  heading: 17,
  body: 15,
  meta: 13,
  small: 12,
} as const;

export const WEIGHT = {
  regular: '400',
  medium: '600',
  bold: '700',
} as const;

/** Transition durations in ms. Screen transitions stay in 150–220ms. */
export const DURATIONS = {
  fast: 150,
  normal: 180,
  slow: 220,
} as const;

/**
 * Dark palette (v1.2). Same keys as COLORS so screens can swap palettes
 * through SettingsContext without restyling. Primary teal is unchanged
 * (brand colour); surfaces/text are inverted for dark mode.
 */
export const DARK_COLORS = {
  primary: '#127C82',
  primaryDark: '#0E6368',
  darkGreen: '#0B3D2E',
  text: '#F5F5F5',
  muted: '#AAAAAA',
  background: '#121212',
  card: '#1E1E1E',
  border: '#333333',
  placeholderBg: '#2A2A2A',
  placeholderText: '#999999',
  estimatedBg: '#3A2E12',
  estimatedText: '#FFD98A',
  errorBg: '#3D1F1F',
  errorText: '#FF9A9A',
  white: '#FFFFFF',
  inputBg: '#2A2A2A',
  successBg: '#1E3A24',
  successText: '#9BE0A8',
} as const;

/** Either palette, as selected by SettingsContext. */
export type Palette = typeof COLORS | typeof DARK_COLORS;

/** Minimum touch-target height/width (dp) for every interactive element. */
export const TOUCH_MIN = 48;
