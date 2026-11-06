/**
 * The audit payload, from the app's side of the fence.
 *
 * The rows themselves are written by `SECURITY DEFINER` triggers in
 * `supabase/migrations/20261106120000_care_recipient_profile.sql` — in the same
 * transaction as the change, with the actor taken from the session, so a client
 * cannot forge one and a change cannot happen without one. This module is the
 * contract the app knows about, and it exists for two reasons:
 *
 *   1. **A test that cannot drift.** The vocabulary below is asserted against
 *      the SQL in `profileAudit.test.ts`: every field name the triggers can
 *      emit is in this list, and every entry is a column name and nothing else.
 *   2. **A guard for the day something else writes a summary.** `log_audit_event`
 *      is callable by a client, and a summary with a value in it is exactly the
 *      mistake this product cannot afford — an allergy copied into a log row is
 *      a second copy of the health data the log is meant to protect.
 *
 * The rule, in one sentence: ids, enums and field *names*; never a value.
 */

/** Tables whose changes the profile writes into the trail. */
export const PROFILE_AUDIT_TABLES = [
  'care_recipients',
  'care_recipient_contacts',
  'care_recipient_conditions',
  'care_recipient_insurance',
] as const;

export type ProfileAuditTable = (typeof PROFILE_AUDIT_TABLES)[number];

/**
 * Every field name the profile's triggers may put in `{"fields": [...]}`.
 *
 * Sorted by table, and kept to columns that exist. `id`, `circle_id`,
 * `care_recipient_id`, `created_by`, `created_at` and `updated_at` are excluded
 * by the triggers on purpose: they are bookkeeping, not something a family did.
 */
export const PROFILE_AUDIT_FIELDS: Readonly<Record<ProfileAuditTable, readonly string[]>> = {
  care_recipients: [
    'date_of_birth',
    'full_name',
    'notes',
    'phone',
    'photo_url',
    'preferred_name',
    'relationship',
  ],
  care_recipient_contacts: [
    'address',
    'is_primary',
    'kind',
    'name',
    'notes',
    'organisation',
    'phone',
  ],
  care_recipient_conditions: ['kind', 'label', 'notes'],
  care_recipient_insurance: ['group_number', 'image_path', 'member_id', 'plan_name'],
};

/** The enums a summary may carry alongside the field names. */
export const PROFILE_AUDIT_ENUMS: readonly string[] = [
  'allergy',
  'condition',
  'doctor',
  'pharmacy',
  'other',
];

export interface AuditSummary {
  readonly fields: readonly string[];
  readonly kind?: string;
}

/**
 * The summary shape, built the same way the trigger builds it: field names
 * sorted, the `kind` enum when the row has one, and nothing else.
 */
export function auditSummaryFor(fields: readonly string[], kind?: string): AuditSummary {
  const unique = [...new Set(fields)].sort();

  return kind === undefined ? { fields: unique } : { fields: unique, kind };
}

const FIELD_NAME_PATTERN = /^[a-z][a-z0-9_]{0,62}$/;

/**
 * Is this summary safe to write?
 *
 * True when it has nothing but a `fields` array of column names and an optional
 * `kind` that is one of the four enums. Anything else — a free-text note, an
 * email address, a name — fails. It is used by the tests today and by the first
 * caller that builds a summary by hand tomorrow.
 */
export function isFieldNameOnly(summary: Record<string, unknown>): boolean {
  const keys = Object.keys(summary);

  if (keys.length === 0) {
    return true;
  }

  for (const key of keys) {
    if (key !== 'fields' && key !== 'kind') {
      return false;
    }
  }

  if ('kind' in summary) {
    const kind = summary.kind;

    if (typeof kind !== 'string' || !PROFILE_AUDIT_ENUMS.includes(kind)) {
      return false;
    }
  }

  if (!('fields' in summary)) {
    return true;
  }

  const fields = summary.fields;

  if (!Array.isArray(fields)) {
    return false;
  }

  const known = new Set(Object.values(PROFILE_AUDIT_FIELDS).flat());

  return fields.every(
    (field) => typeof field === 'string' && FIELD_NAME_PATTERN.test(field) && known.has(field),
  );
}
