import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { brand } from './brand';
import {
  ADAPTIVE_BACKGROUND,
  MARK_SVG,
  SPLASH,
  brandAssets,
  inkBox,
  readPng,
  rgbToHex,
} from './brandAssets';
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

/**
 * Every hex the product is allowed to paint with: the brand palette, plus the
 * semantic tokens it feeds. A colour that is in neither is a colour nobody
 * chose, so it is not allowed in the app, in the manifest, or in the mark.
 */
function paletteHexes(): ReadonlySet<string> {
  const hexes = new Set<string>();

  for (const scheme of ['light', 'dark'] as const) {
    for (const value of Object.values(brand.palette[scheme])) {
      hexes.add(value.toUpperCase());
    }
  }

  for (const colours of [lightColors, darkColors] as ReadonlyArray<ThemeColors>) {
    for (const value of Object.values(colours)) {
      hexes.add((value as string).toUpperCase());
    }
  }

  return hexes;
}

/** A colour written out in full, not a token reference and not a regex. */
const HEX_LITERAL = /#[0-9A-Fa-f]{6}\b/g;

/** The shape of the fields of `app.json` these tests hold the icons to. */
interface IconManifest {
  readonly expo: {
    readonly icon: string;
    readonly android: {
      readonly adaptiveIcon: {
        readonly foregroundImage: string;
        readonly backgroundImage: string;
        readonly monochromeImage: string;
      };
    };
    readonly web: { readonly favicon: string };
    readonly plugins: ReadonlyArray<string | readonly [string, Record<string, unknown>]>;
  };
}

