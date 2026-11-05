/**
 * The OAuth flow, for both surfaces.
 *
 * **Web** — `signInWithOAuth` builds the provider URL and the browser leaves the
 * page. It comes back to this origin with `?code=…`, and because the client was
 * created with `detectSessionInUrl` and `flowType: 'pkce'`, supabase-js swaps
 * that code for a session during start-up. No screen is involved, and no token
 * ever appears in the URL.
 *
 * **Native** — the same call with `skipBrowserRedirect`, then
 * `WebBrowser.openAuthSessionAsync` opens the provider in the system auth sheet
 * and waits for the deep link back (`tendshare://auth/callback?code=…`). The
 * code is exchanged in the app; the refresh token is written straight to the
 * keychain and never travels through a URL or another app.
 *
 * Both halves are the PKCE flow, which is what makes the deep link safe: the
 * code is useless without the verifier that stayed on the device.
 *
 * If the Supabase project has not enabled the provider, this returns a
 * `provider_unavailable` failure and the screen says so in words. It never
 * opens a browser to a page that cannot work.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { makeRedirectUri } from 'expo-auth-session';
import * as WebBrowser from 'expo-web-browser';
import { Platform } from 'react-native';

import type { AuthProviderId } from './providers';

/** Closes the auth sheet if the page was reloaded mid-flow. No-op on web. */
if (Platform.OS !== 'web') {
  WebBrowser.maybeCompleteAuthSession();
}

export type ProviderFlowResult =
  /** Native: the session is established. */
  | { readonly status: 'signed-in' }
  /** Web: the browser is navigating to the provider. Nothing more to do here. */
  | { readonly status: 'redirecting' }
  /** The person closed the sheet. Not an error, and worth no alarm. */
  | { readonly status: 'cancelled' }
  | { readonly status: 'failed'; readonly error: unknown };

/**
 * Where the provider sends the person back to.
 *
 * Web returns to the origin, which is the address the Supabase project's Site
 * URL is set to — so it works with no extra dashboard configuration. Native
 * returns to this app's own scheme.
 */
export function authRedirectUrl(): string {
  if (Platform.OS === 'web') {
    return `${window.location.origin}/`;
  }

  return makeRedirectUri({ scheme: 'tendshare', path: 'auth/callback' });
}

/** The `code` in a returned deep link, or null. */
export function readCodeFromUrl(url: string): string | null {
  const query = url.includes('?') ? url.slice(url.indexOf('?') + 1) : '';
  const withoutHash = query.split('#')[0] ?? '';
  const params = new URLSearchParams(withoutHash);
  const code = params.get('code');

  return code && code.length > 0 ? code : null;
}

/**
 * The provider's own refusal, in the return URL rather than as an HTTP error:
 * `?error=access_denied`. Mapped to a cancellation, which is not a failure the
 * person needs to read about twice.
 */
export function readErrorFromUrl(url: string): string | null {
  const query = url.includes('?') ? url.slice(url.indexOf('?') + 1) : '';
  const params = new URLSearchParams(query.split('#')[0] ?? '');
  const error = params.get('error');

  return error && error.length > 0 ? error : null;
}

export async function runProviderFlow(
  client: SupabaseClient,
  provider: AuthProviderId,
): Promise<ProviderFlowResult> {
  const redirectTo = authRedirectUrl();

  const started = await client.auth.signInWithOAuth({
    provider,
    options: {
      redirectTo,
      skipBrowserRedirect: Platform.OS !== 'web',
      // Let someone pick the account they keep their family in, rather than the
      // one their browser last happened to use.
      queryParams: provider === 'google' ? { prompt: 'select_account' } : undefined,
    },
  });

  if (started.error) {
    return { status: 'failed', error: started.error };
  }

  if (Platform.OS === 'web') {
    return { status: 'redirecting' };
  }

  if (!started.data.url) {
    return { status: 'failed', error: new Error('no provider url') };
  }

  const sheet = await WebBrowser.openAuthSessionAsync(started.data.url, redirectTo);

  if (sheet.type === 'cancel' || sheet.type === 'dismiss') {
    return { status: 'cancelled' };
  }

  if (sheet.type !== 'success') {
    return { status: 'failed', error: new Error('the sign-in sheet closed early') };
  }

  const refusal = readErrorFromUrl(sheet.url);
  if (refusal) {
    return refusal === 'access_denied'
      ? { status: 'cancelled' }
      : { status: 'failed', error: new Error(refusal) };
  }

  const code = readCodeFromUrl(sheet.url);
  if (!code) {
    return { status: 'failed', error: new Error('no code in the return link') };
  }

  const exchanged = await client.auth.exchangeCodeForSession(code);
  if (exchanged.error) {
    return { status: 'failed', error: exchanged.error };
  }

  return { status: 'signed-in' };
}
