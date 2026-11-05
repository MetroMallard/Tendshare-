/**
 * One session, one place.
 *
 * Everything about being signed in lives here, so no screen has to know how a
 * token is stored, refreshed or thrown away:
 *
 *   * **Restore on launch.** `getSession()` reads the stored session back out of
 *     the keychain (native) or `localStorage` (web). Until that resolves the app
 *     shows a calm loading screen, never the sign-in form — a signed-in person
 *     must not be asked to sign in again while the answer is still arriving.
 *   * **Refresh on expiry.** `autoRefreshToken` is on, and this provider pauses
 *     and resumes it around the app going to the background and coming back,
 *     which is where a phone's timer stops and a token quietly goes stale.
 *   * **Sign out for real.** The server-side session is revoked, the local
 *     session is dropped, and the cached profile and the half-finished email
 *     are cleared. Nothing about the person is left in memory.
 *
 * The provider never logs. A failure becomes an `AuthFailure` — a sentence for
 * the person reading it — and the raw error is dropped on the floor, because
 * GoTrue's messages can echo the address that was typed.
 */
import type { Session, SupabaseClient, User } from '@supabase/supabase-js';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type PropsWithChildren,
} from 'react';
import { AppState } from 'react-native';

import { supabaseConfig } from '../lib/env';
import { getSupabaseClient } from '../lib/supabase';
import { useIsOnline } from '../lib/online';
import { digitsOnly, isCompleteCode, isPlausibleEmail, normaliseEmail } from './code';
import { describeAuthFailure, failureOf, type AuthFailure } from './errors';
import { runProviderFlow } from './providerFlow';
import {
  authSettingsUrl,
  findProvider,
  providerViews,
  readExternalProviders,
  type AuthProviderId,
  type ExternalProviderSettings,
  type ProviderView,
} from './providers';

export type SessionStatus =
  /** Reading the stored session. Show a loading screen, not the sign-in form. */
  | 'loading'
  | 'signedOut'
  | 'signedIn'
  /** This build has no Supabase configuration. Sign-in cannot work at all. */
  | 'notConfigured';

export type AuthResult = { readonly ok: true } | { readonly ok: false; readonly failure: AuthFailure };

function failed(kind: Parameters<typeof failureOf>[0]): AuthResult {
  return { ok: false, failure: failureOf(kind) };
}

export interface SessionValue {
  readonly status: SessionStatus;
  readonly session: Session | null;
  readonly user: User | null;
  /** From `profiles`, written by the on-signup trigger. Null while loading. */
  readonly displayName: string | null;
  readonly isOffline: boolean;
  /** The address a code was just sent to. Never persisted, never logged. */
  readonly pendingEmail: string | null;
  readonly providers: readonly ProviderView[];
  readonly providersLoading: boolean;
  readonly signInWithEmailCode: (email: string) => Promise<AuthResult>;
  readonly verifyEmailCode: (email: string, code: string) => Promise<AuthResult>;
  readonly resendEmailCode: (email: string) => Promise<AuthResult>;
  readonly continueWithProvider: (id: AuthProviderId) => Promise<AuthResult>;
  readonly signOut: () => Promise<void>;
  readonly clearPendingEmail: () => void;
  readonly refreshProviders: () => void;
}

const SessionContext = createContext<SessionValue | null>(null);

interface ProfileRow {
  readonly display_name: string | null;
}

export interface SessionProviderProps {
  /** Injected by the hidden auth preview; the app uses the real client. */
  readonly client?: SupabaseClient | null;
}