describe('brand assets', () => {
  const navy = brand.palette.light.primary;
  const teal = brand.palette.dark.secondary;

  it('paints with no colour that is not in the palette', () => {
    // The mark, the icons and the manifest are all places a stray hex hides,
    // because none of them can import TypeScript. `app.json` still cannot, so
    // this scan — not the type system — is what guards them.
    const palette = paletteHexes();
    const files = [
      ...sourceRoots
        .flatMap((root) => sourceFiles(resolve(repoRoot, root)))
        // A test may name a colour to assert against it; only shipped source is
        // held to the palette.
        .filter((file) => !file.endsWith('.test.ts') && !file.endsWith('.test.tsx')),
      resolve(repoRoot, 'apps/app/app.json'),
      resolve(repoRoot, 'apps/app/public/manifest.webmanifest'),
      resolve(repoRoot, MARK_SVG),
    ];

    const offenders: string[] = [];

    for (const file of files) {
      const source = stripComments(readFileSync(file, 'utf8'));
      for (const match of source.matchAll(HEX_LITERAL)) {
        const hex = match[0].toUpperCase();
        if (!palette.has(hex)) {
          offenders.push(`${relative(repoRoot, file)}: ${hex}`);
        }
      }
    }

    expect(offenders).toEqual([]);
  });

  it('keeps the mark hand-authored vector, in the brand teal', () => {
    // The owner's rule: no generated raster, no stock art. The mark has to stay
    // a path we can read, recolour and re-derive.
    const svg = readFileSync(resolve(repoRoot, MARK_SVG), 'utf8');

    expect(svg).not.toMatch(/<image\b/);
    expect(svg).not.toMatch(/data:image/);
    expect(svg).toContain('<path');
    expect(svg.toUpperCase()).toContain(teal.toUpperCase());
  });

  it('ships every icon at the size and inset its platform asks for', () => {
    for (const asset of brandAssets(navy)) {
      const image = readPng(resolve(repoRoot, asset.path));

      expect([asset.path, image.width, image.height], asset.path).toEqual([asset.path, asset.size, asset.size]);
      expect([asset.path, image.hasAlpha], asset.path).toEqual([asset.path, asset.background === null]);

      const ink = inkBox(image, asset.background);
      expect(ink, `${asset.path} has no artwork in it`).not.toBeNull();
      if (!ink) continue;

      const largerSide = Math.max(ink.width, ink.height);
      expect(Math.abs(largerSide / asset.size - asset.coverage), `${asset.path} inset`).toBeLessThan(0.02);

      // Centred: an icon that sits off-centre looks wrong next to every other
      // icon on the home screen, which is the only place it is ever seen.
      expect(Math.abs(ink.x + ink.width / 2 - asset.size / 2), `${asset.path} centred`).toBeLessThan(asset.size * 0.01);
      expect(Math.abs(ink.y + ink.height / 2 - asset.size / 2), `${asset.path} centred`).toBeLessThan(asset.size * 0.01);

      if (asset.background !== null) {
        expect(rgbToHex(image.pixel(0, 0)), `${asset.path} field`).toBe(asset.background.toUpperCase());
      }
    }
  });

  it('gives the App Store an opaque icon with no baked corners', () => {
    // Apple composites its own mask: an alpha channel or a rounded corner in
    // the file is a rejection, so this is checked on the bytes, not on trust.
    const icon = readPng(resolve(repoRoot, 'apps/app/assets/brand/icon-ios-1024.png'));

    expect(icon.colorType).toBe(2);
    expect(icon.hasAlpha).toBe(false);

    for (const [x, y] of [
      [0, 0],
      [1023, 0],
      [0, 1023],
      [1023, 1023],
    ] as const) {
      expect(rgbToHex(icon.pixel(x, y)), `corner ${x},${y}`).toBe(navy.toUpperCase());
    }
  });

  it('gives Android a flat field and a single-tint mask', () => {
    const background = readPng(resolve(repoRoot, ADAPTIVE_BACKGROUND.path));
    expect([background.width, background.height]).toEqual([ADAPTIVE_BACKGROUND.size, ADAPTIVE_BACKGROUND.size]);
    expect(background.hasAlpha).toBe(false);

    for (const [x, y] of [
      [0, 0],
      [512, 512],
      [1023, 1023],
    ] as const) {
      expect(rgbToHex(background.pixel(x, y))).toBe(navy.toUpperCase());
    }

    // Monochrome is a mask the launcher recolours, so every pixel of ink has to
    // be the same tint. More than one tint means the launcher would tint a
    // picture, and it would look like a smudge on a dark home screen.
    const mono = readPng(resolve(repoRoot, 'apps/app/assets/brand/adaptive-icon-monochrome.png'));
    const tints = new Set<string>();

    for (let y = 0; y < mono.height; y += 2) {
      for (let x = 0; x < mono.width; x += 2) {
        const pixel = mono.pixel(x, y);
        if (pixel[3] > 8) tints.add(rgbToHex(pixel));
      }
    }

    expect([...tints]).toEqual(['#FFFFFF']);
  });

  it('puts the mark and the product name on the splash', () => {
    const splash = readPng(resolve(repoRoot, SPLASH.path));

    expect([splash.width, splash.height]).toEqual([SPLASH.size, SPLASH.size]);
    expect(splash.hasAlpha).toBe(true);

    const ink = inkBox(splash, null);
    expect(ink).not.toBeNull();
    if (!ink) return;

    // The mark is teal, the name beneath it is white: both have to be present,
    // and the name has to sit below the mark rather than beside it.
    let white = 0;
    let lowestWhiteRow = 0;
    let highestTealRow: number = SPLASH.size;

    for (let y = 0; y < splash.height; y += 1) {
      for (let x = 0; x < splash.width; x += 1) {
        const pixel = splash.pixel(x, y);
        if (pixel[3] < 200) continue;

        if (pixel[0] === 255 && pixel[1] === 255 && pixel[2] === 255) {
          white += 1;
          lowestWhiteRow = Math.max(lowestWhiteRow, y);
        } else if (rgbToHex(pixel) === teal.toUpperCase()) {
          highestTealRow = Math.min(highestTealRow, y);
        }
      }
    }

    expect(white).toBeGreaterThan(200);
    expect(lowestWhiteRow).toBeGreaterThan(highestTealRow);
  });

  it('wires the icon, the adaptive layers, the splash and the web icons', () => {
    const manifest = JSON.parse(readFileSync(resolve(repoRoot, 'apps/app/app.json'), 'utf8')) as IconManifest;
    const asRepoPath = (value: string) => `apps/app/${value.replace(/^\.\//, '')}`;

    const declared = [
      manifest.expo.icon,
      manifest.expo.android.adaptiveIcon.foregroundImage,
      manifest.expo.android.adaptiveIcon.backgroundImage,
      manifest.expo.android.adaptiveIcon.monochromeImage,
      manifest.expo.web.favicon,
    ];

    for (const value of declared) {
      expect(existsSync(resolve(repoRoot, asRepoPath(value))), asRepoPath(value)).toBe(true);
    }

    expect(manifest.expo.icon).toBe('./assets/brand/icon-ios-1024.png');
    expect(manifest.expo.android.adaptiveIcon.monochromeImage).toBe('./assets/brand/adaptive-icon-monochrome.png');

    // The splash is a config plugin, not a top-level key: it is the only way to
    // say "this image, on this field, in both schemes" without a native build.
    const splashPlugin = manifest.expo.plugins.find(
      (plugin): plugin is readonly [string, Record<string, unknown>] =>
        Array.isArray(plugin) && plugin[0] === 'expo-splash-screen',
    );

    expect(splashPlugin, 'expo-splash-screen is not configured').toBeDefined();
    expect(splashPlugin?.[1].image).toBe('./assets/brand/splash.png');
    expect(splashPlugin?.[1].backgroundColor).toBe(navy);
    expect((splashPlugin?.[1].dark as { backgroundColor?: string } | undefined)?.backgroundColor).toBe(navy);

    // The web manifest is a static file, so nothing type-checks it either.
    const webManifest = JSON.parse(readFileSync(resolve(repoRoot, 'apps/app/public/manifest.webmanifest'), 'utf8')) as {
      theme_color: string;
      background_color: string;
      icons: ReadonlyArray<{ src: string; sizes: string; purpose: string }>;
    };

    expect(webManifest.theme_color).toBe(navy);
    expect(webManifest.background_color).toBe(lightColors.bg);
    expect(webManifest.icons.map((icon) => icon.sizes).sort()).toEqual(['192x192', '512x512', '512x512']);
    expect(webManifest.icons.some((icon) => icon.purpose === 'maskable')).toBe(true);

    for (const icon of webManifest.icons) {
      expect(existsSync(resolve(repoRoot, `apps/app/public${icon.src}`)), icon.src).toBe(true);
    }
  });
});
