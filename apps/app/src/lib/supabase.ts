/**
 * The one Supabase client the app uses.
 *
 * Session handling, in one place:
 *   * `persistSession` writes the session through `secureAuthStorage` — the
 *     keychain on a phone, `localStorage` on the web. Never `AsyncStorage`.
 *   * `autoRefreshToken` refreshes the access token before it expires, and the
 *     session provider pauses and resumes that around app backgrounding.
 *   * `detectSessionInUrl` is on for the web only: it is how an OAuth redirect
 *     comes back (`?code=…`) and turns into a session without a screen.
 *   * `flowType: 'pkce'` everywhere, so the native Google flow can exchange a
 *     code without ever putting a token in a deep link.
 *
 * `getSupabaseClient()` returns `null` when this build has no configuration.
 * Callers handle that as a state, not as a crash.
 */
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { Platform } from 'react-native';

import { supabaseConfig, type SupabaseConfig } from '../lib/env';
import { secureAuthStorage } from './storage';

let cached: SupabaseClient | null = null;
let cachedFor: SupabaseConfig | null = null;

export function createSupabaseClient(config: SupabaseConfig): SupabaseClient {
  return createClient(config.url, config.anonKey, {
    auth: {
      storage: secureAuthStorage,
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: Platform.OS === 'web',
      flowType: 'pkce',
    },
    global: {
      headers: { 'x-application-name': 'tendshare-app' },
    },
  });
}

export function getSupabaseClient(): SupabaseClient | null {
  if (supabaseConfig === null) {
    return null;
  }

  if (cached === null || cachedFor !== supabaseConfig) {
    cached = createSupabaseClient(supabaseConfig);
    cachedFor = supabaseConfig;
  }

  return cached;
}
