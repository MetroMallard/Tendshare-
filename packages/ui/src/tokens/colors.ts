/**
 * The palette, in semantic names only.
 *
 * Nothing outside this file — and nothing in a screen or a component — may use a
 * raw hex value. A component asks for `colors.textSecondary`; this file decides
 * which hex that is today, in light and in dark.
 *
 * Two rules held across both schemes:
 *   1. Backgrounds are warm, not cool grey-white. The care audience reads this
 *      in a kitchen at 7am and a hospital corridor at 9pm; a warm paper tone is
 *      easier on the eye than a blue-grey screen.
 *   2. Dark mode is navy-tinted, never pure black — the same hue family as the
 *      navy brand, so the app does not turn into a different product at night.
 *
 * Contrast is not a comment here: `theme.test.ts` computes WCAG ratios for every
 * pair listed in `contrastPairs` and fails the build if one drops below AA.
 */

export type ColorScheme = 'light' | 'dark';

/**
 * Status family used by pills, badges and inline notes. Every status carries a
 * soft tinted background plus a strong foreground that is readable on it.
 */
export type StatusTone = 'neutral' | 'brand' | 'accent' | 'success' | 'warning' | 'danger';

export interface ThemeColors {
  /** The page behind everything. */
  readonly bg: string;
  /** Cards and rows sitting on `bg`. */
  readonly surface: string;
  /** Sheets, popovers: one step above `surface`. */
  readonly surfaceRaised: string;
  /** Inputs and wells that read as pressed into the page. */
  readonly surfaceSunken: string;
  /** Quiet blocks inside a card. */
  readonly surfaceMuted: string;
  readonly border: string;
  readonly borderStrong: string;
  /** Scrim behind a sheet. Apply the opacity in the component, never here. */
  readonly overlay: string;

  readonly textPrimary: string;
  readonly textSecondary: string;
  readonly textTertiary: string;
  readonly textInverse: string;

  /** Deep navy — the action colour and the brand voice. */
  readonly brand: string;
  readonly brandPressed: string;
  readonly brandFg: string;
  readonly brandSoft: string;
  readonly brandSoftFg: string;

  /** Soft teal — for care moments that are affirmative, not alarming. */
  readonly accent: string;
  readonly accentPressed: string;
  readonly accentFg: string;
  readonly accentSoft: string;
  readonly accentSoftFg: string;

  readonly success: string;
  readonly successSoft: string;
  readonly successSoftFg: string;

  readonly warning: string;
  readonly warningSoft: string;
  readonly warningSoftFg: string;

  readonly danger: string;
  readonly dangerPressed: string;
  readonly dangerSoft: string;
  readonly dangerSoftFg: string;

  /** Focus ring. Never removed — a keyboard user has to see where they are. */
  readonly focus: string;
}

export const lightColors: ThemeColors = {
  bg: '#F7F3EC',
  surface: '#FFFDF9',
  surfaceRaised: '#FFFFFF',
  surfaceSunken: '#EFEAE0',
  surfaceMuted: '#FAF6EF',
  border: '#E4DCD0',
  borderStrong: '#CBC2B2',
  overlay: '#0B1A26',

  textPrimary: '#17232E',
  textSecondary: '#4C5A66',
  textTertiary: '#5E6A76',
  textInverse: '#FFFFFF',

  brand: '#10456B',
  brandPressed: '#0B3454',
  brandFg: '#FFFFFF',
  brandSoft: '#E6EEF5',
  brandSoftFg: '#0D3A5B',

  accent: '#0E7B75',
  accentPressed: '#0A6560',
  accentFg: '#FFFFFF',
  accentSoft: '#DFF2EF',
  accentSoftFg: '#0A625C',

  success: '#15794A',
  successSoft: '#E2F2E8',
  successSoftFg: '#106038',

  warning: '#8A5606',
  warningSoft: '#FBF0DA',
  warningSoftFg: '#7C4A02',

  danger: '#B42318',
  dangerPressed: '#97190F',
  dangerSoft: '#FBEAE7',
  dangerSoftFg: '#96150C',

  focus: '#2F7BB0',
};

export const darkColors: ThemeColors = {
  bg: '#0B1319',
  surface: '#121C24',
  surfaceRaised: '#17222B',
  surfaceSunken: '#0E171E',
  surfaceMuted: '#0F1921',
  border: '#26333D',
  borderStrong: '#3A4B58',
  overlay: '#04090D',

  textPrimary: '#F3F6F8',
  textSecondary: '#BAC6CE',
  textTertiary: '#9AA8B2',
  textInverse: '#06131E',

  brand: '#7FB9E2',
  brandPressed: '#9CCBEA',
  brandFg: '#06131E',
  brandSoft: '#17303F',
  brandSoftFg: '#A9D2F0',

  accent: '#4CC0B9',
  accentPressed: '#6FD0CA',
  accentFg: '#04211F',
  accentSoft: '#10312E',
  accentSoftFg: '#7FD8D2',

  success: '#4ECF8C',
  successSoft: '#102C20',
  successSoftFg: '#78E0A8',

  warning: '#EEB35E',
  warningSoft: '#2C2312',
  warningSoftFg: '#F2C67E',

  danger: '#F08A80',
  dangerPressed: '#F5A79F',
  dangerSoft: '#331815',
  dangerSoftFg: '#F7A49B',

  focus: '#7FC0EA',
};

