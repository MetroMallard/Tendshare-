/**
 * Where a half-finished onboarding lives on a phone: the OS keychain, through
 * `expo-secure-store` — the same place the session lives, for the same reason.
 *
 * The draft holds a display name, the cared-for person's first name and a list
 * of family email addresses. That is not medical data, but it is still a
 * household's private information, and a name attached to "who I care for" on a
 * shared or stolen phone is not something to leave in plain text when the
 * keychain is right there.
 *
 * `WHEN_UNLOCKED_THIS_DEVICE_ONLY` keeps it off iCloud Keychain backups and
 * unreadable while the phone is locked.
 *
 * Web has no keychain, so it has its own file (`storage.web.ts`); Metro picks it
 * by extension and this one never reaches a browser bundle.
 */
import * as SecureStore from 'expo-secure-store';

export interface OnboardingStorage {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
}

export const onboardingStorage: OnboardingStorage = {
  async getItem(key) {
    return SecureStore.getItemAsync(key);
  },
  async setItem(key, value) {
    await SecureStore.setItemAsync(key, value, {
      keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
    });
  },
  async removeItem(key) {
    await SecureStore.deleteItemAsync(key);
  },
};
