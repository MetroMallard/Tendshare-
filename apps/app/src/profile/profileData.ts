/**
 * The person profile's data, as the app reads it.
 *
 * Three small reads and one function call, all under the caller's own Row Level
 * Security. Nothing here trusts an id it was handed: every query is scoped by
 * `circle_id` or `care_recipient_id` in the query *and* again by the database,
 * so a bug in the app can only ask for less than it should, never for another
 * family's data.
 *
 * ## Why the note is fetched separately
 *
 * `care_recipients.notes` is not granted to any client role — Row Level Security
 * works on rows, and this table has to stay readable to a visiting helper for the
 * name and photo. The note is reachable only through `care_recipient_notes()`,
 * which refuses a visiting helper outright. So the screen asks for it the same
 * way it asks for everything else: through a call the database can say no to.
 *
 * Every loader answers `null` when the read failed. `null` is "we do not know",
 * which the screen renders as an error with a retry — never as an empty list,
 * because "nobody has added a doctor yet" and "we could not ask" must not look
 * the same.
 */
import type { SupabaseClient } from '@supabase/supabase-js';

export type ContactKind = 'doctor' | 'pharmacy' | 'other';
export type ConditionKind = 'allergy' | 'condition';

export const CONTACT_KINDS: readonly ContactKind[] = ['doctor', 'pharmacy', 'other'];
export const CONDITION_KINDS: readonly ConditionKind[] = ['allergy', 'condition'];

/** What the family calls each kind of contact. Never the raw enum. */
export const CONTACT_KIND_LABELS: Readonly<Record<ContactKind, string>> = {
  doctor: 'Doctor',
  pharmacy: 'Pharmacy',
  other: 'Other',
};

export const CONDITION_KIND_LABELS: Readonly<Record<ConditionKind, string>> = {
  allergy: 'Allergy',
  condition: 'Condition',
};

export interface CareBasics {
  readonly id: string;
  readonly circleId: string;
  readonly fullName: string;
  readonly preferredName: string | null;
  readonly relationship: string | null;
  /** ISO `YYYY-MM-DD`, as typed and stored. */
  readonly dateOfBirth: string | null;
  readonly phone: string | null;
  /** Path inside the private `care-media` bucket, or null. Never a URL. */
  readonly photoPath: string | null;
  /** Free text. Empty for a visiting helper, who is refused the column. */
  readonly notes: string | null;
}

export interface CareContact {
  readonly id: string;
  readonly kind: ContactKind;
  readonly name: string;
  readonly organisation: string | null;
  readonly phone: string | null;
  readonly address: string | null;
  readonly notes: string | null;
  readonly isPrimary: boolean;
}

export interface CareCondition {
  readonly id: string;
  readonly kind: ConditionKind;
  readonly label: string;
  readonly notes: string | null;
}

export interface InsuranceCard {
  readonly id: string;
  readonly planName: string;
  readonly memberId: string | null;
  readonly groupNumber: string | null;
  /** Path inside the private bucket, or null when no photo has been added. */
  readonly imagePath: string | null;
}

export interface CareProfile {
  /** `null` when the circle has nobody in it yet. */
  readonly basics: CareBasics | null;
  readonly contacts: readonly CareContact[];
  readonly conditions: readonly CareCondition[];
  readonly insurance: readonly InsuranceCard[];
}

interface BasicsRow {
  readonly id: string;
  readonly circle_id: string;
  readonly full_name: string;
  readonly preferred_name: string | null;
  readonly relationship: string | null;
  readonly date_of_birth: string | null;
  readonly phone: string | null;
  readonly photo_url: string | null;
}

interface ContactRow {
  readonly id: string;
  readonly kind: ContactKind;
  readonly name: string;
  readonly organisation: string | null;
  readonly phone: string | null;
  readonly address: string | null;
  readonly notes: string | null;
  readonly is_primary: boolean;
}

interface ConditionRow {
  readonly id: string;
  readonly kind: ConditionKind;
  readonly label: string;
  readonly notes: string | null;
}

interface InsuranceRow {
  readonly id: string;
  readonly plan_name: string;
  readonly member_id: string | null;
  readonly group_number: string | null;
  readonly image_path: string | null;
}

/**
 * Everything the profile screen shows, in one read.
 *
 * The three child lists are only fetched once the person is known: a query for
 * `care_recipient_id = null` would be a wasted round trip and an empty list that
 * means nothing.
 */
