/**
 * Where a half-finished onboarding lives in a browser: `localStorage`, scoped to
 * the origin.
 *
 * The honest floor, exactly as `src/auth/storage.web.ts` is for the session. The
 * web build is the shared family view; a browser tab closed mid-setup should
 * reopen with the answers still there, and the draft is removed the moment the
 * circle is created or the person presses "Start over".
 *
 * Metro picks this file over `storage.ts` on web, so `expo-secure-store` never
 * reaches a browser bundle.
 */
export interface OnboardingStorage {
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

export const onboardingStorage: OnboardingStorage = {
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
