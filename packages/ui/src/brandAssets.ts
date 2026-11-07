/**
 * Brand asset contract — the numbers every store icon is held to, plus the
 * small PNG reader that checks them.
 *
 * Two callers share this file, which is why it lives in the design system
 * rather than in either of them:
 *
 *   - `brand.test.ts` reads the committed PNGs and fails CI when an icon is the
 *     wrong size, has an alpha channel Apple rejects, paints a field that is not
 *     the brand navy, or draws the mark at the wrong inset.
 *   - `scripts/export-app-icons.mjs` renders those same PNGs from
 *     `apps/app/assets/brand/tendshare-mark.svg`, using these numbers so the
 *     export and the assertion can never disagree.
 *
 * It is deliberately plain Node — no React, no React Native, no image library —
 * so it runs in a unit test and in a bare script alike.
 */

import { readFileSync } from 'node:fs';
import { inflateSync } from 'node:zlib';

export type Rgb = readonly [number, number, number];

export interface PngImage {
  readonly width: number;
  readonly height: number;
  /** 2 = truecolour, 6 = truecolour + alpha. */
  readonly colorType: number;
  readonly hasAlpha: boolean;
  pixel(x: number, y: number): [number, number, number, number];
}

/**
 * Read an 8-bit PNG well enough to inspect it: header, and any pixel by
 * coordinate. Throws on formats it does not understand rather than guessing,
 * because a silently mis-read icon is worse than a failing test.
 */
export function readPng(path: string): PngImage {
  const buf = readFileSync(path);

  if (buf.readUInt32BE(0) !== 0x89504e47) {
    throw new Error(`${path} is not a PNG`);
  }

  let offset = 8;
  let width = 0;
  let height = 0;
  let bitDepth = 0;
  let colorType = 0;
  let palette: Buffer | null = null;
  let transparency: Buffer | null = null;
  const chunks: Buffer[] = [];

  while (offset < buf.length) {
    const length = buf.readUInt32BE(offset);
    const type = buf.toString('ascii', offset + 4, offset + 8);
    const data = buf.subarray(offset + 8, offset + 8 + length);

    if (type === 'IHDR') {
      width = data.readUInt32BE(0);
      height = data.readUInt32BE(4);
      bitDepth = data[8] ?? 8;
      colorType = data[9] ?? 6;
    } else if (type === 'PLTE') {
      palette = Buffer.from(data);
    } else if (type === 'tRNS') {
      transparency = Buffer.from(data);
    } else if (type === 'IDAT') {
      chunks.push(Buffer.from(data));
    } else if (type === 'IEND') {
      break;
    }

    offset += 12 + length;
  }

  if (bitDepth !== 8) {
    throw new Error(`${path} is ${bitDepth}-bit; only 8-bit PNGs are checked`);
  }

  const channels = { 0: 1, 2: 3, 3: 1, 4: 2, 6: 4 }[colorType];
  if (channels === undefined) {
    throw new Error(`${path} has unsupported colour type ${colorType}`);
  }

  const raw = inflateSync(Buffer.concat(chunks));
  const stride = width * channels;
  const pixels = Buffer.alloc(height * stride);
  let cursor = 0;

  for (let y = 0; y < height; y += 1) {
    const filter = raw[cursor] ?? 0;
    cursor += 1;
    const line = raw.subarray(cursor, cursor + stride);
    cursor += stride;
    const previous = y === 0 ? null : pixels.subarray((y - 1) * stride, y * stride);
    const current = pixels.subarray(y * stride, (y + 1) * stride);

    for (let x = 0; x < stride; x += 1) {
      const left = x >= channels ? (current[x - channels] ?? 0) : 0;
      const above = previous ? (previous[x] ?? 0) : 0;
      const upperLeft = previous && x >= channels ? (previous[x - channels] ?? 0) : 0;
      let value = line[x] ?? 0;

      if (filter === 1) value += left;
      else if (filter === 2) value += above;
      else if (filter === 3) value += (left + above) >> 1;
      else if (filter === 4) {
        const estimate = left + above - upperLeft;
        const toLeft = Math.abs(estimate - left);
        const toAbove = Math.abs(estimate - above);
        const toUpperLeft = Math.abs(estimate - upperLeft);
        value += toLeft <= toAbove && toLeft <= toUpperLeft ? left : toAbove <= toUpperLeft ? above : upperLeft;
      }

      current[x] = value & 0xff;
    }
  }

  return {
    width,
    height,
    colorType,
    hasAlpha: colorType === 4 || colorType === 6 || transparency !== null,
    pixel(x: number, y: number) {
      const index = y * stride + x * channels;
      if (colorType === 3 && palette) {
        const slot = pixels[index] ?? 0;
        return [
          palette[slot * 3] ?? 0,
          palette[slot * 3 + 1] ?? 0,
          palette[slot * 3 + 2] ?? 0,
          transparency && slot < transparency.length ? (transparency[slot] ?? 255) : 255,
        ];
      }
      if (channels === 1) {
        const grey = pixels[index] ?? 0;
        return [grey, grey, grey, 255];
      }
      if (channels === 2) {
        const grey = pixels[index] ?? 0;
        return [grey, grey, grey, pixels[index + 1] ?? 255];
      }
      if (channels === 3) {
        return [pixels[index] ?? 0, pixels[index + 1] ?? 0, pixels[index + 2] ?? 0, 255];
      }
      return [pixels[index] ?? 0, pixels[index + 1] ?? 0, pixels[index + 2] ?? 0, pixels[index + 3] ?? 255];
    },
  };
}

