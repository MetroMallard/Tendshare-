import { readdirSync, readFileSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { brand } from './brand';
import { darkColors, lightColors, type ColorScheme, type ThemeColors } from './tokens/colors';

/**
 * Brand config contract tests.
 *
 * The promise in `PROJECT_BRIEF.md` is that the product name, tagline and colours
 * live in one file so a rename stays cheap. These tests are what makes that true
 * rather than aspirational: they read the source tree and fail the build the
 * moment the name, the manifest or a brand hex drifts back out into the code.
 */

const repoRoot = fileURLToPath(new URL('../../..', import.meta.url));

/** Where user-facing source lives. `packages/ui/src` holds the config itself. */
const sourceRoots = ['apps/app/app', 'apps/app/src', 'packages/ui/src'] as const;

/** The one file allowed to hold the product name. */
const brandConfigFile = 'packages/ui/src/brand.ts';

/**
 * Remove `//` and `/* *\/` comments, leaving string literals intact.
 *
 * A comment that mentions the product by name is fine — it is not a user-facing
 * string — but a screen that renders the name has to come from the config. This
 * is a small character walker rather than a regex so a `//` inside a URL, or an
 * apostrophe inside a comment, does not throw the scan off.
 */
function stripComments(source: string): string {
  let out = '';
  let index = 0;
  let quote: string | null = null;

  while (index < source.length) {
    const char = source[index] ?? '';
    const next = source[index + 1] ?? '';

    if (quote !== null) {
      out += char;

      if (char === '\\') {
        out += next;
        index += 2;
        continue;
      }

      if (char === quote) {
        quote = null;
      }

      index += 1;
      continue;
    }

    if (char === '"' || char === "'" || char === '`') {
      quote = char;
      out += char;
      index += 1;
      continue;
    }

    if (char === '/' && next === '/') {
      while (index < source.length && source[index] !== '\n') {
        index += 1;
      }
      continue;
    }

    if (char === '/' && next === '*') {
      index += 2;

      while (index < source.length && !(source[index] === '*' && source[index + 1] === '/')) {
        index += 1;
      }

      index += 2;
      continue;
    }

    out += char;
    index += 1;
  }

  return out;
}

/** Every `.ts` / `.tsx` file under a directory, recursively. */
function sourceFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);

    if (entry.isDirectory()) {
      return entry.name === 'node_modules' ? [] : sourceFiles(path);
    }

    return /\.tsx?$/.test(entry.name) ? [path] : [];
  });
}

/** The brand palette key that each semantic theme token has to come from. */
const paletteBindings: ReadonlyArray<{
  readonly token: keyof ThemeColors;
  readonly key: keyof (typeof brand.palette)['light'];
  readonly why: string;
}> = [
  { token: 'brand', key: 'primary', why: 'primary action colour' },
  { token: 'brandPressed', key: 'primaryPressed', why: 'primary action, pressed' },
  { token: 'brandFg', key: 'primaryFg', why: 'primary button label' },
  { token: 'brandSoft', key: 'primarySoft', why: 'brand pill background' },
  { token: 'brandSoftFg', key: 'primarySoftFg', why: 'brand pill label' },
  { token: 'accent', key: 'secondary', why: 'teal action colour' },
  { token: 'accentPressed', key: 'secondaryPressed', why: 'teal action, pressed' },
  { token: 'accentFg', key: 'secondaryFg', why: 'teal action label' },
  { token: 'accentSoft', key: 'secondarySoft', why: 'teal pill background' },
  { token: 'accentSoftFg', key: 'secondarySoftFg', why: 'teal pill label' },
];

describe('brand config', () => {
  it('holds a real name, tagline and support address', () => {
    expect(brand.name.trim()).toBe(brand.name);
    expect(brand.name.length).toBeGreaterThan(1);

    expect(brand.tagline.trim()).toBe(brand.tagline);
    expect(brand.tagline.endsWith('.')).toBe(true);

    expect(brand.supportEmail).toMatch(/^[^\s@]+@[^\s@]+\.[^\s@]+$/);
  });

  it('makes no health claim in the tagline', () => {
    // The product organises care; it never gives it. The tagline is the first
    // copy a family reads, so it is the first place a claim could sneak in.
    expect(brand.tagline).not.toMatch(
      /\b(dose|dosage|mg|milligram|cure|treat|treatment|diagnos\w*|medical advice|prescri\w*)\b/i,
    );
  });

  it('declares the full palette, as hex, in both schemes', () => {
    for (const scheme of ['light', 'dark'] as const) {
      const palette = brand.palette[scheme];

      for (const key of paletteBindings.map((binding) => binding.key)) {
        expect(palette[key], `${scheme}.${key}`).toMatch(/^#[0-9A-F]{6}$/);
      }
    }
  });

  it('is the source of every brand colour in the theme', () => {
    const schemes: ReadonlyArray<{
      readonly scheme: ColorScheme;
      readonly colors: ThemeColors;
    }> = [
      { scheme: 'light', colors: lightColors },
      { scheme: 'dark', colors: darkColors },
    ];

    for (const { scheme, colors } of schemes) {
      for (const { token, key, why } of paletteBindings) {
        expect(colors[token], `${scheme} ${token} (${why})`).toBe(brand.palette[scheme][key]);
      }
    }
  });

  it('is the only source of the product name in user-facing source', () => {
    const offenders = sourceRoots
      .flatMap((root) => sourceFiles(resolve(repoRoot, root)))
      .filter((file) => relative(repoRoot, file) !== brandConfigFile)
      .filter((file) => stripComments(readFileSync(file, 'utf8')).includes(brand.name))
      .map((file) => relative(repoRoot, file));

    expect(offenders).toEqual([]);
  });

  it('matches the app manifest, which cannot import TypeScript', () => {
    // `app.json` is the one place Expo needs the name as JSON. It cannot import
    // this config, so a rename has to edit it too — and this test is what says so.
    const manifest = JSON.parse(readFileSync(resolve(repoRoot, 'apps/app/app.json'), 'utf8')) as {
      expo: { name: string; web: { name: string; shortName: string } };
    };

    expect(manifest.expo.name).toBe(brand.name);
    expect(manifest.expo.web.name).toBe(brand.name);
    expect(manifest.expo.web.shortName).toBe(brand.name);
  });

  it('paints the browser bar and the first frame in theme tokens', () => {
    // `app.json` held two hexes nobody else had: a browser bar in a different
    // navy (#12395B) and a colder white (#F7F6F3) that flashed before the app
    // painted. Both are theme values now, and this fails if they drift again.
    const manifest = JSON.parse(readFileSync(resolve(repoRoot, 'apps/app/app.json'), 'utf8')) as {
      expo: { web: { themeColor: string; backgroundColor: string } };
    };

    expect(manifest.expo.web.themeColor).toBe(lightColors.brand);
    expect(manifest.expo.web.backgroundColor).toBe(lightColors.bg);
  });
});