export async function loadCareProfile(
  client: SupabaseClient,
  circleId: string,
): Promise<CareProfile | null> {
  const basicsResult = await client
    .from('care_recipients')
    .select(
      'id, circle_id, full_name, preferred_name, relationship, date_of_birth, phone, photo_url',
    )
    .eq('circle_id', circleId)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle<BasicsRow>();

  if (basicsResult.error !== null) {
    return null;
  }

  const row = basicsResult.data ?? null;

  if (row === null) {
    return { basics: null, contacts: [], conditions: [], insurance: [] };
  }

  const [notesResult, contactsResult, conditionsResult, insuranceResult] = await Promise.all([
    client.rpc('care_recipient_notes', { p_care_recipient_id: row.id }),
    client
      .from('care_recipient_contacts')
      .select('id, kind, name, organisation, phone, address, notes, is_primary')
      .eq('care_recipient_id', row.id)
      .order('kind', { ascending: true })
      .order('created_at', { ascending: true })
      .returns<ContactRow[]>(),
    client
      .from('care_recipient_conditions')
      .select('id, kind, label, notes')
      .eq('care_recipient_id', row.id)
      .order('kind', { ascending: true })
      .order('created_at', { ascending: true })
      .returns<ConditionRow[]>(),
    client
      .from('care_recipient_insurance')
      .select('id, plan_name, member_id, group_number, image_path')
      .eq('care_recipient_id', row.id)
      .order('created_at', { ascending: true })
      .returns<InsuranceRow[]>(),
  ]);

  if (
    contactsResult.error !== null ||
    conditionsResult.error !== null ||
    insuranceResult.error !== null
  ) {
    return null;
  }

  return {
    basics: {
      id: row.id,
      circleId: row.circle_id,
      fullName: row.full_name,
      preferredName: row.preferred_name,
      relationship: row.relationship,
      dateOfBirth: row.date_of_birth,
      phone: row.phone,
      photoPath: row.photo_url,
      // A refused note (a visiting helper) and a blank note look the same here
      // on purpose: this screen does not offer the note to a helper at all, so
      // the only case that reaches this line is a role that may read it.
      notes: notesResult.error === null ? ((notesResult.data as string | null) ?? null) : null,
    },
    contacts: (contactsResult.data ?? []).map((contact) => ({
      id: contact.id,
      kind: contact.kind,
      name: contact.name,
      organisation: contact.organisation,
      phone: contact.phone,
      address: contact.address,
      notes: contact.notes,
      isPrimary: contact.is_primary,
    })),
    conditions: (conditionsResult.data ?? []).map((condition) => ({
      id: condition.id,
      kind: condition.kind,
      label: condition.label,
      notes: condition.notes,
    })),
    insurance: (insuranceResult.data ?? []).map((card) => ({
      id: card.id,
      planName: card.plan_name,
      memberId: card.member_id,
      groupNumber: card.group_number,
      imagePath: card.image_path,
    })),
  };
}

/** The contacts of one kind, in the order the screen lists them: main one first. */
export function contactsOf(profile: CareProfile, kind: ContactKind): readonly CareContact[] {
  return profile.contacts
    .filter((contact) => contact.kind === kind)
    .slice()
    .sort((a, b) => Number(b.isPrimary) - Number(a.isPrimary));
}

/** Allergies first, then conditions — the order a family reads them in. */
export function conditionsOf(profile: CareProfile): readonly CareCondition[] {
  return profile.conditions.slice().sort((a, b) => {
    if (a.kind !== b.kind) {
      return a.kind === 'allergy' ? -1 : 1;
    }
    return a.label.localeCompare(b.label);
  });
}

/** The one line under a contact's name: who they are and how to reach them. */
export function contactSubtitle(contact: CareContact): string {
  const parts = [contact.organisation, contact.phone].filter(
    (part): part is string => typeof part === 'string' && part.trim().length > 0,
  );

  return parts.length === 0 ? 'No phone number yet' : parts.join(' · ');
}

/** "Born 12 March 1942", or a gentle nudge when nobody has said. */
export function dateOfBirthLabel(value: string | null): string {
  if (value === null) {
    return 'Not added';
  }

  const parsed = new Date(`${value}T00:00:00Z`);

  if (Number.isNaN(parsed.getTime())) {
    return 'Not added';
  }

  return new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(parsed);
}
