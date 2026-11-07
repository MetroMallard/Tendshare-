/**
 * Export the app icon set, the splash and the web icons from the hand-authored
 * mark.
 *
 *   node scripts/export-app-icons.mjs
 *
 * The vector source is `apps/app/assets/brand/tendshare-mark.svg`; this script
 * never invents artwork, it only places that file on a field at the inset each
 * platform asks for and rasterises the result. The rasteriser is Chromium
 * (headless screenshot at an exact viewport), which is the only SVG renderer
 * this box has; there is no image library in the lockfile and this is not worth
 * adding one for.
 *
 * CI does not run this. CI runs `packages/ui/src/brand.test.ts`, which reads the
 * committed PNGs and asserts the sizes, the transparency, the field colour and
 * the mark's inset — so a stale or hand-edited PNG fails the build even though
 * the export is a local step. Re-run this after touching the mark or the brand
 * palette, then commit the PNGs with the SVG.
 *
 * Chromium must be on PATH as `chromium` (override with CHROMIUM=/path/to/chrome).
 */

import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { deflateSync } from 'node:zlib';

import { brand } from '../packages/ui/src/brand.ts';
import {
  ADAPTIVE_BACKGROUND,
  ADAPTIVE_MARK_COVERAGE,
  FAVICON_MARK_COVERAGE,
  IOS_MARK_COVERAGE,
  MARK_SVG,
  MASKABLE_MARK_COVERAGE,
  SPLASH,
  brandAssets,
  readPng,
} from '../packages/ui/src/brandAssets.ts';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const chromium = process.env.CHROMIUM ?? 'chromium';
const workDir = join(tmpdir(), 'tendshare-icons');

/** The field every icon and the splash sit on: the brand navy. */
const navy = brand.palette.light.primary;
/** The mark's teal: the brand accent as it is tuned to read on navy. */
const teal = brand.palette.dark.secondary;
/** A monochrome layer is a mask, so its ink is white and the launcher tints it. */
const maskInk = '#FFFFFF';

/** The mark's own ink box, read from the SVG so the script cannot drift from it. */
const markSvg = readFileSync(join(repoRoot, MARK_SVG), 'utf8');
const viewBox = /viewBox="([\d.\- ]+)"/.exec(markSvg)?.[1]?.trim().split(/\s+/).map(Number);
if (!viewBox || viewBox.length !== 4) {
  throw new Error(`${MARK_SVG} has no readable viewBox`);
}
const [, , markWidth, markHeight] = viewBox;

/**
 * Encode 8-bit pixels as a PNG. `colourType` 2 is RGB (opaque, what Apple
 * wants) and 6 is RGBA (what a transparent layer needs).
 */
function encodePng(width, height, colourType, pixels) {
  const channels = colourType === 6 ? 4 : 3;
  const stride = width * channels;
  const raw = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y += 1) {
    raw[y * (stride + 1)] = 0; // filter: none
    pixels.copy(raw, y * (stride + 1) + 1, y * stride, (y + 1) * stride);
  }

  const chunk = (type, data) => {
    const head = Buffer.alloc(8);
    head.writeUInt32BE(data.length, 0);
    head.write(type, 4, 'ascii');
    const body = Buffer.concat([head.subarray(4, 8), data]);
    const crcTable = encodePng.crcTable ?? (encodePng.crcTable = buildCrcTable());
    let crc = 0xffffffff;
    for (const byte of body) crc = crcTable[(crc ^ byte) & 0xff] ^ (crc >>> 8);
    const tail = Buffer.alloc(4);
    tail.writeUInt32BE((crc ^ 0xffffffff) >>> 0, 0);
    return Buffer.concat([head, data, tail]);
  };

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = colourType;
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

function buildCrcTable() {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
}

/** Render one HTML page at an exact viewport and return the PNG bytes. */
function rasterise({ width, height, html, transparent }) {
  const page = join(workDir, `page-${width}x${height}-${transparent ? 'a' : 'o'}.html`);
  const shot = join(workDir, 'shot.png');
  writeFileSync(page, html);
  rmSync(shot, { force: true });

  execFileSync(
    chromium,
    [
      '--headless',
      '--disable-gpu',
      '--no-sandbox',
      '--hide-scrollbars',
      '--force-device-scale-factor=1',
      `--window-size=${width},${height}`,
      ...(transparent ? ['--default-background-color=00000000'] : []),
      `--screenshot=${shot}`,
      pathToFileURL(page).href,
    ],
    { stdio: 'ignore' },
  );

  const image = readPng(shot);
  if (image.width !== width || image.height !== height) {
    throw new Error(`chromium rendered ${image.width}x${image.height}, wanted ${width}x${height}`);
  }

  const channels = transparent ? 4 : 3;
  const out = Buffer.alloc(width * height * channels);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const [r, g, b, a] = image.pixel(x, y);
      const index = (y * width + x) * channels;
      out[index] = r;
      out[index + 1] = g;
      out[index + 2] = b;
      if (transparent) out[index + 3] = a;
    }
  }

  return encodePng(width, height, transparent ? 6 : 2, out);
}

