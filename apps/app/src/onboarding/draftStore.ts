/**
 * Reading and writing the draft through the device store.
 *
 * Thin on purpose: `draft.ts` owns the shape and the parsing rules, this file
 * owns "where", and nothing here can throw into a screen. A storage failure
 * (a locked keychain, a browser with storage disabled) must never stop someone
 * finishing setup — it only means the answers will not survive a restart, and
 * there is no useful thing to say to a person about that mid-flow.
 */
import { parseDraft, serialiseDraft, type OnboardingDraft } from './draft';
import { onboardingStorage } from './storage';

/** SecureStore keys are restricted to letters, digits, `.`, `-` and `_`. */
export const DRAFT_KEY = 'tendshare.onboarding.draft';

/**
 * Addresses typed on screen 3, kept after the circle is created.
 *
 * Invites are not switched on (Task 11), so nothing is sent — the screen says
 * exactly that. Keeping the addresses here is what makes "you can send these
 * later" true rather than a promise with nothing behind it.
 */
export const PENDING_INVITES_KEY = 'tendshare.onboarding.pending-invites';

export async function loadDraft(): Promise<OnboardingDraft> {
  try {
    return parseDraft(await onboardingStorage.getItem(DRAFT_KEY));
  } catch {
    return parseDraft(null);
  }
}

export async function saveDraft(draft: OnboardingDraft): Promise<void> {
  try {
    await onboardingStorage.setItem(DRAFT_KEY, serialiseDraft(draft));
  } catch {
    // Nothing actionable for the person; the flow continues in memory.
  }
}

export async function clearDraft(): Promise<void> {
  try {
    await onboardingStorage.removeItem(DRAFT_KEY);
  } catch {
    // Same: a stale draft is corrected by "Start over" on the next visit.
  }
}

export async function savePendingInvites(addresses: readonly string[]): Promise<void> {
  if (addresses.length === 0) {
    return;
  }

  try {
    await onboardingStorage.setItem(PENDING_INVITES_KEY, JSON.stringify(addresses));
  } catch {
    // As above.
  }
}

export async function loadPendingInvites(): Promise<readonly string[]> {
  try {
    const raw = await onboardingStorage.getItem(PENDING_INVITES_KEY);

    if (raw === null) {
      return [];
    }

    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((entry) => typeof entry === 'string') : [];
  } catch {
    return [];
  }
}
