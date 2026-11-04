/**
 * The theme object: one value a component reads to draw itself.
 *
 * It is deliberately plain data with no React and no React Native import, so
 * the same object can be unit-tested in Node (contrast, type floors, grid
 * alignment) without a renderer.
 */

import { darkColors, lightColors, type ColorScheme, type ThemeColors } from './colors';
import {
  elevation,
  layout,
  motion,
  radius,
  space,
  type Elevation,
  type Layout,
  type Motion,
  type Radius,
  type Space,
} from './space';
import { fontFamily, typography, type Typography } from './typography';

export interface Theme {
  readonly scheme: ColorScheme;
  readonly colors: ThemeColors;
  readonly space: Space;
  readonly radius: Radius;
  readonly elevation: Elevation;
  readonly typography: Typography;
  readonly fontFamily: typeof fontFamily;
  readonly layout: Layout;
  readonly motion: Motion;
}

const shared = {
  space,
  radius,
  elevation,
  typography,
  fontFamily,
  layout,
  motion,
} as const;

export const lightTheme: Theme = { scheme: 'light', colors: lightColors, ...shared };

export const darkTheme: Theme = { scheme: 'dark', colors: darkColors, ...shared };

/**
 * Resolve a theme from a platform colour scheme. Anything other than an
 * explicit `dark` (including "no preference") resolves to light: the product's
 * default is the warm paper tone, not a dark screen.
 */
export function getTheme(scheme: ColorScheme | null | undefined): Theme {
  return scheme === 'dark' ? darkTheme : lightTheme;
}

/** The two schemes, in the order the gallery and the theme toggle show them. */
export const themes: Readonly<Record<ColorScheme, Theme>> = {
  light: lightTheme,
  dark: darkTheme,
};
