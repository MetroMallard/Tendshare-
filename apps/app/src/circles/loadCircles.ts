/**
 * Reading the circles this person belongs to, and who is in one of them.
 *
 * Everything here runs under the caller's own Row Level Security. There is no
 * "give me the circle with this id" without a policy behind it, and no query
 * below trusts an id it was handed: the members query is scoped with
 * `.eq('circle_id', …)` *and* the database scopes it again, so a bug in the app
 * can only ever ask for less, never for another family's data.
 *
 * Each loader answers `null` on a failed read. `null` is "we do not know", which
 * every screen renders as an error with a retry — never as an empty list, because
 * "your circle has nobody in it" and "we could not ask" must not look the same.
 */
import type { SupabaseClient } from '@supabase/supabase-js';

import { capabilitiesFor } from './roles';
import type { CircleSummary, PlanTier } from './activeCircle';
import type { CircleRole } from './circleState';

interface MembershipRow {
  readonly circle_id: string;
  readonly role: CircleRole;
}

interface CircleRow {
  readonly id: string;
  readonly name: string;
  readonly plan_tier: PlanTier;
}

interface RecipientRow {
  readonly circle_id: string;
  readonly full_name: string;
}

interface MemberCircleRow {
  readonly circle_id: string;
}

/**
 * Every circle this person is in, with the role they hold in each.
 *
 * Three small reads rather than one clever join: the circle's own row is
 * unreadable to a visiting helper, so the name and the plan come from a query
 * that simply returns nothing for them and the summary falls back honestly.
 */
export async function loadCircles(
  client: SupabaseClient,
  profileId: string,
): Promise<readonly CircleSummary[] | null> {
  const { data: memberships, error: membershipError } = await client
    .from('circle_members')
    .select('circle_id, role, joined_at')
    .eq('profile_id', profileId)
    .order('joined_at', { ascending: true })
    .returns<MembershipRow[]>();

  if (membershipError !== null) {
    return null;
  }

  const rows = memberships ?? [];

  if (rows.length === 0) {
    return [];
  }

  const circleIds = [...new Set(rows.map((row) => row.circle_id))];

  const [circlesResult, recipientsResult] = await Promise.all([
    client.from('circles').select('id, name, plan_tier').in('id', circleIds).returns<CircleRow[]>(),
    client
      .from('care_recipients')
      .select('circle_id, full_name')
      .in('circle_id', circleIds)
      .returns<RecipientRow[]>(),
  ]);

  if (circlesResult.error !== null || recipientsResult.error !== null) {
    return null;
  }

  const circleById = new Map((circlesResult.data ?? []).map((row) => [row.id, row]));
  const recipientByCircle = new Map(
    (recipientsResult.data ?? []).map((row) => [row.circle_id, row.full_name]),
  );

  // The roster is only counted for roles that can read it. A visiting helper
  // sees one membership row (their own), so counting for them would print
  // "1 member" on a circle of five — a wrong number is worse than none.
  const countableCircleIds = circleIds.filter((circleId) => {
    const role = rows.find((row) => row.circle_id === circleId)?.role;
    return capabilitiesFor(role).canSeeRoster;
  });

  const counts = new Map<string, number>();

  if (countableCircleIds.length > 0) {
    const { data: memberRows, error: memberError } = await client
      .from('circle_members')
      .select('circle_id')
      .in('circle_id', countableCircleIds)
      .returns<MemberCircleRow[]>();

    if (memberError !== null) {
      return null;
    }

    for (const row of memberRows ?? []) {
      counts.set(row.circle_id, (counts.get(row.circle_id) ?? 0) + 1);
    }
  }

  return rows.map((row) => {
    const circle = circleById.get(row.circle_id);

    return {
      circleId: row.circle_id,
      name: circle?.name ?? null,
      role: row.role,
      planTier: circle?.plan_tier ?? 'free',
      recipientName: recipientByCircle.get(row.circle_id) ?? null,
      memberCount: counts.get(row.circle_id) ?? null,
    };
  });
}

export interface CircleMember {
  readonly profileId: string;
  readonly role: CircleRole;
  readonly displayName: string;
  /** True for the person reading the screen. */
  readonly isSelf: boolean;
}

/**
 * Who is in one circle, by name.
 *
 * Scoped to `circleId` in the query and again by RLS. A visiting helper gets
 * their own row back, which is exactly what the policy allows.
 */
export async function loadCircleMembers(
  client: SupabaseClient,
  circleId: string,
  selfId: string,
): Promise<readonly CircleMember[] | null> {
  const { data: memberships, error: membershipError } = await client
    .from('circle_members')
    .select('profile_id, role, joined_at')
    .eq('circle_id', circleId)
    .order('joined_at', { ascending: true })
    .returns<{ profile_id: string; role: CircleRole }[]>();

  if (membershipError !== null) {
    return null;
  }

  const rows = memberships ?? [];

  if (rows.length === 0) {
    return [];
  }

  const profileIds = [...new Set(rows.map((row) => row.profile_id))];

  const { data: profiles, error: profileError } = await client
    .from('profiles')
    .select('id, display_name')
    .in('id', profileIds)
    .returns<{ id: string; display_name: string }[]>();

  if (profileError !== null) {
    return null;
  }

  const nameById = new Map((profiles ?? []).map((row) => [row.id, row.display_name]));

  // The owner first, then everybody else in the order they joined: the roster
  // reads as "who runs this" and then "who else is here".
  const ordered = [...rows].sort((a, b) => {
    if (a.role === 'owner') return -1;
    if (b.role === 'owner') return 1;
    return 0;
  });

  return ordered.map((row) => ({
    profileId: row.profile_id,
    role: row.role,
    displayName: nameById.get(row.profile_id) ?? 'Member',
    isSelf: row.profile_id === selfId,
  }));
}

export interface CareRecipientSummary {
  readonly fullName: string;
  readonly relationship: string | null;
}

/** The person this circle cares for. Basics only — this is not a medical record. */
export async function loadCareRecipient(
  client: SupabaseClient,
  circleId: string,
): Promise<CareRecipientSummary | null> {
  const { data, error } = await client
    .from('care_recipients')
    .select('full_name, relationship')
    .eq('circle_id', circleId)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle<{ full_name: string; relationship: string | null }>();

  if (error !== null) {
    return null;
  }

  if (data === null || data === undefined) {
    return null;
  }

  return { fullName: data.full_name, relationship: data.relationship };
}

/**
 * How many people this circle's plan covers.
 *
 * Read from `plan_limits`, the same config table the server-side trigger reads,
 * so the sentence under the roster ("Your free plan covers up to 3 people") can
 * never disagree with the rule that refuses a fourth.
 *
 * `null` means no limit, or no answer — both of which mean "say nothing".
 */
export async function loadMemberLimit(
  client: SupabaseClient,
  tier: PlanTier,
): Promise<number | null> {
  const { data, error } = await client
    .from('plan_limits')
    .select('max_members')
    .eq('tier', tier)
    .maybeSingle<{ max_members: number | null }>();

  if (error !== null || data === null || data === undefined) {
    return null;
  }

  return data.max_members;
}
