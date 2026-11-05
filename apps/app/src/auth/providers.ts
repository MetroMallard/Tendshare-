/**
 * The sign-in provider list, and how each one's availability is decided.
 *
 * There are three different questions, and keeping them apart is the whole
 * point of this file:
 *
 *   * **built** — is the flow written in this build of the app? Apple is not:
 *     the owner has no Apple Developer account yet, so its entry sits here with
 *     `built: false` and no button is drawn. Adding Apple later is: flip that
 *     flag, add the `apple` case to `src/auth/providerFlow.ts`, and turn the
 *     provider on in the Supabase dashboard. Nothing else on this screen moves.
 *   * **enabled** — has the Supabase project switched the provider on? That is
 *     a live answer from `GET /auth/v1/settings`, read with the public key, so
 *     the button reflects reality instead of hope. Google is **not** enabled
 *     yet; the screen says so in words rather than showing a button that fails.
 *   * **status** — the two combined, which is what the UI renders.
 */

export type AuthProviderId = 'google' | 'apple';

export interface AuthProviderDefinition {
  readonly id: AuthProviderId;
  readonly name: string;
  /** The button's words. "Continue with", never "Sign in with" — nobody is
   * creating an account here, they are picking up where they left off. */
  readonly label: string;
  readonly built: boolean;
  /** Where the flow lives, for the one-line change described above. */
  readonly flow: 'oauth';
}

/**
 * Order matters: this is the order of the buttons under the email field.
 * Adding a provider is one entry here.
 */
export const AUTH_PROVIDERS: readonly AuthProviderDefinition[] = [
  { id: 'google', name: 'Google', label: 'Continue with Google', built: true, flow: 'oauth' },
  // Apple: one entry, `built: false` until the owner has an Apple Developer
  // account. Flip to `true` and add the case in providerFlow.ts.
  { id: 'apple', name: 'Apple', label: 'Continue with Apple', built: false, flow: 'oauth' },
];

export type ProviderStatus =
  /** Not implemented in this build — never drawn. */
  | 'unbuilt'
  /** Settings not read yet: show a placeholder, not a guess. */
  | 'checking'
  /** The project has it on and the app can run the flow. */
  | 'enabled'
  /** The project has it off: say so kindly, point at email. */
  | 'disabled'
  /** Settings could not be read at all: treat as unavailable, say so. */
  | 'unknown';

export interface ExternalProviderSettings {
  readonly google: boolean;
  readonly apple: boolean;
}

/**
 * Read the `external` block from `/auth/v1/settings`.
 *
 * Anything unexpected is `false`: the app must never draw a working button on a
 * guess. The payload is untrusted input from the network, so every field is
 * checked rather than cast.
 */
export function readExternalProviders(payload: unknown): ExternalProviderSettings {
  if (typeof payload !== 'object' || payload === null) {
    return { google: false, apple: false };
  }

  const external = (payload as { external?: unknown }).external;
  if (typeof external !== 'object' || external === null) {
    return { google: false, apple: false };
  }

  const record = external as Record<string, unknown>;

  return {
    google: record.google === true,
    apple: record.apple === true,
  };
}

export function statusOf(
  definition: AuthProviderDefinition,
  settings: ExternalProviderSettings | null,
): ProviderStatus {
  if (!definition.built) {
    return 'unbuilt';
  }

  if (settings === null) {
    return 'checking';
  }

  return settings[definition.id] ? 'enabled' : 'disabled';
}

export interface ProviderView {
  readonly id: AuthProviderId;
  readonly name: string;
  readonly label: string;
  readonly status: ProviderStatus;
}

/** The providers worth drawing, in order, with their live status. */
export function providerViews(settings: ExternalProviderSettings | null): ProviderView[] {
  return AUTH_PROVIDERS.filter((definition) => definition.built).map((definition) => ({
    id: definition.id,
    name: definition.name,
    label: definition.label,
    status: statusOf(definition, settings),
  }));
}

export function findProvider(id: AuthProviderId): AuthProviderDefinition | null {
  return AUTH_PROVIDERS.find((definition) => definition.id === id) ?? null;
}

/** The URL of the project's public auth settings — no key beyond the anon key. */
export function authSettingsUrl(projectUrl: string): string {
  return `${projectUrl.replace(/\/$/, '')}/auth/v1/settings`;
}
