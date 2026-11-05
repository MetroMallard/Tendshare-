import { describe, expect, it } from 'vitest';

import {
  decodeBase64Url,
  normaliseAnonKey,
  normaliseSupabaseUrl,
  readKeyRole,
  readSupabaseConfig,
} from './env';

/** A JWT-shaped key with a given role — not a real key, just the same shape. */
function keyWithRole(role: string): string {
  const payload = btoa(JSON.stringify({ iss: 'supabase', ref: 'project', role }))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');

  return `header.${payload}.signature`;
}

describe('readSupabaseConfig', () => {
  it('accepts an https project URL and an anon key', () => {
    const config = readSupabaseConfig({
      EXPO_PUBLIC_SUPABASE_URL: 'https://project.supabase.co/',
      EXPO_PUBLIC_SUPABASE_ANON_KEY: keyWithRole('anon'),
    });

    expect(config).not.toBeNull();
    // The trailing slash is dropped so path joins stay predictable.
    expect(config?.url).toBe('https://project.supabase.co');
  });

  it('is null when either value is missing, so the app can say so plainly', () => {
    expect(readSupabaseConfig({})).toBeNull();
    expect(
      readSupabaseConfig({ EXPO_PUBLIC_SUPABASE_URL: 'https://project.supabase.co' }),
    ).toBeNull();
    expect(readSupabaseConfig({ EXPO_PUBLIC_SUPABASE_ANON_KEY: keyWithRole('anon') })).toBeNull();
  });

  it('refuses a service role key: it must never reach a bundle', () => {
    const config = readSupabaseConfig({
      EXPO_PUBLIC_SUPABASE_URL: 'https://project.supabase.co',
      EXPO_PUBLIC_SUPABASE_ANON_KEY: keyWithRole('service_role'),
    });

    expect(config).toBeNull();
  });

  it('refuses plain http except on a local development stack', () => {
    const anon = keyWithRole('anon');

    expect(
      normaliseSupabaseUrl('http://project.supabase.co'),
      'http to a remote host is a downgrade',
    ).toBeNull();
    expect(normaliseSupabaseUrl('http://localhost:54321')).toBe('http://localhost:54321');
    expect(normaliseAnonKey(anon)).toBe(anon);
  });

  it('accepts the new-style publishable key', () => {
    expect(normaliseAnonKey('sb_publishable_abc123')).toBe('sb_publishable_abc123');
    expect(normaliseAnonKey('not-a-key')).toBeNull();
  });
});

describe('readKeyRole', () => {
  it('reads the role claim, and gives up quietly on anything else', () => {
    expect(readKeyRole(keyWithRole('anon'))).toBe('anon');
    expect(readKeyRole('nonsense')).toBeNull();
    expect(readKeyRole('a.b.c')).toBeNull();
  });

  it('decodes base64url without relying on atob', () => {
    expect(decodeBase64Url('eyJhIjoxfQ')).toBe('{"a":1}');
  });
});
