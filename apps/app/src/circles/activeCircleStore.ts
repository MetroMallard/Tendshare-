/**
 * Where "the circle I was last looking at" lives on a phone: the OS keychain,
 * through `expo-secure-store` — the same place the session and the onboarding
 * draft live.
 *
 * It holds one opaque uuid and nothing else. That is not medical data, but it is
 * a pointer to a family's circle, and the keychain costs nothing here.
 *
 * The key carries the person's id, so two people sharing a phone do not inherit
 * each other's choice — and signing out does not have to clear it for the other
 * account to stay tidy.
 *
 * Web has no keychain, so it has its own file (`activeCircleStore.web.ts`);
 * Metro picks it by extension and this one never reaches a browser bundle.
 */
import * as SecureStore from 'expo-secure-store';

export interface ActiveCircleStore {
  /** The circle id this device last showed this person, or `null`. */
  get(profileId: string): Promise<string | null>;
  set(profileId: string, circleId: string): Promise<void>;
  clear(profileId: string): Promise<void>;
}

function keyFor(profileId: string): string {
  return `tendshare.active-circle.${profileId}`;
}

export const activeCircleStore: ActiveCircleStore = {
  async get(profileId) {
    return SecureStore.getItemAsync(keyFor(profileId));
  },
  async set(profileId, circleId) {
    await SecureStore.setItemAsync(keyFor(profileId), circleId, {
      keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
    });
  },
  async clear(profileId) {
    await SecureStore.deleteItemAsync(keyFor(profileId));
  },
};
