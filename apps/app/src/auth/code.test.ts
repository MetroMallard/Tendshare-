import { describe, expect, it } from 'vitest';

import {
  CODE_PLACEHOLDER,
  digitsOnly,
  isCompleteCode,
  isPlausibleEmail,
  normaliseEmail,
} from './code';

/**
 * The hint in an empty code field. `123456` was a *value* sitting in a field
 * that looked filled in, above a disabled "Sign in" — the screen read as broken
 * before anyone had typed a character.
 */
describe('the code placeholder', () => {
  it('carries no digits, so it cannot read as a code already typed', () => {
    expect(CODE_PLACEHOLDER).not.toMatch(/\d/);
  });

  it('describes the shape of the answer in words', () => {
    expect(CODE_PLACEHOLDER.toLowerCase()).toContain('digit');
  });
});

describe('email', () => {
  it('normalises case and stray spaces', () => {
    expect(normaliseEmail('  Sara@Example.COM ')).toBe('sara@example.com');
  });

  it('accepts the addresses families actually have', () => {
    for (const email of [
      'sara@example.com',
      'sara.oconnor+care@example.co.uk',
      'j_1984@mail.example.org',
      "o'brien@example.ie",
    ]) {
      expect(isPlausibleEmail(email), email).toBe(true);
    }
  });

  it('rejects the shapes that are always a typo', () => {
    for (const email of [
      '',
      'sara',
      'sara@',
      '@example.com',
      'sara@example',
      'sa ra@example.com',
    ]) {
      expect(isPlausibleEmail(email), email).toBe(false);
    }
  });
});

describe('the emailed code', () => {
  it('keeps digits only, so a paste from a mail client still works', () => {
    expect(digitsOnly(' 123 456 ')).toBe('123456');
    expect(digitsOnly('123-456')).toBe('123456');
    expect(digitsOnly('code: 4821')).toBe('4821');
  });

  it('never grows past the code length', () => {
    expect(digitsOnly('1234567890')).toBe('12345678');
  });

  it('is complete at any length the project could mint', () => {
    expect(isCompleteCode('12345')).toBe(false);
    expect(isCompleteCode('123456')).toBe(true);
    // The hosted project mints eight digits today, so six is not enough.
    expect(isCompleteCode('12345678')).toBe(true);
    expect(isCompleteCode('123456789')).toBe(false);
    expect(isCompleteCode('')).toBe(false);
  });
});
