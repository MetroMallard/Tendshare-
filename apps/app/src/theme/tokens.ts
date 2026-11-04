/**
 * Local placeholder tokens.
 *
 * TODO(design-system): delete this file once `@tendshare/ui` lands — the real
 * design system owns the palette, spacing, type scale and radii for the whole
 * app. This is a deliberately small, neutral stand-in so the app shell can be
 * built, reviewed and shipped in Phase 1 without pre-empting the design
 * system's structure.
 *
 * It must stay dependency-free (no React, no React Native imports) so it can
 * be unit-tested in plain Node.
 */

export type ColorSchemeName = 'light' | 'dark';

export interface ThemeColors {
  /** Page background. */
  readonly background: string;
  /** Raised cards, sheets and the tab bar. */
  readonly surface: string;
  /** Recessed areas such as empty states and input wells. */
  readonly surfaceSunken: string;
  /** Hairlines and card outlines. */
  readonly border: string;
  /** Primary text — meets WCAG AA on `background` and `surface`. */
  readonly text: string;
  /** Secondary text — meets WCAG AA on `background` and `surface`. */
  readonly textMuted: string;
  /** Brand accent: active tab, primary actions. */
  readonly accent: string;
  /** Tinted accent background for the active tab pill and icon wells. */
  readonly accentSoft: string;
  /** Foreground on `accent`. */
  readonly onAccent: string;
}

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
} as const;

export const radius = {
  sm: 10,
  md: 16,
  lg: 24,
  pill: 999,
} as const;

/**
 * Body text starts at 17px: the audience is 40–65 and reads on a phone, often
 * in poor light. Nothing in the app is smaller than 13px.
 */
export const typography = {
  caption: { fontSize: 13, lineHeight: 18, fontWeight: '600' },
  body: { fontSize: 17, lineHeight: 25, fontWeight: '400' },
  bodyStrong: { fontSize: 17, lineHeight: 25, fontWeight: '600' },
  title: { fontSize: 22, lineHeight: 29, fontWeight: '700' },
  display: { fontSize: 30, lineHeight: 37, fontWeight: '700' },
} as const;

export const layout = {
  /** Content column width on a tablet or desktop browser. */
  maxContentWidth: 720,
  /** Horizontal page padding, by window width. */
  gutter: { phone: 20, tablet: 28, desktop: 32 },
  /** Minimum comfortable tap target, in points. */
  minTapTarget: 48,
  breakpoints: { tablet: 768, desktop: 1024 },
} as const;

export interface Theme {
  readonly scheme: ColorSchemeName;
  readonly colors: ThemeColors;
  readonly spacing: typeof spacing;
  readonly radius: typeof radius;
  readonly typography: typeof typography;
  readonly layout: typeof layout;
}

export const lightTheme: Theme = {
  scheme: 'light',
  colors: {
    background: '#F7F6F3',
    surface: '#FFFFFF',
    surfaceSunken: '#EFEEE9',
    border: '#E1DFD8',
    text: '#132434',
    textMuted: '#566270',
    accent: '#12395B',
    accentSoft: '#E3EDF4',
    onAccent: '#FFFFFF',
  },
  spacing,
  radius,
  typography,
  layout,
};

export const darkTheme: Theme = {
  scheme: 'dark',
  colors: {
    background: '#0E1319',
    surface: '#171D24',
    surfaceSunken: '#1E252D',
    border: '#2B333D',
    text: '#EDF1F5',
    textMuted: '#A2AEBA',
    accent: '#7BB8D4',
    accentSoft: '#1B2E3A',
    onAccent: '#08131B',
  },
  spacing,
  radius,
  typography,
  layout,
};

/** Resolve a theme from the platform colour scheme, defaulting to light. */
export function getTheme(scheme: ColorSchemeName | null | undefined): Theme {
  return scheme === 'dark' ? darkTheme : lightTheme;
}
