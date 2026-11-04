import { describe, expect, it } from 'vitest';

import { darkTheme, lightTheme, typography, type Theme, type ThemeColors } from './tokens';

/**
 * WCAG 2.1 relative luminance, so the contrast assertions below are the real
 * formula rather than a magic number.
 */
function luminance(hex: string): number {
  const value = hex.replace('#', '');
  const channels = [0, 2, 4].map((offset) => Number.parseInt(value.slice(offset, offset + 2), 16) / 255);

  const [r = 0, g = 0, b = 0] = channels.map((channel) =>
    channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4,
  );

  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(foreground: string, background: string): number {
  const a = luminance(foreground);
  const b = luminance(background);
  const lighter = Math.max(a, b);
  const darker = Math.min(a, b);

  return (lighter + 0.05) / (darker + 0.05);
}

const colourPairs: ReadonlyArray<readonly [keyof ThemeColors, keyof ThemeColors]> = [
  ['text', 'background'],
  ['text', 'surface'],
  ['textMuted', 'background'],
  ['textMuted', 'surface'],
  ['accent', 'surface'],
  ['onAccent', 'accent'],
];

describe.each<readonly [string, Theme]>([
  ['light', lightTheme],
  ['dark', darkTheme],
])('%s theme', (_name, theme) => {
  it('defines every colour', () => {
    for (const [key] of colourPairs) {
      expect(theme.colors[key]).toMatch(/^#[0-9A-F]{6}$/i);
    }
  });

  it('meets WCAG AA (4.5:1) for every text pairing it uses', () => {
    for (const [foreground, background] of colourPairs) {
      const ratio = contrast(theme.colors[foreground], theme.colors[background]);
      expect(ratio, `${foreground} on ${background}`).toBeGreaterThanOrEqual(4.5);
    }
  });
});

describe('type and target sizes', () => {
  it('keeps body text at 17px or larger', () => {
    expect(typography.body.fontSize).toBeGreaterThanOrEqual(17);
    expect(typography.bodyStrong.fontSize).toBeGreaterThanOrEqual(17);
  });

  it('keeps tap targets at 48 points or larger', () => {
    expect(lightTheme.layout.minTapTarget).toBeGreaterThanOrEqual(48);
  });
});
