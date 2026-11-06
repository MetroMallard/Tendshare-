/**
 * The brand, in one file.
 *
 * The product name, the tagline and the brand colours live here and nowhere
 * else. A rename or a recolour is an edit to this module: screens, components
 * and copy strings read `brand.name` instead of holding the word, and the theme
 * reads `brand.palette` instead of holding a brand hex.
 *
 * The name has had no formal trademark review, so a rename has to stay cheap —
 * that is the whole reason this file exists. `brand.test.ts` enforces it: the
 * build fails if the name appears in any other source file, if the app manifest
 * disagrees with this config, or if the theme's brand colours stop pointing at
 * `brand.palette`.
 *
 * Deliberately plain data — no React, no React Native, no runtime import at all,
 * so the theme, a screen and a Node test can all read the same object.
 */

import type { ColorScheme } from './tokens/colors';

/**
 * The brand colours and their working states, for one scheme.
 *
 * `primary` is the deep navy: the action colour and the brand's voice.
 * `secondary` is the soft teal: care moments that are affirmative, not alarming.
 *
 * The theme maps these onto its semantic tokens in `tokens/colors.ts` — a
 * component still asks for `colors.brand`, never for a hex. Contrast is checked
 * there, so a palette change here is still held to WCAG AA by the test.
 */
export interface BrandPalette {
  readonly primary: string;
  readonly primaryPressed: string;
  readonly primaryFg: string;
  readonly primarySoft: string;
  readonly primarySoftFg: string;

  readonly secondary: string;
  readonly secondaryPressed: string;
  readonly secondaryFg: string;
  readonly secondarySoft: string;
  readonly secondarySoftFg: string;
}

export interface Brand {
  /** The product name, exactly as a family member reads it. */
  readonly name: string;
  /** One plain line: what the product is for. Warm, no health claims. */
  readonly tagline: string;
  /** Where a family member writes when something is wrong. */
  readonly supportEmail: string;
  /** Brand colours per scheme. */
  readonly palette: Readonly<Record<ColorScheme, BrandPalette>>;
}

export const brand: Brand = {
  name: 'Tendshare',
  tagline: 'Care for someone you love, shared with your family.',
  // The settled support address (owner decision, 6 Nov 2026). Mail to it is
  // forwarded to the owner through the domain's MX records, so it can appear in
  // store listings and printed material. Nothing renders it yet.
  supportEmail: 'support@tendshare.app',
  palette: {
    light: {
      primary: '#10456B',
      primaryPressed: '#0B3454',
      primaryFg: '#FFFFFF',
      primarySoft: '#E6EEF5',
      primarySoftFg: '#0D3A5B',

      secondary: '#0E7B75',
      secondaryPressed: '#0A6560',
      secondaryFg: '#FFFFFF',
      secondarySoft: '#DFF2EF',
      secondarySoftFg: '#0A625C',
    },
    dark: {
      primary: '#7FB9E2',
      primaryPressed: '#9CCBEA',
      primaryFg: '#06131E',
      primarySoft: '#17303F',
      primarySoftFg: '#A9D2F0',

      secondary: '#4CC0B9',
      secondaryPressed: '#6FD0CA',
      secondaryFg: '#04211F',
      secondarySoft: '#10312E',
      secondarySoftFg: '#7FD8D2',
    },
  },
};
