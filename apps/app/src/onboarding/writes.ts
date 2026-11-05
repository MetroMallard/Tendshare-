/**
 * The four writes onboarding needs, as an interface.
 *
 * Kept narrow and injected rather than reaching for the Supabase client
 * directly, for one reason: the order of these calls, and what happens when the
 * third one fails, is the part of this task that can lose someone's data. With
 * a four-method interface the whole flow can be tested against a fake that
 * fails on demand — no network, no database, no mocks of a 40-method client.
 *
 * `writes.supabase.ts` is the real implementation.
 */
import type { PostgrestFailure } from './errors';

export interface CreateCircleInput {
  readonly name: string;
  readonly ownerId: string;
}

export type CreateCircleOutcome =
  | { readonly ok: true; readonly circleId: string }
  | { readonly ok: false; readonly failure: PostgrestFailure };

export interface CreateRecipientInput {
  readonly circleId: string;
  readonly fullName: string;
  readonly relationship: string;
}

/**
 * Every method returns `null` on success and the failure on error, so a caller
 * never has to destructure an error union to find out whether it worked.
 */
export interface OnboardingWrites {
  /** `profiles.display_name` — an UPDATE; the signup trigger created the row. */
  saveDisplayName(userId: string, displayName: string): Promise<PostgrestFailure | null>;
  createCircle(input: CreateCircleInput): Promise<CreateCircleOutcome>;
  createRecipient(input: CreateRecipientInput): Promise<PostgrestFailure | null>;
  /** The undo for a circle that was created but could not be given its person. */
  deleteCircle(circleId: string): Promise<PostgrestFailure | null>;
}
