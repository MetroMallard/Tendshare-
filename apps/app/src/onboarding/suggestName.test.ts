import { describe, expect, it } from 'vitest';

import { prettifyEmailLocalPart, suggestDisplayName } from './suggestName';

describe('tidying an email address into a name', () => {
  it('turns separators into words', () => {
    expect(prettifyEmailLocalPart('sara.jones')).toBe('Sara Jones');
    expect(prettifyEmailLocalPart('sara_jones')).toBe('Sara Jones');
    expect(prettifyEmailLocalPart('sara-jones')).toBe('Sara Jones');
  });

  it('drops the parts of an address that are a mailbox, not a name', () => {
    expect(prettifyEmailLocalPart('sara.jones99')).toBe('Sara Jones');
    // `+` addressing is a filter on one inbox, not a second person.
    expect(prettifyEmailLocalPart('sara+jones')).toBe('Sara');
  });

  it('keeps a single word readable', () => {
    expect(prettifyEmailLocalPart('SARA')).toBe('Sara');
    expect(prettifyEmailLocalPart('m')).toBe('M');
  });

  it('gives up rather than inventing something', () => {
    expect(prettifyEmailLocalPart('')).toBe('');
    expect(prettifyEmailLocalPart('123456')).toBe('');
    expect(prettifyEmailLocalPart('a@b.com')).toBe('A');
  });
});

describe('what to prefill on screen 1', () => {
  it('prefers the name the identity provider gave us', () => {
    expect(
      suggestDisplayName({
        profileName: 'someone',
        metadata: { full_name: 'Sara Jones' },
        email: 'sara.jones@example.com',
      }),
    ).toBe('Sara Jones');
  });

  it('falls back to the provider’s second field, then the profile', () => {
    expect(suggestDisplayName({ metadata: { name: 'Sara Jones' } })).toBe('Sara Jones');
    expect(suggestDisplayName({ profileName: 'Sara Jones' })).toBe('Sara Jones');
  });

  it('ignores the placeholder the signup trigger writes', () => {
    expect(suggestDisplayName({ profileName: 'Someone', email: 'sara.jones@example.com' })).toBe(
      'Sara Jones',
    );
  });

  it('falls back to the email address when there is nothing else', () => {
    expect(suggestDisplayName({ email: 'sara.jones@example.com' })).toBe('Sara Jones');
  });

  it('suggests nothing rather than a wrong name', () => {
    expect(suggestDisplayName({})).toBe('');
    expect(suggestDisplayName({ metadata: {}, profileName: null, email: null })).toBe('');
  });

  it('never exceeds the column limit', () => {
    const long = 'a'.repeat(200);
    expect(suggestDisplayName({ profileName: long }).length).toBeLessThanOrEqual(80);
  });
});
