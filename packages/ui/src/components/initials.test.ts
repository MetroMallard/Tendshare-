import { describe, expect, it } from 'vitest';

import { initialsOf } from './initials';

/**
 * The avatar's letters. The one rule worth a test is the empty case: it used to
 * return "?", which put a lone question mark in a 72pt circle on the first
 * onboarding screen — the one screen where a person has not typed their name
 * yet and is most likely to think the app is broken.
 */
describe('initialsOf', () => {
  it('takes the first and last word', () => {
    expect(initialsOf('Margaret Chen')).toBe('MC');
    expect(initialsOf('Grace Adeyemi Jones')).toBe('GJ');
  });

  it('takes one letter from a single word', () => {
    expect(initialsOf('Margaret')).toBe('M');
  });

  it('ignores the spaces around and inside a name', () => {
    expect(initialsOf('  Sara   Jones  ')).toBe('SJ');
  });

  it('returns nothing at all for a blank name, never a "?"', () => {
    expect(initialsOf('')).toBe('');
    expect(initialsOf('   ')).toBe('');
  });
});
