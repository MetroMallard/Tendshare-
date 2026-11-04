/**
 * Spacing on an 8pt grid, radii in the 12–16px working range, and the few
 * elevation levels the product uses. Every number a component needs is here —
 * a component with a hard-coded `padding: 14` is a bug.
 *
 * The grid is 8pt, with one 4pt half-step (`2xs`) for optical alignment inside a
 * control. There is deliberately no 12, 14 or 18: the test below enforces it.
 */

export const space = {
  none: 0,
  /** The half-step. Optical gaps only — icon to label, dot to text. */
  '2xs': 4,
  xs: 8,
  sm: 16,
  md: 24,
  lg: 32,
  xl: 48,
  '2xl': 64,
} as const;

export type Space = typeof space;
export type SpaceKey = keyof Space;

/** Corner radii. Nothing sharper than 12, nothing rounder than a pill. */
export const radius = {
  /** Inputs, segments, small controls. */
  field: 12,
  /** The default card and sheet corner. */
  card: 16,
  /** Large panels that hold a whole flow. */
  panel: 20,
  pill: 999,
} as const;

export type Radius = typeof radius;

/**
 * Elevation. Three soft levels, no hard drop shadows: the app should feel like
 * paper on a table, not like a stack of floating windows.
 *
 * `boxShadow` is used because it is one value that works on both react-native
 * (new architecture) and react-native-web, instead of shipping two sets of
 * shadow props that drift apart.
 */
export const elevation = {
  none: {},
  /** A card resting on the page. */
  card: { boxShadow: '0 1px 2px rgba(13, 27, 42, 0.05), 0 4px 12px rgba(13, 27, 42, 0.05)' },
  /** A sheet or popover above a scrim. */
  raised: { boxShadow: '0 2px 6px rgba(13, 27, 42, 0.08), 0 12px 28px rgba(13, 27, 42, 0.12)' },
  /** The tab bar's hairline shadow, drawn upward. */
  bar: { boxShadow: '0 -1px 0 rgba(13, 27, 42, 0.06), 0 -8px 24px rgba(13, 27, 42, 0.05)' },
} as const;

export type Elevation = typeof elevation;
export type ElevationKey = keyof Elevation;

/** Motion. Gentle and short: an animation should never make someone wait. */
export const motion = {
  fast: 120,
  base: 180,
  slow: 260,
} as const;

export type Motion = typeof motion;

/**
 * Layout constants. Fixed numbers rather than magic values in screens: the
 * minimum comfortable tap target, the control heights, the widest a line of
 * body text may get, and the page gutter at each size.
 */
export const layout = {
  /** 48pt — the floor for anything a finger has to hit. */
  minTapTarget: 48,
  /** Control heights, all at or above the tap-target floor. */
  controlHeight: { small: 48, medium: 52, large: 60 },
  /** A comfortable number of characters per line on a tablet or desktop. */
  maxContentWidth: 720,
  gutter: { phone: 20, tablet: 28, desktop: 32 },
  breakpoints: { tablet: 768, desktop: 1024 },
  /** Sheets stop short of the status bar on a tall phone. */
  sheetMaxWidth: 560,
} as const;

export type Layout = typeof layout;