/** The soft background and readable foreground for one status tone. */
export function statusColors(
  colors: ThemeColors,
  tone: StatusTone,
): { readonly bg: string; readonly fg: string } {
  switch (tone) {
    case 'brand':
      return { bg: colors.brandSoft, fg: colors.brandSoftFg };
    case 'accent':
      return { bg: colors.accentSoft, fg: colors.accentSoftFg };
    case 'success':
      return { bg: colors.successSoft, fg: colors.successSoftFg };
    case 'warning':
      return { bg: colors.warningSoft, fg: colors.warningSoftFg };
    case 'danger':
      return { bg: colors.dangerSoft, fg: colors.dangerSoftFg };
    case 'neutral':
      return { bg: colors.surfaceSunken, fg: colors.textSecondary };
  }
}

/**
 * Every foreground/background pair the components actually put together, with
 * the WCAG AA minimum each one has to clear. The test walks this list, so a new
 * token that ships without a pairing is a pairing the test does not know about —
 * add it here at the same time as the token.
 */
export const contrastPairs: ReadonlyArray<{
  readonly foreground: keyof ThemeColors;
  readonly background: keyof ThemeColors;
  readonly min: number;
  readonly why: string;
}> = [
  { foreground: 'textPrimary', background: 'bg', min: 4.5, why: 'body text on the page' },
  { foreground: 'textPrimary', background: 'surface', min: 4.5, why: 'body text in a card' },
  { foreground: 'textPrimary', background: 'surfaceRaised', min: 4.5, why: 'body text in a sheet' },
  {
    foreground: 'textPrimary',
    background: 'surfaceSunken',
    min: 4.5,
    why: 'typed text in a field',
  },
  {
    foreground: 'textPrimary',
    background: 'surfaceMuted',
    min: 4.5,
    why: 'body text in a quiet block',
  },
  { foreground: 'textSecondary', background: 'bg', min: 4.5, why: 'subtitle on the page' },
  { foreground: 'textSecondary', background: 'surface', min: 4.5, why: 'subtitle in a card' },
  {
    foreground: 'textSecondary',
    background: 'surfaceRaised',
    min: 4.5,
    why: 'subtitle in a sheet',
  },
  { foreground: 'textTertiary', background: 'bg', min: 4.5, why: 'caption on the page' },
  { foreground: 'textTertiary', background: 'surface', min: 4.5, why: 'caption in a card' },
  {
    foreground: 'textTertiary',
    background: 'surfaceSunken',
    min: 4.5,
    why: 'placeholder in a field',
  },
  { foreground: 'brandFg', background: 'brand', min: 4.5, why: 'primary button label' },
  {
    foreground: 'brandFg',
    background: 'brandPressed',
    min: 4.5,
    why: 'primary button label, pressed',
  },
  { foreground: 'brandSoftFg', background: 'brandSoft', min: 4.5, why: 'brand pill label' },
  { foreground: 'accentFg', background: 'accent', min: 4.5, why: 'teal action label' },
  {
    foreground: 'accentFg',
    background: 'accentPressed',
    min: 4.5,
    why: 'teal action label, pressed',
  },
  { foreground: 'accentSoftFg', background: 'accentSoft', min: 4.5, why: 'teal pill label' },
  { foreground: 'successSoftFg', background: 'successSoft', min: 4.5, why: 'done pill label' },
  { foreground: 'warningSoftFg', background: 'warningSoft', min: 4.5, why: 'attention pill label' },
  { foreground: 'dangerSoftFg', background: 'dangerSoft', min: 4.5, why: 'problem pill label' },
  { foreground: 'success', background: 'surface', min: 4.5, why: 'success text and icon' },
  { foreground: 'warning', background: 'surface', min: 4.5, why: 'warning text and icon' },
  { foreground: 'danger', background: 'surface', min: 4.5, why: 'danger text and icon' },
  { foreground: 'brand', background: 'surface', min: 4.5, why: 'brand link text' },
  { foreground: 'accent', background: 'surface', min: 4.5, why: 'teal link text' },
  { foreground: 'textInverse', background: 'danger', min: 4.5, why: 'destructive button label' },
  { foreground: 'focus', background: 'surface', min: 3, why: 'focus ring against a card' },
  { foreground: 'focus', background: 'bg', min: 3, why: 'focus ring against the page' },
];
