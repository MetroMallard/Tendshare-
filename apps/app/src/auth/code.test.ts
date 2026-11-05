import { describe, expect, it } from 'vitest';

import { digitsOnly, isCompleteCode, isPlausibleEmail, normaliseEmail } from './code';

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