/**
 * A page holding the mark at a given inset. `coverage` is the share of the
 * canvas the mark's larger side should take; the SVG's viewBox is its ink box,
 * so scaling the image to that size puts the ink exactly there.
 */
function markPage({ size, coverage, background, ink }) {
  if (coverage === 0) {
    // A layer that carries no mark: the flat field Android composites onto.
    return `<!doctype html><html><head><style>html,body{margin:0;width:${size}px;height:${size}px;background:${background}}</style></head><body></body></html>`;
  }

  // `coverage` is the share of the canvas the mark's larger side takes, so the
  // larger of the two sides is the one driven by it.
  const inkWidth = coverage * size;
  const inkHeight = inkWidth * (markHeight / markWidth);
  const mark = readFileSync(join(repoRoot, MARK_SVG), 'utf8')
    .replace(/#4CC0B9/gi, ink)
    .replace(/width="[\d.]+" height="[\d.]+"/, `width="${inkWidth}" height="${inkHeight}"`);

  return `<!doctype html><html><head><meta charset="utf-8"><style>
    html,body{margin:0;padding:0;width:${size}px;height:${size}px;overflow:hidden;
      ${background ? `background:${background};` : 'background:transparent;'}
      display:flex;align-items:center;justify-content:center}
    svg{display:block}
  </style></head><body>${mark}</body></html>`;
}

/** The splash: the mark, and the product name beneath it, centred on navy. */
function splashPage({ size }) {
  const mark = readFileSync(join(repoRoot, MARK_SVG), 'utf8')
    .replace(/#4CC0B9/gi, teal)
    .replace(/width="[\d.]+" height="[\d.]+"/, `width="${size * 0.5}" height="${(size * 0.5 * markHeight) / markWidth}"`);

  return `<!doctype html><html><head><meta charset="utf-8"><style>
    html,body{margin:0;padding:0;width:${size}px;height:${size}px;overflow:hidden;background:transparent;
      display:flex;flex-direction:column;align-items:center;justify-content:center;gap:${Math.round(size * 0.055)}px}
    svg{display:block}
    /* The app's own font stack, so the wordmark matches the type on screen. */
    .name{font-family:Inter,"Inter Variable",-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,"Helvetica Neue",Arial,sans-serif;
      font-weight:600;font-size:${Math.round(size * 0.105)}px;letter-spacing:-0.02em;color:#FFFFFF;line-height:1}
  </style></head><body>${mark}<div class="name">${brand.name}</div></body></html>`;
}

mkdirSync(workDir, { recursive: true });

for (const asset of brandAssets(navy)) {
  const transparent = asset.background === null;
  const ink = asset.path.includes('monochrome') ? maskInk : teal;
  const png = rasterise({
    width: asset.size,
    height: asset.size,
    transparent,
    html: markPage({ size: asset.size, coverage: asset.coverage, background: asset.background, ink }),
  });
  const target = join(repoRoot, asset.path);
  mkdirSync(dirname(target), { recursive: true });
  writeFileSync(target, png);
  console.log(`${asset.path}  ${asset.size}px  ${transparent ? 'transparent' : navy}  mark ${Math.round(asset.coverage * 100)}%`);
}

const backgroundPng = rasterise({
  width: ADAPTIVE_BACKGROUND.size,
  height: ADAPTIVE_BACKGROUND.size,
  transparent: false,
  html: markPage({ size: ADAPTIVE_BACKGROUND.size, coverage: 0, background: navy, ink: teal }),
});
writeFileSync(join(repoRoot, ADAPTIVE_BACKGROUND.path), backgroundPng);
console.log(`${ADAPTIVE_BACKGROUND.path}  ${ADAPTIVE_BACKGROUND.size}px  ${navy}`);

const splashPng = rasterise({
  width: SPLASH.size,
  height: SPLASH.size,
  transparent: true,
  html: splashPage({ size: SPLASH.size }),
});
writeFileSync(join(repoRoot, SPLASH.path), splashPng);
console.log(`${SPLASH.path}  ${SPLASH.size}px  transparent  mark + name`);

rmSync(workDir, { recursive: true, force: true });
console.log(`\nmark ink box ${markWidth}x${markHeight} · teal ${teal} on navy ${navy} · mark ${ADAPTIVE_MARK_COVERAGE}/${IOS_MARK_COVERAGE}/${MASKABLE_MARK_COVERAGE}/${FAVICON_MARK_COVERAGE}`);
