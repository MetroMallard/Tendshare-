/**
 * What actually changed between the row as it was and the form as it was left.
 *
 * Two jobs, and they are the same job twice:
 *
 *   * **The database only receives what changed.** Saving a sheet with nothing
 *     touched sends no UPDATE at all, so an accidental save cannot bump
 *     `updated_at` or write an audit row that says somebody changed something
 *     when they did not.
 *   * **The audit trail records field names.** The triggers in
 *     `20261106120000_care_recipient_profile.sql` build their own diff, and this
 *     module mirrors it so the app and the database agree about what "changed"
 *     means — trimmed, and an empty field equal to a missing one.
 *
 * Pure, no Supabase and no React: the interesting half of an optimistic write is
 * entirely testable.
 */

/** A form value: what a text input holds. */
export type FormValues = Readonly<Record<string, string | boolean | null>>;

/** A database row value: what the column holds. */
export type RowValues = Readonly<Record<string, string | boolean | null>>;

function normalise(value: string | boolean | null | undefined): string | boolean | null {
  if (typeof value === 'boolean') {
    return value;
  }

  if (value === null || value === undefined) {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length === 0 ? null : trimmed;
}

/**
 * The field names that differ, sorted so the same edit always produces the same
 * list — which is what makes it assertable in a test and readable in a log.
 *
 * A field present in `after` but absent from `before` counts as changed when its
 * value is not empty.
 */
export function changedFields(
  before: RowValues,
  after: FormValues,
  fields: readonly string[],
): readonly string[] {
  return fields.filter((field) => normalise(before[field]) !== normalise(after[field])).sort();
}

/**
 * The patch to send: only the changed fields, trimmed, with "" as `null`.
 *
 * `undefined` never appears — a column that is not in the patch keeps whatever
 * it had, which is the difference between "clear this" and "leave it alone".
 */
export function buildPatch(
  before: RowValues,
  after: FormValues,
  fields: readonly string[],
): Record<string, string | boolean | null> {
  const patch: Record<string, string | boolean | null> = {};

  for (const field of fields) {
    if (normalise(before[field]) !== normalise(after[field])) {
      patch[field] = normalise(after[field]);
    }
  }

  return patch;
}

/** True when saving would send nothing. The sheet then just closes. */
export function isUnchanged(
  before: RowValues,
  after: FormValues,
  fields: readonly string[],
): boolean {
  return changedFields(before, after, fields).length === 0;
}
