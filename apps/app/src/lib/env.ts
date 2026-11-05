/**
 * The two values the app needs to talk to Supabase, read once and validated.
 *
 * Both are public: the project URL and the *publishable* (anon) key. They ship
 * inside every install of the app, and they grant exactly what Row Level
 * Security allows an anonymous visitor — nothing more. The service role key is
 * never here, never in a `.env` file in this repo, and never in a bundle: it
 * lives on the server only. `readSupabaseConfig` refuses a key that carries the
 * `service_role` claim, so a copy-paste mistake fails loudly instead of shipping
 * a key that bypasses every policy.
 *
 * Expo inlines `EXPO_PUBLIC_*` variables at build time, so these are read with
 * literal property access and no dynamic lookup.
 */

export const SUPABASE_URL_VAR = 'EXPO_PUBLIC_SUPABASE_URL';
export const SUPABASE_ANON_KEY_VAR = 'EXPO_PUBLIC_SUPABASE_ANON_KEY';

export interface SupabaseConfig {
  readonly url: string;
  readonly anonKey: string;
}

export interface EnvRecord {
  readonly [key: string]: string | undefined;
}

const BASE64_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

/**
 * base64url → text, in plain JavaScript.
 *
 * `atob` is not guaranteed on every JavaScript engine React Native runs on, and
 * this has to work identically on iOS, Android, web and in the test runner.
 */
export function decodeBase64Url(input: string): string {
  const cleaned = input.replace(/-/g, '+').replace(/_/g, '/').replace(/=+$/, '');
  let bits = 0;
  let value = 0;
  const bytes: number[] = [];

  for (const character of cleaned) {
    const index = BASE64_ALPHABET.indexOf(character);
    if (index === -1) {
      continue;
    }

    value = (value << 6) | index;
    bits += 6;

    if (bits >= 8) {
      bits -= 8;
      bytes.push((value >> bits) & 0xff);
    }
  }

  return bytes.map((byte) => String.fromCharCode(byte)).join('');
}

/** The claim inside a Supabase key JWT, or null when it is not a JWT. */
export function readKeyRole(key: string): string | null {
  const parts = key.split('.');
  if (parts.length !== 3) {
    return null;
  }

  try {
    const decoded = JSON.parse(decodeBase64Url(parts[1])) as unknown;

    if (typeof decoded !== 'object' || decoded === null) {
      return null;
    }

    const role = (decoded as { role?: unknown }).role;
    return typeof role === 'string' ? role : null;
  } catch {
    return null;
  }
}

function isLocalHost(hostname: string): boolean {
  return hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '[::1]';
}

/**
 * A project URL we can actually use: https everywhere, http only for a local
 * development stack. A trailing slash is removed so path joins stay predictable.
 */
export function normaliseSupabaseUrl(value: string): string | null {
  const trimmed = value.trim();
  if (trimmed.length === 0) {
    return null;
  }

  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    return null;
  }

  if (parsed.protocol !== 'https:' && !(parsed.protocol === 'http:' && isLocalHost(parsed.hostname))) {
    return null;
  }

  return `${parsed.origin}`;
}

/**
 * The publishable key, if it is safe to ship.
 *
 * New-style keys (`sb_publishable_…`) are accepted. A legacy JWT is accepted
 * only when its role is `anon` — a `service_role` key is refused outright.
 */
export function normaliseAnonKey(value: string): string | null {
  const trimmed = value.trim();
  if (trimmed.length === 0) {
    return null;
  }

  if (trimmed.startsWith('sb_publishable_')) {
    return trimmed;
  }

  const role = readKeyRole(trimmed);
  if (role === null) {
    return null;
  }

  return role === 'anon' ? trimmed : null;
}

/**
 * The configuration, or `null` when this build has not been given one.
 *
 * `null` is a real, handled state: the sign-in screen says plainly that sign-in
 * is not set up yet rather than showing a button that cannot work.
 */
export function readSupabaseConfig(env: EnvRecord): SupabaseConfig | null {
  const rawUrl = env[SUPABASE_URL_VAR];
  const rawKey = env[SUPABASE_ANON_KEY_VAR];

  if (typeof rawUrl !== 'string' || typeof rawKey !== 'string') {
    return null;
  }

  const url = normaliseSupabaseUrl(rawUrl);
  const anonKey = normaliseAnonKey(rawKey);

  return url && anonKey ? { url, anonKey } : null;
}

export const supabaseConfig: SupabaseConfig | null = readSupabaseConfig({
  EXPO_PUBLIC_SUPABASE_URL: process.env.EXPO_PUBLIC_SUPABASE_URL,
  EXPO_PUBLIC_SUPABASE_ANON_KEY: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY,
});
