/**
 * The profile's writes.
 *
 * Five small functions per kind of row, each of them a single request that either
 * lands or does not. The screen does the optimistic part (it paints the change
 * first and puts it back if this answers no), and this module does the honest
 * part: it says what the database said, in words a family can act on.
 *
 * Three rules hold for every function here:
 *
 *   * **The row comes back.** `.select('id')` after every insert and update, so
 *     Row Level Security checks the returned row against the table's SELECT
 *     policy as well as its write policy — the defect the hosted suite caught on
 *     `circles` in Task 3.
 *   * **Nothing is deleted quietly.** A refusal is a `problem`, never a silent
 *     success, so the screen can put the row back and say so.
 *   * **No free text goes anywhere but its own column.** There is no audit call
 *     in this file: the triggers write the trail, in the same transaction, with
 *     field names only. If this module could write an audit row, it could write
 *     the wrong thing into one.
 */
import type { SupabaseClient } from '@supabase/supabase-js';

import type { ContactKind, ConditionKind } from './profileData';
import { CARE_MEDIA_BUCKET } from './storage';

export type ProfileProblem = 'not_allowed' | 'offline' | 'not_found' | 'unknown';

export interface ProfileActionResult {
  readonly ok: boolean;
  /** Present only when `ok` is false. */
  readonly problem?: ProfileProblem;
  /** The row's id, after an insert. */
  readonly id?: string;
}

export interface ProfileProblemCopy {
  readonly title: string;
  readonly message: string;
}

interface Failure {
  readonly message?: string | null;
  readonly code?: string | null;
}

/**
 * What went wrong, from what the server said.
 *
 * A refusal (`42501`, or the row-level security message) is a different sentence
 * from a dropped connection, and both are different from a row that has gone —
 * "somebody removed this while you were typing" is a real thing to say.
 */
export function profileProblemOf(error: Failure): ProfileProblem {
  const message = (error.message ?? '').toLowerCase();
  const code = error.code ?? '';

  if (
    code === '42501' ||
    message.includes('row-level security') ||
    message.includes('permission denied')
  ) {
    return 'not_allowed';
  }

  if (code === 'PGRST116' || message.includes('0 rows') || message.includes('no rows')) {
    return 'not_found';
  }

  if (
    message.includes('failed to fetch') ||
    message.includes('network request failed') ||
    message.includes('networkerror') ||
    message.includes('timeout')
  ) {
    return 'offline';
  }

  return 'unknown';
}

/** One calm sentence per problem. Same voice as the members screen. */
export function profileProblemCopy(problem: ProfileProblem): ProfileProblemCopy {
  switch (problem) {
    case 'not_allowed':
      return {
        title: 'That change isn’t yours to make',
        message:
          'Nothing has changed. Editing the profile is for the owner and family members — you can read everything here.',
      };
    case 'not_found':
      return {
        title: 'That has already gone',
        message: 'Somebody else removed it while you were looking. Nothing else has changed.',
      };
    case 'offline':
      return {
        title: 'You’re offline',
        message: 'That change was put back as it was. Try again when you’re back online.',
      };
    default:
      return {
        title: 'That didn’t save',
        message: 'The change was put back as it was. Please try again in a moment.',
      };
  }
}

function failureOf(error: Failure): ProfileActionResult {
  return { ok: false, problem: profileProblemOf(error) };
}

/** A write that matched no row: the session is stale or the row is gone. */
const NO_ROW: ProfileActionResult = { ok: false, problem: 'not_found' };

// ---------------------------------------------------------------------------
// The basics
// ---------------------------------------------------------------------------

export interface BasicsPatch {
  readonly full_name?: string | null;
  readonly preferred_name?: string | null;
  readonly relationship?: string | null;
  readonly date_of_birth?: string | null;
  readonly phone?: string | null;
  readonly notes?: string | null;
  readonly photo_url?: string | null;
}

