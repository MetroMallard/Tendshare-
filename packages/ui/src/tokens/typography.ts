/**
 * The type scale.
 *
 * Two hard floors, because the people using this app are 40–65, often tired,
 * often reading on a phone in bad light:
 *   • body text is 17px and up,
 *   • nothing in the product is smaller than 14px.
 *
 * Line heights are generous (roughly 1.45–1.55 on body) so three lines of
 * instructions never turn into a grey block. `theme.test.ts` checks both floors
 * by computation, not by eye.
 */

export interface TypeStyle {
  readonly fontSize: number;
  readonly lineHeight: number;
  readonly fontWeight: '400' | '500' | '600' | '700';
  readonly letterSpacing?: number;
}

export const typography = {
  /** A screen's one big statement. */
  display: { fontSize: 34, lineHeight: 41, fontWeight: '700', letterSpacing: -0.6 },
  /** The heading at the top of a screen or a sheet. */
  title: { fontSize: 28, lineHeight: 34, fontWeight: '700', letterSpacing: -0.4 },
  /** A section heading inside a screen. */
  heading: { fontSize: 22, lineHeight: 28, fontWeight: '600', letterSpacing: -0.2 },
  /** A card title, or a row that needs to lead. */
  subheading: { fontSize: 19, lineHeight: 26, fontWeight: '600' },
  /** The default. Everything readable is at least this. */
  body: { fontSize: 17, lineHeight: 26, fontWeight: '400' },
  bodyStrong: { fontSize: 17, lineHeight: 26, fontWeight: '600' },
  /** Support text under a title: still 15px, never a whisper. */
  caption: { fontSize: 15, lineHeight: 21, fontWeight: '500' },
  /** All-caps eyebrow / field label. Tracked out for legibility. */
  label: { fontSize: 14, lineHeight: 18, fontWeight: '600', letterSpacing: 0.7 },
} as const satisfies Record<string, TypeStyle>;

export type Typography = typeof typography;
export type TypeVariant = keyof Typography;

/** The smallest size the design system may ever use, in points. */
export const MIN_FONT_SIZE = 14;

/** The smallest size body copy may use, in points. */
export const MIN_BODY_FONT_SIZE = 17;

/**
 * Inter, with the system font as the fallback — never a blocker.
 *
 * On web the browser resolves the stack: Inter if it is installed or later
 * bundled, otherwise the platform UI font. On native we deliberately leave the
 * family unset so iOS and Android use their own system font (San Francisco /
 * Roboto) at these sizes, which is both the fastest first paint and the most
 * legible option. Bundling Inter as an app asset is a later, deliberate step;
 * this token is the single place it changes.
 */
export const fontFamily = {
  web: 'Inter, "Inter Variable", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
  native: undefined,
} as const;
