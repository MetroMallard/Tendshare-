/**
 * Where the session lives on a phone or tablet: the OS keychain / keystore,
 * through `expo-secure-store`, and nothing else.
 *
 * Never `AsyncStorage`. The stored value is the refresh token — a long-lived
 * credential for a health app — and plain-text storage on a device is the one
 * shortcut this product does not take. `WHEN_UNLOCKED_THIS_DEVICE_ONLY` keeps
 * the item off iCloud Keychain backups and unreadable while the phone is locked.
 *
 * Web has no keychain, so it has its own file (`storage.web.ts`); Metro picks it
 * by extension and this one never reaches a browser bundle.
 */
import * as SecureStore from 'expo-secure-store';

export interface AuthStorage {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
}

export const secureAuthStorage: AuthStorage = {
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
