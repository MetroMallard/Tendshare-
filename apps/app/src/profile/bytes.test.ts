import { describe, expect, it } from 'vitest';

import { base64ToBytes } from './bytes';

/** Text as UTF-8 bytes, so the expectation is readable rather than a hex dump. */
function bytesOf(text: string): readonly number[] {
  return [...new TextEncoder().encode(text)];
}

describe('base64ToBytes', () => {
  it('decodes a plain string', () => {
    // "hello" — no padding, two characters' worth of leftover bits.
    expect([...base64ToBytes('aGVsbG8=')]).toEqual(bytesOf('hello'));
  });

  it('decodes input with no padding', () => {
    expect([...base64ToBytes('aGVsbG8')]).toEqual(bytesOf('hello'));
  });

  it('ignores the line breaks a data URI carries', () => {
    expect([...base64ToBytes('aGVs\nbG8=\r\n')]).toEqual(bytesOf('hello'));
  });

  it('answers an empty array for an empty string', () => {
    expect(base64ToBytes('')).toHaveLength(0);
  });

  it('decodes every byte value, which is what a JPEG actually is', () => {
    const all = Array.from({ length: 256 }, (_, index) => index);
    const base64 = btoa(String.fromCharCode(...all));

    expect([...base64ToBytes(base64)]).toEqual(all);
  });

  it('stops at the bytes it wrote, not at the padding', () => {
    // "a" is one byte: the encoder pads it to four characters.
    expect([...base64ToBytes('YQ==')]).toEqual(bytesOf('a'));
  });
});