/** `#RRGGBB` (or `#RGB`) to components. Case-insensitive; throws on anything else. */
export function hexToRgb(hex: string): Rgb {
  const value = hex.trim().replace(/^#/, '');
  const full =
    value.length === 3
      ? value
          .split('')
          .map((part) => part + part)
          .join('')
      : value;

  if (!/^[0-9a-fA-F]{6}$/.test(full)) {
    throw new Error(`not a hex colour: ${hex}`);
  }

  return [parseInt(full.slice(0, 2), 16), parseInt(full.slice(2, 4), 16), parseInt(full.slice(4, 6), 16)];
}

export function rgbToHex(rgb: readonly number[]): string {
  return (
    '#' +
    rgb
      .slice(0, 3)
      .map((part) => Math.round(part).toString(16).padStart(2, '0'))
      .join('')
      .toUpperCase()
  );
}

/** How far apart two colours are, as the largest single-channel difference. */
function channelDistance(a: readonly number[], b: readonly number[]): number {
  return Math.max(Math.abs((a[0] ?? 0) - (b[0] ?? 0)), Math.abs((a[1] ?? 0) - (b[1] ?? 0)), Math.abs((a[2] ?? 0) - (b[2] ?? 0)));
}

export interface Box {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

/**
 * The box the artwork occupies.
 *
 * With a `background` the ink is every pixel far enough from that field colour
 * to be artwork (a flat PNG has no noise, so a small tolerance is enough and
 * anti-aliased edges count as ink, overstating the box by well under a pixel).
 * Without one, any pixel that is not fully transparent counts.
 */
export function inkBox(image: PngImage, background: string | null): Box | null {
  const field = background === null ? null : hexToRgb(background);
  let minX = image.width;
  let minY = image.height;
  let maxX = -1;
  let maxY = -1;

  for (let y = 0; y < image.height; y += 1) {
    for (let x = 0; x < image.width; x += 1) {
      const pixel = image.pixel(x, y);
      const isInk = field === null ? pixel[3] > 8 : pixel[3] > 8 && channelDistance(pixel, field) > 24;

      if (!isInk) continue;
      if (x < minX) minX = x;
      if (y < minY) minY = y;
      if (x > maxX) maxX = x;
      if (y > maxY) maxY = y;
    }
  }

  if (maxX < 0) return null;
  return { x: minX, y: minY, width: maxX - minX + 1, height: maxY - minY + 1 };
}

/** One exported raster and the promises it makes. */
export interface BrandAsset {
  /** Repo-relative path. */
  readonly path: string;
  /** Square side in pixels. */
  readonly size: number;
  /** Field colour behind the mark, or `null` for transparency. */
  readonly background: string | null;
  /**
   * The share of the canvas the mark's larger side should occupy.
   * `0` means the asset carries no mark (a solid background layer).
   */
  readonly coverage: number;
}

/** Apple's grid: the artwork sits at roughly 80–82% of the canvas, never bled. */
export const IOS_MARK_COVERAGE = 0.81;

/** Android's adaptive icon: the outer third can be masked away, so keep the mark inside 66%. */
export const ADAPTIVE_MARK_COVERAGE = 0.66;

/** A maskable web icon is safe inside a circle of 80%; the mark stays well inside it. */
export const MASKABLE_MARK_COVERAGE = 0.72;

/** A favicon has no room to breathe — the mark fills more of the tile. */
export const FAVICON_MARK_COVERAGE = 0.88;

/**
 * Every committed raster, with the size and inset its platform demands.
 * `brand.test.ts` walks this list, so adding an asset here is the whole job of
 * adding it to CI.
 */
export function brandAssets(navy: string): readonly BrandAsset[] {
  return [
    // iOS / stores: opaque, no alpha, mark on Apple's grid, no baked corners.
    { path: 'apps/app/assets/brand/icon-ios-1024.png', size: 1024, background: navy, coverage: IOS_MARK_COVERAGE },
    // Android adaptive: foreground keeps the mark inside the safe zone, the
    // background layer is the flat navy field, and monochrome is a single-tint
    // mask the launcher recolours.
    {
      path: 'apps/app/assets/brand/adaptive-icon-foreground.png',
      size: 1024,
      background: null,
      coverage: ADAPTIVE_MARK_COVERAGE,
    },
    {
      path: 'apps/app/assets/brand/adaptive-icon-monochrome.png',
      size: 1024,
      background: null,
      coverage: ADAPTIVE_MARK_COVERAGE,
    },
    // Web. These live in `public/` because that is the one directory the web
    // build serves at the site root, which is where a browser asks for them.
    { path: 'apps/app/public/favicon.png', size: 64, background: navy, coverage: FAVICON_MARK_COVERAGE },
    { path: 'apps/app/public/apple-touch-icon.png', size: 180, background: navy, coverage: IOS_MARK_COVERAGE },
    { path: 'apps/app/public/icon-192.png', size: 192, background: navy, coverage: IOS_MARK_COVERAGE },
    { path: 'apps/app/public/icon-512.png', size: 512, background: navy, coverage: IOS_MARK_COVERAGE },
    { path: 'apps/app/public/maskable-512.png', size: 512, background: navy, coverage: MASKABLE_MARK_COVERAGE },
  ];
}

/** The flat navy layer Android composites the foreground onto. */
export const ADAPTIVE_BACKGROUND = {
  path: 'apps/app/assets/brand/adaptive-icon-background.png',
  size: 1024,
} as const;

/** The splash artwork: the mark with the product name beneath it, on navy. */
export const SPLASH = {
  path: 'apps/app/assets/brand/splash.png',
  size: 1024,
} as const;

/** The vector source every raster above is rendered from. */
export const MARK_SVG = 'apps/app/assets/brand/tendshare-mark.svg';