export async function saveBasics(
  client: SupabaseClient,
  input: { readonly recipientId: string; readonly patch: BasicsPatch },
): Promise<ProfileActionResult> {
  if (Object.keys(input.patch).length === 0) {
    return { ok: true };
  }

  const { data, error } = await client
    .from('care_recipients')
    .update(input.patch)
    .eq('id', input.recipientId)
    .select('id')
    .returns<{ id: string }[]>();

  if (error !== null) {
    return failureOf(error);
  }

  return (data ?? []).length === 0 ? NO_ROW : { ok: true, id: input.recipientId };
}

// ---------------------------------------------------------------------------
// Doctors and pharmacies
// ---------------------------------------------------------------------------

export interface ContactInput {
  readonly circleId: string;
  readonly careRecipientId: string;
  /** Absent when adding. */
  readonly contactId?: string;
  readonly kind: ContactKind;
  readonly name: string;
  readonly organisation: string | null;
  readonly phone: string | null;
  readonly address: string | null;
  readonly notes: string | null;
  readonly isPrimary: boolean;
}

export async function saveContact(
  client: SupabaseClient,
  input: ContactInput,
): Promise<ProfileActionResult> {
  const row = {
    circle_id: input.circleId,
    care_recipient_id: input.careRecipientId,
    kind: input.kind,
    name: input.name,
    organisation: input.organisation,
    phone: input.phone,
    address: input.address,
    notes: input.notes,
    is_primary: input.isPrimary,
  };

  const query =
    input.contactId === undefined
      ? client.from('care_recipient_contacts').insert(row)
      : client.from('care_recipient_contacts').update(row).eq('id', input.contactId);

  const { data, error } = await query.select('id').returns<{ id: string }[]>();

  if (error !== null) {
    return failureOf(error);
  }

  const saved = (data ?? [])[0];

  return saved === undefined ? NO_ROW : { ok: true, id: saved.id };
}

export async function deleteContact(
  client: SupabaseClient,
  contactId: string,
): Promise<ProfileActionResult> {
  const { data, error } = await client
    .from('care_recipient_contacts')
    .delete()
    .eq('id', contactId)
    .select('id')
    .returns<{ id: string }[]>();

  if (error !== null) {
    return failureOf(error);
  }

  return (data ?? []).length === 0 ? NO_ROW : { ok: true, id: contactId };
}

/**
 * Make one contact the main one of its kind.
 *
 * Two statements rather than one: the old main one is unset first, so a failure
 * half-way leaves "nobody is the main doctor" — a state the screen can show —
 * rather than two rows both claiming it. `is_primary` is not unique in the
 * database for exactly this reason.
 */
export async function setPrimaryContact(
  client: SupabaseClient,
  input: {
    readonly careRecipientId: string;
    readonly kind: ContactKind;
    readonly contactId: string;
  },
): Promise<ProfileActionResult> {
  const cleared = await client
    .from('care_recipient_contacts')
    .update({ is_primary: false })
    .eq('care_recipient_id', input.careRecipientId)
    .eq('kind', input.kind)
    .eq('is_primary', true)
    .neq('id', input.contactId);

  if (cleared.error !== null) {
    return failureOf(cleared.error);
  }

  const promoted = await client
    .from('care_recipient_contacts')
    .update({ is_primary: true })
    .eq('id', input.contactId)
    .select('id')
    .returns<{ id: string }[]>();

  if (promoted.error !== null) {
    return failureOf(promoted.error);
  }

  return (promoted.data ?? []).length === 0 ? NO_ROW : { ok: true, id: input.contactId };
}

// ---------------------------------------------------------------------------
// Allergies and conditions
// ---------------------------------------------------------------------------

export interface ConditionInput {
  readonly circleId: string;
  readonly careRecipientId: string;
  readonly conditionId?: string;
  readonly kind: ConditionKind;
  readonly label: string;
  readonly notes: string | null;
}

