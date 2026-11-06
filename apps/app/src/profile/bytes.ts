/**
 * Base64 to bytes, as arithmetic.
 *
 * Kept apart from `picker.ts` so it can be tested without a renderer or a photo
 * library: `picker.ts` imports `expo-image-picker`, which only exists inside the
 * app bundle, and the one interesting part of choosing a photo is turning what
 * the platform hands back into something the bucket will accept.
 */

const BASE64_INDEX: Readonly<Record<string, number>> = {
  A: 0,
  B: 1,
  C: 2,
  D: 3,
  E: 4,
  F: 5,
  G: 6,
  H: 7,
  I: 8,
  J: 9,
  K: 10,
  L: 11,
  M: 12,
  N: 13,
  O: 14,
  P: 15,
  Q: 16,
  R: 17,
  S: 18,
  T: 19,
  U: 20,
  V: 21,
  W: 22,
  X: 23,
  Y: 24,
  Z: 25,
  a: 26,
  b: 27,
  c: 28,
  d: 29,
  e: 30,
  f: 31,
  g: 32,
  h: 33,
  i: 34,
  j: 35,
  k: 36,
  l: 37,
  m: 38,
  n: 39,
  o: 40,
  p: 41,
  q: 42,
  r: 43,
  s: 44,
  t: 45,
  u: 46,
  v: 47,
  w: 48,
  x: 49,
  y: 50,
  z: 51,
  '0': 52,
  '1': 53,
  '2': 54,
  '3': 55,
  '4': 56,
  '5': 57,
  '6': 58,
  '7': 59,
  '8': 60,
  '9': 61,
  '+': 62,
  '/': 63,
};

/**
 * Base64 to bytes, without `atob`.
 *
 * `atob` exists on web and in Hermes but not in every test environment, and a
 * polyfill is one more thing between the photo and the bucket. This is the whole
 * algorithm: six bits at a time, flushed a byte at a time.
 */
export function base64ToBytes(value: string): Uint8Array {
  const clean = value.replace(/[^A-Za-z0-9+/]/g, '');
  const bytes = new Uint8Array(Math.floor((clean.length * 3) / 4));
  let written = 0;
  let buffer = 0;
  let bits = 0;

  for (const character of clean) {
    const index = BASE64_INDEX[character];

    if (typeof index !== 'number') {
      continue;
    }

    buffer = (buffer << 6) | index;
    bits += 6;

    if (bits >= 8) {
      bits -= 8;
      bytes[written] = (buffer >> bits) & 0xff;
      written += 1;
    }
  }

  return bytes.subarray(0, written);
}
