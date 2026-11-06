import { describe, expect, it } from 'vitest';

import {
  DISPLAY_NAME_MAX,
  MAX_INVITES,
  RECIPIENT_NAME_MAX,
  addInvite,
  checkDisplayName,
  checkRecipientName,
  cleanText,
  inviteProblemMessage,
  isRelationship,
  removeInvite,
  textProblemMessage,
} from './validation';

describe('cleaning what a phone types', () => {
  it('trims and collapses whitespace', () => {
    expect(cleanText('  Mary   Ann ')).toBe('Mary Ann');
    expect(cleanText('Sara\n')).toBe('Sara');
    expect(cleanText('   ')).toBe('');
  });
});

describe('the display name', () => {
  it('accepts an ordinary name, trimmed', () => {
    expect(checkDisplayName('  Sara  ')).toEqual({ ok: true, value: 'Sara' });
    expect(checkDisplayName('Mary Ann Jones')).toEqual({ ok: true, value: 'Mary Ann Jones' });
  });

  it('refuses an empty one — the database would too', () => {
    expect(checkDisplayName('')).toEqual({ ok: false, problem: 'required' });
    expect(checkDisplayName('    ')).toEqual({ ok: false, problem: 'required' });
  });

  it('refuses one longer than the column allows', () => {
    const tooLong = 'a'.repeat(DISPLAY_NAME_MAX + 1);
    expect(checkDisplayName(tooLong)).toEqual({ ok: false, problem: 'too_long' });
    expect(checkDisplayName('a'.repeat(DISPLAY_NAME_MAX)).ok).toBe(true);
  });

  it('explains a problem in a sentence a person can act on', () => {
    expect(textProblemMessage('required', 'your name')).toBe('Please add your name.');
    expect(textProblemMessage('required', 'their name')).toBe('Please add their name.');
    expect(textProblemMessage('too_long', 'their name')).toContain(String(RECIPIENT_NAME_MAX));
    expect(textProblemMessage('too_long', 'your name')).toContain(String(DISPLAY_NAME_MAX));
  });
});

describe('the person being cared for', () => {
  it('takes a first name on its own', () => {
    expect(checkRecipientName('Margaret')).toEqual({ ok: true, value: 'Margaret' });
  });

  it('has the column’s own limit, which is higher than the display name', () => {
    expect(RECIPIENT_NAME_MAX).toBe(120);
    expect(checkRecipientName('a'.repeat(RECIPIENT_NAME_MAX)).ok).toBe(true);
    expect(checkRecipientName('a'.repeat(RECIPIENT_NAME_MAX + 1)).ok).toBe(false);
  });

  it('is required', () => {
    expect(checkRecipientName('')).toEqual({ ok: false, problem: 'required' });
  });
});

describe('the relationship picker', () => {
  it('offers the five words from the brief', () => {
    expect(isRelationship('Mother')).toBe(true);
    expect(isRelationship('Grandparent')).toBe(true);
    expect(isRelationship('Other')).toBe(true);
  });

  it('rejects anything else, including near-misses', () => {
    expect(isRelationship('mother')).toBe(false);
    expect(isRelationship('Aunt')).toBe(false);
    expect(isRelationship(null)).toBe(false);
  });
});

describe('invite addresses', () => {
  it('adds a plausible address, lower-cased', () => {
    const result = addInvite([], '  Sara@Example.com ');
    expect(result).toEqual({ ok: true, addresses: ['sara@example.com'] });
  });

  it('does not mutate the list it was given', () => {
    const original = ['a@example.com'];
    const result = addInvite(original, 'b@example.com');
    expect(original).toEqual(['a@example.com']);
    expect(result.ok && result.addresses).toEqual(['a@example.com', 'b@example.com']);
  });

  it('refuses a typo rather than storing it', () => {
    expect(addInvite([], 'sara@example')).toEqual({ ok: false, problem: 'invalid' });
    expect(addInvite([], '')).toEqual({ ok: false, problem: 'invalid' });
  });

  it('refuses the same address twice', () => {
    expect(addInvite(['sara@example.com'], 'SARA@example.com')).toEqual({
      ok: false,
      problem: 'duplicate',
    });
  });

  it('stops at the cap', () => {
    const full = Array.from(
      { length: MAX_INVITES },
      (_, index) => `person${String(index)}@example.com`,
    );
    expect(addInvite(full, 'extra@example.com')).toEqual({ ok: false, problem: 'full' });
  });

  it('removes exactly one address', () => {
    expect(removeInvite(['a@example.com', 'b@example.com'], 'a@example.com')).toEqual([
      'b@example.com',
    ]);
    expect(removeInvite(['a@example.com'], 'nobody@example.com')).toEqual(['a@example.com']);
  });

  it('has a plain sentence for every problem', () => {
    for (const problem of ['invalid', 'duplicate', 'full'] as const) {
      expect(inviteProblemMessage(problem).length).toBeGreaterThan(10);
    }
  });
});
