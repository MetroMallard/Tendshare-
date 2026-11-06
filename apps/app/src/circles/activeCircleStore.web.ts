/**
 * Where "the circle I was last looking at" lives in a browser: `localStorage`,
 * scoped to the origin.
 *
 * The honest floor, exactly as `src/auth/storage.web.ts` is for the session. It
 * holds one opaque uuid. A browser that cannot use storage at all (Safari in
 * private mode throws on access) degrades to "no remembered choice", which is
 * the same as a first visit: the first circle in the list.
 *
 * Metro picks this file over `activeCircleStore.ts` on web, so
 * `expo-secure-store` never reaches a browser bundle.
 */
export interface ActiveCircleStore {
  get(profileId: string): Promise<string | null>;
  set(profileId: string, circleId: string): Promise<void>;
  clear(profileId: string): Promise<void>;
}

function keyFor(profileId: string): string {
  return `tendshare.active-circle.${profileId}`;
}

function store(): Storage | null {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
}

export const activeCircleStore: ActiveCircleStore = {
  async get(profileId) {
    return store()?.getItem(keyFor(profileId)) ?? null;
  },
  async set(profileId, circleId) {
    store()?.setItem(keyFor(profileId), circleId);
  },
  async clear(profileId) {
    store()?.removeItem(keyFor(profileId));
  },
};