export async function saveCondition(
  client: SupabaseClient,
  input: ConditionInput,
): Promise<ProfileActionResult> {
  const row = {
    circle_id: input.circleId,
    care_recipient_id: input.careRecipientId,
    kind: input.kind,
    label: input.label,
    notes: input.notes,
  };

  const query =
    input.conditionId === undefined
      ? client.from('care_recipient_conditions').insert(row)
      : client.from('care_recipient_conditions').update(row).eq('id', input.conditionId);

  const { data, error } = await query.select('id').returns<{ id: string }[]>();

  if (error !== null) {
    return failureOf(error);
  }

  const saved = (data ?? [])[0];

  return saved === undefined ? NO_ROW : { ok: true, id: saved.id };
}

export async function deleteCondition(
  client: SupabaseClient,
  conditionId: string,
): Promise<ProfileActionResult> {
  const { data, error } = await client
    .from('care_recipient_conditions')
    .delete()
    .eq('id', conditionId)
    .select('id')
    .returns<{ id: string }[]>();

  if (error !== null) {
    return failureOf(error);
  }

  return (data ?? []).length === 0 ? NO_ROW : { ok: true, id: conditionId };
}

// ---------------------------------------------------------------------------
// Insurance cards
// ---------------------------------------------------------------------------

export interface InsuranceInput {
  readonly circleId: string;
  readonly careRecipientId: string;
  readonly insuranceId?: string;
  readonly planName: string;
  readonly memberId: string | null;
  readonly groupNumber: string | null;
  readonly imagePath?: string | null;
}

export async function saveInsurance(
  client: SupabaseClient,
  input: InsuranceInput,
): Promise<ProfileActionResult> {
  const row: Record<string, string | null> = {
    circle_id: input.circleId,
    care_recipient_id: input.careRecipientId,
    plan_name: input.planName,
    member_id: input.memberId,
    group_number: input.groupNumber,
  };

  if (input.imagePath !== undefined) {
    row.image_path = input.imagePath;
  }

  const query =
    input.insuranceId === undefined
      ? client.from('care_recipient_insurance').insert(row)
      : client.from('care_recipient_insurance').update(row).eq('id', input.insuranceId);

  const { data, error } = await query.select('id').returns<{ id: string }[]>();

  if (error !== null) {
    return failureOf(error);
  }

  const saved = (data ?? [])[0];

  return saved === undefined ? NO_ROW : { ok: true, id: saved.id };
}

export async function deleteInsurance(
  client: SupabaseClient,
  insuranceId: string,
): Promise<ProfileActionResult> {
  const { data, error } = await client
    .from('care_recipient_insurance')
    .delete()
    .eq('id', insuranceId)
    .select('id')
    .returns<{ id: string }[]>();

  if (error !== null) {
    return failureOf(error);
  }

  return (data ?? []).length === 0 ? NO_ROW : { ok: true, id: insuranceId };
}

// ---------------------------------------------------------------------------
// The bucket
// ---------------------------------------------------------------------------

/** Upload bytes to a path the caller built with `buildPath()`. */
export async function uploadCareImage(
  client: SupabaseClient,
  input: {
    readonly path: string;
    readonly bytes: Uint8Array;
    readonly contentType: string;
  },
): Promise<ProfileActionResult> {
  const { error } = await client.storage
    .from(CARE_MEDIA_BUCKET)
    .upload(input.path, input.bytes, { contentType: input.contentType, upsert: false });

  return error === null ? { ok: true, id: input.path } : failureOf(error);
}

/**
 * Remove an object.
 *
 * Best effort on purpose: this is called after the row that pointed at the object
 * has already gone, and a failed delete leaves an orphan rather than breaking the
 * screen. Storage is not cascaded by SQL, so this is the only thing that removes
 * a photo when a card is deleted.
 */
export async function removeCareImage(
  client: SupabaseClient,
  path: string,
): Promise<ProfileActionResult> {
  const { error } = await client.storage.from(CARE_MEDIA_BUCKET).remove([path]);

  return error === null ? { ok: true } : failureOf(error);
}