export function SessionProvider({ children, client }: PropsWithChildren<SessionProviderProps>) {
  const supabase = client === undefined ? getSupabaseClient() : client;
  const isOffline = !useIsOnline();

  const [status, setStatus] = useState<SessionStatus>(supabase ? 'loading' : 'notConfigured');
  const [session, setSession] = useState<Session | null>(null);
  const [displayName, setDisplayName] = useState<string | null>(null);
  const [pendingEmail, setPendingEmail] = useState<string | null>(null);
  const [settings, setSettings] = useState<ExternalProviderSettings | null>(null);
  const [providersLoading, setProvidersLoading] = useState(supabase !== null);
  const [providerRequest, setProviderRequest] = useState(0);

  const applySession = useCallback((next: Session | null) => {
    setSession(next);
    setStatus(next ? 'signedIn' : 'signedOut');
  }, []);

  // ---- Restore, and follow every change Supabase reports --------------------
  useEffect(() => {
    if (!supabase) {
      setStatus('notConfigured');
      return;
    }

    let cancelled = false;

    void supabase.auth
      .getSession()
      .then(({ data, error }) => {
        if (cancelled) {
          return;
        }

        // An unreadable stored session is the same as no session: sign in again.
        applySession(error ? null : data.session);
      })
      .catch(() => {
        if (!cancelled) {
          applySession(null);
        }
      });

    const { data } = supabase.auth.onAuthStateChange((_event, next) => {
      applySession(next);
    });

    return () => {
      cancelled = true;
      data.subscription.unsubscribe();
    };
  }, [supabase, applySession]);

  // ---- Refresh across backgrounding ----------------------------------------
  useEffect(() => {
    if (!supabase) {
      return;
    }

    const subscription = AppState.addEventListener('change', (next) => {
      if (next === 'active') {
        supabase.auth.startAutoRefresh();
        // A token may have expired while the app slept; this is the moment to
        // find out, not when the person taps something.
        void supabase.auth.getSession();
      } else {
        supabase.auth.stopAutoRefresh();
      }
    });

    return () => {
      subscription.remove();
    };
  }, [supabase]);

  // ---- The profile row the signup trigger created --------------------------
  const userId = session?.user.id ?? null;

  useEffect(() => {
    if (!supabase || userId === null) {
      setDisplayName(null);
      return;
    }

    let cancelled = false;

    void supabase
      .from('profiles')
      .select('display_name')
      .eq('id', userId)
      .maybeSingle<ProfileRow>()
      .then(({ data }) => {
        if (!cancelled) {
          setDisplayName(data?.display_name ?? null);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [supabase, userId]);

  // ---- Which providers this project actually has on -----------------------
  useEffect(() => {
    if (!supabase || supabaseConfig === null) {
      setProvidersLoading(false);
      return;
    }

    let cancelled = false;
    const controller = new AbortController();

    setProvidersLoading(true);

    void fetch(authSettingsUrl(supabaseConfig.url), {
      headers: { apikey: supabaseConfig.anonKey },
      signal: controller.signal,
    })
      .then((response) => (response.ok ? response.json() : null))
      .then((payload: unknown) => {
        if (cancelled) {
          return;
        }

        // A read that failed is not a provider that is on: never draw a button
        // on a guess.
        setSettings(
          payload === null ? { google: false, apple: false } : readExternalProviders(payload),
        );
      })
      .catch(() => {
        if (!cancelled) {
          setSettings({ google: false, apple: false });
        }
      })
      .finally(() => {
        if (!cancelled) {
          setProvidersLoading(false);
        }
      });

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [supabase, providerRequest]);

  // ---- Actions ------------------------------------------------------------
  const signInWithEmailCode = useCallback(
    async (email: string): Promise<AuthResult> => {
      if (!supabase) {
        return failed('not_configured');
      }

      const address = normaliseEmail(email);
      if (!isPlausibleEmail(address)) {
        return failed('email_invalid');
      }

      if (isOffline) {
        return failed('offline');
      }

      const { error } = await supabase.auth.signInWithOtp({
        email: address,
        options: {
          // A new address is a new family member, and asking them to make a
          // password on a phone in a hospital corridor is where people quit.
          shouldCreateUser: true,
          // No `emailRedirectTo`: the emailed code is the way in. Passing a
          // deep link here would make the whole call fail whenever that URL is
          // not on the project's allow list — and it would be no more useful.
        },
      });

      if (error) {
        return { ok: false, failure: describeAuthFailure(error, { offline: isOffline }) };
      }

      setPendingEmail(address);
      return { ok: true };
    },
    [supabase, isOffline],
  );

  const verifyEmailCode = useCallback(
    async (email: string, code: string): Promise<AuthResult> => {
      if (!supabase) {
        return failed('not_configured');
      }

      const address = normaliseEmail(email);
      const token = digitsOnly(code);

      if (!isCompleteCode(token)) {
        return failed('invalid_code');
      }

      if (isOffline) {
        return failed('offline');
      }

      const { data, error } = await supabase.auth.verifyOtp({
        email: address,
        token,
        type: 'email',
      });

      if (error) {
        return { ok: false, failure: describeAuthFailure(error, { offline: isOffline }) };
      }

      if (data.session) {
        applySession(data.session);
        setPendingEmail(null);
      }

      return { ok: true };
    },
    [supabase, isOffline, applySession],
  );

  const resendEmailCode = useCallback(
    (email: string) => signInWithEmailCode(email),
    [signInWithEmailCode],
  );

  const continueWithProvider = useCallback(
    async (id: AuthProviderId): Promise<AuthResult> => {
      const definition = findProvider(id);
      if (!supabase || !definition || !definition.built) {
        return failed('provider_unavailable');
      }

      const view = providerViews(settings).find((candidate) => candidate.id === id);
      if (view?.status !== 'enabled') {
        return failed('provider_unavailable');
      }

      if (isOffline) {
        return failed('offline');
      }

      const result = await runProviderFlow(supabase, id);

      switch (result.status) {
        case 'signed-in':
        case 'redirecting':
          return { ok: true };
        case 'cancelled':
          return failed('provider_cancelled');
        case 'failed':
          return { ok: false, failure: describeAuthFailure(result.error, { offline: isOffline }) };
        default:
          return failed('unknown');
      }
    },
    [supabase, settings, isOffline],
  );

  const signOut = useCallback(async (): Promise<void> => {
    // Clear what is on this device first: if the network call fails, the person
    // is still signed out here, which is the half that matters for privacy.
    setSession(null);
    setDisplayName(null);
    setPendingEmail(null);
    setStatus(supabase ? 'signedOut' : 'notConfigured');

    if (!supabase) {
      return;
    }

    try {
      // Global scope: every refresh token for this account is revoked, so a
      // session left open on a lost phone or a shared browser dies too.
      const { error } = await supabase.auth.signOut();
      if (error) {
        await supabase.auth.signOut({ scope: 'local' });
      }
    } catch {
      await supabase.auth.signOut({ scope: 'local' }).catch(() => undefined);
    }
  }, [supabase]);

  const clearPendingEmail = useCallback(() => setPendingEmail(null), []);
  const refreshProviders = useCallback(() => setProviderRequest((count) => count + 1), []);

  const value = useMemo<SessionValue>(
    () => ({
      status,
      session,
      user: session?.user ?? null,
      displayName,
      isOffline,
      pendingEmail,
      providers: providerViews(settings),
      providersLoading,
      signInWithEmailCode,
      verifyEmailCode,
      resendEmailCode,
      continueWithProvider,
      signOut,
      clearPendingEmail,
      refreshProviders,
    }),
    [
      status,
      session,
      displayName,
      isOffline,
      pendingEmail,
      settings,
      providersLoading,
      signInWithEmailCode,
      verifyEmailCode,
      resendEmailCode,
      continueWithProvider,
      signOut,
      clearPendingEmail,
      refreshProviders,
    ],
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): SessionValue {
  const value = useContext(SessionContext);

  if (value === null) {
    throw new Error('useSession must be used inside <SessionProvider>.');
  }

  return value;
}
