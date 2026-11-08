/**
 * The change history, as sentences.
 *
 * `medication_history()` returns field *names*, never values — the audit trail
 * stores ids, enums and the names of the fields that changed, because a log that
 * carries values is a second copy of the health data with weaker rules around
 * it. So this file can say "Sara changed strength, 6 Nov" and cannot say what it
 * was before or after. That is deliberate, and it is why nothing here tries: a
 * screen that invented an old value would be making up a fact about somebody's
 * medicine.
 *
 * Every sentence is the same shape — who, what, when — because a list of mixed
 * shapes is a list nobody scans. The verb is the family's own word for the
 * action: added, changed, ticked, undid, archived.
 */
import { clockLabel, normalizeClock } from './doseSlots';
import { shortDate } from './refill';

/** One row of `medication_history()`. */
export interface MedicationHistoryEntry {
  /** ISO timestamp. */
  readonly occurredAt: string;
  /** `dose.ticked`, `dose.unticked`, or the action when the trigger set no event. */
  readonly event: string;
  readonly action: 'create' | 'update' | 'delete';
  readonly tableName: 'medications' | 'medication_times' | 'med_checkoffs' | string;
  readonly medicationId: string | null;
  /** Field names only. Never values. */
  readonly fields: readonly string[];
  readonly actorName: string | null;
  /** The clock time of a ticked dose, when the row carries one. */
  readonly doseTime: string | null;
}

/**
 * A column name as a family would say it.
 *
 * Only the columns a family can actually change are listed; anything else falls
 * back to the raw name with the underscores turned into spaces, which is ugly
 * but never wrong — and a new column must not silently become the word "a
 * field".
 */
const FIELD_LABELS: Readonly<Record<string, string>> = {
  name: 'name',
  strength: 'strength',
  form: 'form',
  instructions: 'instructions',
  starts_on: 'start date',
  ends_on: 'end date',
  refill_due_on: 'refill date',
  refill_reminder_days: 'refill reminder',
  time_of_day: 'time',
  label: 'time label',
  sort_order: 'time order',
};

export function fieldLabel(field: string): string {
  return FIELD_LABELS[field] ?? field.replace(/_/g, ' ');
}

/** "strength", "strength and form", "strength, form and instructions". */
export function fieldList(fields: readonly string[]): string {
  const labels = fields.map(fieldLabel);

  if (labels.length === 0) {
    return 'nothing';
  }

  if (labels.length === 1) {
    return labels[0] as string;
  }

  return `${labels.slice(0, -1).join(', ')} and ${labels[labels.length - 1] as string}`;
}

/** Who did it, as a name a family would use. A deleted account is "Someone". */
export function historyActor(name: string | null): string {
  const trimmed = name?.trim() ?? '';

  return trimmed.length > 0 ? trimmed : 'Someone';
}

/** The day a change happened, as the short date the rest of the screen uses. */
export function historyDate(occurredAt: string): string {
  const parsed = new Date(occurredAt);

  if (Number.isNaN(parsed.getTime())) {
    return '';
  }

  const year = parsed.getFullYear();
  const month = String(parsed.getMonth() + 1).padStart(2, '0');
  const day = String(parsed.getDate()).padStart(2, '0');

  return shortDate(`${year}-${month}-${day}`);
}

/**
 * One entry, in one plain sentence.
 *
 * The tick and the undo are the two events with their own words, because they
 * are the two a family actually argues about: who gave the 1 pm dose, and who
 * took the tick back. Everything else is a change to the schedule.
 */
export function historySentence(entry: MedicationHistoryEntry): string {
  const actor = historyActor(entry.actorName);
  const when = historyDate(entry.occurredAt);
  const tail = when.length > 0 ? `, ${when}` : '';

  if (entry.event === 'dose.ticked') {
    return entry.doseTime === null
      ? `${actor} ticked a dose${tail}`
      : `${actor} ticked the ${clockLabel(normalizeClock(entry.doseTime))} dose${tail}`;
  }

  if (entry.event === 'dose.unticked') {
    return `${actor} undid a tick${tail}`;
  }

  if (entry.tableName === 'medications') {
    if (entry.action === 'create') {
      return `${actor} added a medicine${tail}`;
    }

    if (entry.action === 'delete') {
      return `${actor} removed a medicine${tail}`;
    }

    // An archive is a change to one field, and "changed archived at" would be
    // the app talking to itself. The two directions get their own words.
    if (entry.fields.length === 1 && entry.fields[0] === 'archived_at') {
      return `${actor} archived a medicine${tail}`;
    }

    return `${actor} changed ${fieldList(entry.fields)}${tail}`;
  }

  if (entry.tableName === 'medication_times') {
    if (entry.action === 'create') {
      return `${actor} added a time${tail}`;
    }

    if (entry.action === 'delete') {
      return `${actor} removed a time${tail}`;
    }

    return `${actor} changed a time${tail}`;
  }

  return `${actor} changed a medicine${tail}`;
}

/**
 * The sentence for the one-line summary at the top of the history sheet.
 *
 * A sheet with nothing in it should say what the list *is* rather than show a
 * blank panel, and the sentence differs for a single medicine and for the whole
 * circle.
 */
export function historyEmptyCopy(medicationName: string | null): {
  readonly headline: string;
  readonly body: string;
} {
  return medicationName === null
    ? {
        headline: 'No changes yet',
        body: 'Every change to a medicine, and every tick, is written down here as it happens.',
      }
    : {
        headline: 'No changes yet',
        body: `Nothing has been changed on ${medicationName} since it was added. Every change and every tick appears here.`,
      };
}
