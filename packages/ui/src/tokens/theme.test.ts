import { describe, expect, it } from 'vitest';

import { contrastPairs, darkColors, lightColors, statusColors, type ThemeColors } from './colors';
import { elevation, layout, radius, space } from './space';
import { darkTheme, getTheme, lightTheme } from './theme';
import { MIN_BODY_FONT_SIZE, MIN_FONT_SIZE, typography } from './typography';

/**
 * Design-system contract tests.
 *
 * Everything here is computed from the tokens themselves, so the guarantees the
 * product makes — WCAG AA contrast, a 17px body, a 48pt tap target, an 8pt
 * grid — fail the build the moment a token drifts. Nothing is asserted by eye.
 */

/** WCAG 2.1 relative luminance. */
function luminance(hex: string): number {
  const value = hex.replace('#', '');
  const channels = [0, 2, 4].map(
    (offset) => Number.parseInt(value.slice(offset, offset + 2), 16) / 255,
  );

  const [r = 0, g = 0, b = 0] = channels.map((channel) =>
    channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4,
  );

  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** WCAG contrast ratio between two opaque colours. */
function contrast(foreground: string, background: string): number {
  const a = luminance(foreground);
  const b = luminance(background);
  const lighter = Math.max(a, b);
  const darker = Math.min(a, b);

  return (lighter + 0.05) / (darker + 0.05);
}

/** Rough hue test: is this hex warmer (more red than blue) than it is cool? */
function isWarm(hex: string): boolean {
  const value = hex.replace('#', '');
  const red = Number.parseInt(value.slice(0, 2), 16);
  const blue = Number.parseInt(value.slice(4, 6), 16);

  return red > blue;
}

const schemes = [['light', lightColors] as const, ['dark', darkColors] as const];

describe.each(schemes)('%s theme colours', (name, colors: ThemeColors) => {
  it('defines every colour as a six-digit hex value', () => {
    for (const [key, value] of Object.entries(colors)) {
      expect(value, key).toMatch(/^#[0-9A-F]{6}$/i);
      expect(value, key).toMatch(/^#[0-9A-F]{2}/i);
    }
  });

  it('meets the WCAG ratio declared for every pair the components use', () => {
    for (const { foreground, background, min, why } of contrastPairs) {
      const ratio = contrast(colors[foreground], colors[background]);
      expect(ratio, `${name}: ${foreground} on ${background} (${why})`).toBeGreaterThanOrEqual(min);
    }
  });

  it('never puts white text directly on the page', () => {
    // Guards the classic mistake of using `textInverse` as ordinary text.
    expect(contrast(colors.textInverse, colors.bg)).toBeLessThan(4.5);
  });

  it('keeps surfaces distinguishable from the page', () => {
    expect(colors.surface).not.toBe(colors.bg);
    expect(colors.surfaceRaised).not.toBe(colors.surface);
  });

  it('gives every status tone a soft background with readable foreground', () => {
    for (const tone of ['neutral', 'brand', 'accent', 'success', 'warning', 'danger'] as const) {
      const { bg, fg } = statusColors(colors, tone);
      expect(bg, `${tone} background`).toMatch(/^#[0-9A-F]{6}$/i);
      expect(contrast(fg, bg), `${tone} label on its own tint`).toBeGreaterThanOrEqual(4.5);
    }
  });
});

describe('warm, navy-tinted backgrounds', () => {
  it('uses a warm off-white page in light mode, not a cool grey', () => {
    expect(
      isWarm(lightColors.bg),
      `light bg ${lightColors.bg} should be warmer than it is cool`,
    ).toBe(true);
    expect(isWarm(lightColors.surface)).toBe(true);
  });

  it('keeps light mode dark-on-light and dark mode light-on-dark', () => {
    expect(luminance(lightColors.bg)).toBeGreaterThan(0.5);
    expect(luminance(darkColors.bg)).toBeLessThan(0.1);
  });

  it('tints the dark background navy rather than using pure black', () => {
    const raw = darkColors.bg.replace('#', '');
    const blue = Number.parseInt(raw.slice(4, 6), 16);
    const red = Number.parseInt(raw.slice(0, 2), 16);

    expect(blue, 'dark bg should lean blue, i.e. navy-tinted').toBeGreaterThan(red);
    expect(darkColors.bg.toUpperCase()).not.toBe('#000000');
  });
});

describe('type scale', () => {
  it('never goes below 14px', () => {
    for (const [variant, style] of Object.entries(typography)) {
      expect(style.fontSize, variant).toBeGreaterThanOrEqual(MIN_FONT_SIZE);
    }
  });

  it('keeps body copy at 17px or larger', () => {
    expect(typography.body.fontSize).toBeGreaterThanOrEqual(MIN_BODY_FONT_SIZE);
    expect(typography.bodyStrong.fontSize).toBeGreaterThanOrEqual(MIN_BODY_FONT_SIZE);
    expect(typography.subheading.fontSize).toBeGreaterThanOrEqual(MIN_BODY_FONT_SIZE);
  });

  it('has a real hierarchy, each step larger than the one below it', () => {
    const ladder = [
      typography.label,
      typography.caption,
      typography.body,
      typography.subheading,
      typography.heading,
      typography.title,
      typography.display,
    ].map((style) => style.fontSize);

    for (let index = 1; index < ladder.length; index += 1) {
      expect(ladder[index], `step ${index}`).toBeGreaterThan(ladder[index - 1] ?? 0);
    }
  });

  it('gives body copy a line height of at least 1.4×', () => {
    expect(typography.body.lineHeight / typography.body.fontSize).toBeGreaterThanOrEqual(1.4);
    expect(typography.caption.lineHeight / typography.caption.fontSize).toBeGreaterThanOrEqual(
      1.35,
    );
  });
});

describe('spacing, radii, targets', () => {
  it('keeps every spacing step on the 8pt grid', () => {
    for (const [key, value] of Object.entries(space)) {
      if (key === '2xs') {
        // The one deliberate half-step, for optical gaps inside a control.
        expect(value, key).toBe(4);
        continue;
      }
      expect(value % 8, `space.${key} (${value})`).toBe(0);
    }
  });

  it('keeps radii inside the 12–16px working range, plus a pill', () => {
    for (const key of ['field', 'card'] as const) {
      expect(radius[key], key).toBeGreaterThanOrEqual(12);
      expect(radius[key], key).toBeLessThanOrEqual(16);
    }
    expect(radius.panel).toBeLessThanOrEqual(20);
    expect(radius.pill).toBeGreaterThanOrEqual(999);
  });

  it('keeps the tap target at 48pt or larger', () => {
    expect(layout.minTapTarget).toBeGreaterThanOrEqual(48);
  });

  it('ships only a few, soft elevation levels', () => {
    expect(Object.keys(elevation).length).toBeLessThanOrEqual(5);
  });

  it('puts a line of body text at a comfortable measure', () => {
    expect(layout.maxContentWidth).toBeGreaterThanOrEqual(600);
    expect(layout.maxContentWidth).toBeLessThanOrEqual(800);
  });
});

describe('themes', () => {
  it('resolves dark only when dark is asked for', () => {
    expect(getTheme('dark')).toBe(darkTheme);
    expect(getTheme('light')).toBe(lightTheme);
    expect(getTheme(null)).toBe(lightTheme);
    expect(getTheme(undefined)).toBe(lightTheme);
  });

  it('shares one scale across both schemes', () => {
    expect(lightTheme.typography).toBe(darkTheme.typography);
    expect(lightTheme.space).toBe(darkTheme.space);
    expect(lightTheme.radius).toBe(darkTheme.radius);
    expect(lightTheme.colors).not.toBe(darkTheme.colors);
  });
});
