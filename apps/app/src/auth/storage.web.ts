/**
 * Where the session lives in a browser: `localStorage`, scoped to the origin.
 *
 * The web has no keychain, so this is the honest floor — the same place every
 * web app keeps a session cookie's worth of state. It is why the web build is
 * the *shared family view* and the phone is where the app is really used: a
 * shared or family computer can be signed out from the More tab in one tap, and
 * signing out removes this key entirely.
 *
 * Metro picks this file over `storage.ts` on web, so `expo-secure-store` never
 * reaches a browser bundle.
 */
export interface AuthStorage {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
}

function store(): Storage | null {
  try {
    // Safari in private mode throws on access rather than on write.
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
}

export const secureAuthStorage: AuthStorage = {
  async getItem(key) {
    return store()?.getItem(key) ?? null;
  },
  async setItem(key, value) {
    store()?.setItem(key, value);
  },
  async removeItem(key) {
    store()?.removeItem(key);
  },
};
