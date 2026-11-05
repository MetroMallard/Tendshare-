/**
 * The sign-in provider list, and the three questions it answers separately:
 * is the flow built, has the project switched the provider on, and what should
 * the screen therefore draw.
 *
 * The failure that matters is drawing a working Google button on a guess. Every
 * path that cannot read the project's settings must land on "unavailable", never
 * on "enabled" — a dead button is a support email, and for this audience a lost
 * person.
 */
import { describe, expect, it } from 'vitest';

import {
  AUTH_PROVIDERS,
  authSettingsUrl,
  findProvider,
  providerViews,
  readExternalProviders,
  statusOf,
  type ExternalProviderSettings,
} from './providers';

const BOTH_OFF: ExternalProviderSettings = { google: false, apple: false };

describe('the provider list', () => {
  it('has Google built and Apple present but not built', () => {
    const google = findProvider('google');
    const apple = findProvider('apple');

    expect(google?.built).toBe(true);
    // The owner has no Apple Developer account yet: the entry stays, the button
    // does not appear.
    expect(apple).not.toBeNull();
    expect(apple?.built).toBe(false);
    expect(apple?.name).toBe('Apple');
  });

  it('draws only the providers whose flow exists', () => {
    const views = providerViews(BOTH_OFF);

    expect(views.map((view) => view.id)).toEqual(['google']);
    expect(views.some((view) => view.id === 'apple')).toBe(false);
  });

  it('keeps the button words to "Continue with", never "Sign in with"', () => {
    for (const provider of AUTH_PROVIDERS) {
      expect(provider.label).toBe(`Continue with ${provider.name}`);
    }
  });
});

describe('reading the project settings', () => {
  it('reports Google off when the project reports it off', () => {
    expect(readExternalProviders({ external: { google: false, apple: false } })).toEqual({
      google: false,
      apple: false,
    });
  });

  it('reports Google on only when the project says so plainly', () => {
    expect(readExternalProviders({ external: { google: true, apple: false } })).toEqual({
      google: true,
      apple: false,
    });
  });

  it('treats a failed read as unavailable, never as enabled', () => {
    // Everything the network can hand back when it does not work: no payload,
    // an error body, a string, an empty object, a settings object with no
    // `external` block at all.
    const failures: unknown[] = [
      null,
      undefined,
      'Service Unavailable',
      {},
      { error: 'not found' },
      { external: null },
      { external: 'google' },
    ];

    for (const payload of failures) {
      expect(readExternalProviders(payload)).toEqual(BOTH_OFF);
    }
  });

  it('does not accept a truthy value as a yes', () => {
    // The payload is untrusted input: only a real boolean `true` counts.
    expect(readExternalProviders({ external: { google: 'true', apple: 1 } })).toEqual(BOTH_OFF);
  });
});

describe('the status the screen renders', () => {
  const google = AUTH_PROVIDERS[0]!;
  const apple = AUTH_PROVIDERS[1]!;

  it('is "checking" before the settings have been read', () => {
    expect(statusOf(google, null)).toBe('checking');
  });

  it('is "disabled" when the project has Google off', () => {
    expect(statusOf(google, BOTH_OFF)).toBe('disabled');
    expect(providerViews(BOTH_OFF)[0]?.status).toBe('disabled');
  });

  it('is "enabled" only when the project has it on', () => {
    expect(statusOf(google, { google: true, apple: false })).toBe('enabled');
  });

  it('is "unbuilt" for Apple whatever the project says', () => {
    expect(statusOf(apple, BOTH_OFF)).toBe('unbuilt');
    expect(statusOf(apple, { google: true, apple: true })).toBe('unbuilt');
    expect(statusOf(apple, null)).toBe('unbuilt');
  });

  it('never shows an enabled provider that the settings could not confirm', () => {
    const unread = readExternalProviders(undefined);
    expect(statusOf(google, unread)).not.toBe('enabled');
  });
});

describe('the settings URL', () => {
  it('points at the project auth settings with no double slash', () => {
    expect(authSettingsUrl('https://project.supabase.co')).toBe(
      'https://project.supabase.co/auth/v1/settings',
    );
    expect(authSettingsUrl('https://project.supabase.co/')).toBe(
      'https://project.supabase.co/auth/v1/settings',
    );
  });
});
