/**
 * Asking the database the one question the guard needs: does this person have a
 * family circle yet?
 *
 * Two small reads, both under the caller's own Row Level Security:
 *
 *   1. their membership rows — `circle_members_select_member` lets anyone read
 *      their own, so this works for an owner and for someone who was invited;
 *   2. which of those circles already have a person in them — `care_recipients`
 *      is readable by every role in the circle.
 *
 * Nothing is inferred from a failed read: an error returns `null`, and the guard
 * treats that as "no opinion" rather than deciding someone needs onboarding.
 */
import type { SupabaseClient } from '@supabase/supabase-js';

import type { CircleRole, CircleSnapshot } from './circleState';

interface MembershipRow {
  readonly circle_id: string;
  readonly role: CircleRole;
}

interface RecipientRow {
  readonly circle_id: string;
}

export async function loadCircleSnapshot(
  client: SupabaseClient,
  profileId: string,
): Promise<CircleSnapshot | null> {
  const { data: memberships, error: membershipError } = await client
    .from('circle_members')
    .select('circle_id, role')
    .eq('profile_id', profileId)
    .returns<MembershipRow[]>();

  if (membershipError !== null) {
    return null;
  }

  const rows = memberships ?? [];

  if (rows.length === 0) {
    return { memberships: [], circleIdsWithRecipient: [] };
  }

  const circleIds = [...new Set(rows.map((row) => row.circle_id))];

  const { data: recipients, error: recipientError } = await client
    .from('care_recipients')
    .select('circle_id')
    .in('circle_id', circleIds)
    .returns<RecipientRow[]>();

  if (recipientError !== null) {
    return null;
  }

  return {
    memberships: rows.map((row) => ({ circleId: row.circle_id, role: row.role })),
    circleIdsWithRecipient: [...new Set((recipients ?? []).map((row) => row.circle_id))],
  };
}
