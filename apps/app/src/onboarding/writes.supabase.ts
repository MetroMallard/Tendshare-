/**
 * The real Supabase implementation of `OnboardingWrites`.
 *
 * Every write asks for the row back (`.select()`), because that is what makes a
 * write *prove* it happened: with Row Level Security on, an UPDATE the policies
 * silently filter out returns no rows and no error, and a screen that treats
 * "no error" as "saved" would then move someone into an empty circle. `PROJECT_BRIEF.md`
 * records the bug that rule comes from — a circle that could be inserted but not
 * read back.
 *
 * The three tables, and the policies these calls rely on:
 *   * `profiles` — `profiles_update_self`: `id = auth.uid()`.
 *   * `circles` — `circles_insert_self_as_owner` for the insert, and
 *     `circles_select_owner_or_care_team` for the read-back (`owner_id` is on
 *     the row, so it answers before the owner-membership trigger is visible).
 *   * `care_recipients` — `care_recipients_insert_care_team`, plus the
 *     plan-limit trigger that raises `P0001` when a tier is full.
 */
import type { SupabaseClient } from '@supabase/supabase-js';

import type { PostgrestFailure } from './errors';
import type {
  CreateCircleInput,
  CreateCircleOutcome,
  CreateRecipientInput,
  OnboardingWrites,
} from './writes';

interface ErrorShape {
  readonly code?: string | null;
  readonly message: string;
}

function failureFrom(error: ErrorShape | null): PostgrestFailure | null {
  if (error === null) {
    return null;
  }

  return { code: error.code ?? null, message: error.message };
}

/** A write that matched no row: the session is stale or the row is gone. */
const NO_ROW: PostgrestFailure = {
  code: '23503',
  message: 'the write matched no row',
};

export function supabaseWrites(client: SupabaseClient): OnboardingWrites {
  return {
    async saveDisplayName(userId: string, displayName: string): Promise<PostgrestFailure | null> {
      const { data, error } = await client
        .from('profiles')
        .update({ display_name: displayName })
        .eq('id', userId)
        .select('id')
        .returns<{ id: string }[]>();

      const failure = failureFrom(error);
      if (failure !== null) {
        return failure;
      }

      return (data?.length ?? 0) === 0 ? NO_ROW : null;
    },

    async createCircle({ name, ownerId }: CreateCircleInput): Promise<CreateCircleOutcome> {
      const { data, error } = await client
        .from('circles')
        .insert({ name, owner_id: ownerId })
        .select('id')
        .single<{ id: string }>();

      const failure = failureFrom(error);
      if (failure !== null) {
        return { ok: false, failure };
      }

      if (data === null || data.id.length === 0) {
        return { ok: false, failure: NO_ROW };
      }

      return { ok: true, circleId: data.id };
    },

    async createRecipient({
      circleId,
      fullName,
      relationship,
    }: CreateRecipientInput): Promise<PostgrestFailure | null> {
      const { data, error } = await client
        .from('care_recipients')
        .insert({ circle_id: circleId, full_name: fullName, relationship })
        .select('id')
        .returns<{ id: string }[]>();

      const failure = failureFrom(error);
      if (failure !== null) {
        return failure;
      }

      return (data?.length ?? 0) === 0 ? NO_ROW : null;
    },

    async deleteCircle(circleId: string): Promise<PostgrestFailure | null> {
      const { error } = await client.from('circles').delete().eq('id', circleId);
      return failureFrom(error);
    },
  };
}
