import { describe, expect, it } from 'vitest';

import {
  fieldLabel,
  fieldList,
  historyActor,
  historyDate,
  historyEmptyCopy,
  historySentence,
  type MedicationHistoryEntry,
} from './historySentence';

function entry(overrides: Partial<MedicationHistoryEntry> = {}): MedicationHistoryEntry {
  return {
    occurredAt: new Date(2026, 10, 6, 9, 30).toISOString(),
    event: 'update',
    action: 'update',
    tableName: 'medications',
    medicationId: 'm1',
    fields: ['strength'],
    actorName: 'Sara',
    doseTime: null,
    ...overrides,
  };
}

describe('fieldLabel', () => {
  it('says a column the way a family would', () => {
    expect(fieldLabel('strength')).toBe('strength');
    expect(fieldLabel('refill_due_on')).toBe('refill date');
    expect(fieldLabel('refill_reminder_days')).toBe('refill reminder');
    expect(fieldLabel('starts_on')).toBe('start date');
  });

  it('falls back to the raw name with spaces, never to "a field"', () => {
    expect(fieldLabel('some_new_column')).toBe('some new column');
  });
});

describe('fieldList', () => {
  it('reads as a sentence for one, two and three fields', () => {
    expect(fieldList(['strength'])).toBe('strength');
    expect(fieldList(['strength', 'form'])).toBe('strength and form');
    expect(fieldList(['strength', 'form', 'instructions'])).toBe(
      'strength, form and instructions',
    );
  });

  it('says "nothing" rather than an empty string', () => {
    expect(fieldList([])).toBe('nothing');
  });
});

describe('historyActor', () => {
  it('names the person, or says Someone when the account is gone', () => {
    expect(historyActor('Priya')).toBe('Priya');
    expect(historyActor(null)).toBe('Someone');
    expect(historyActor('  ')).toBe('Someone');
  });
});

describe('historyDate', () => {
  it('is the short date the rest of the screen uses', () => {
    expect(historyDate(new Date(2026, 10, 7, 8, 12).toISOString())).toBe('7 Nov');
  });

  it('answers nothing for a broken timestamp', () => {
    expect(historyDate('nope')).toBe('');
  });
});

describe('historySentence', () => {
  it('builds the three sentences the brief asks for', () => {
    expect(historySentence(entry({ occurredAt: new Date(2026, 10, 6, 9).toISOString() }))).toBe(
      'Sara changed strength, 6 Nov',
    );

    expect(
      historySentence(
        entry({
          event: 'dose.ticked',
          action: 'create',
          tableName: 'med_checkoffs',
          fields: [],
          actorName: 'Priya',
          doseTime: '13:00:00',
          occurredAt: new Date(2026, 10, 7, 13, 4).toISOString(),
        }),
      ),
    ).toBe('Priya ticked the 1:00 pm dose, 7 Nov');

    expect(
      historySentence(
        entry({
          event: 'dose.unticked',
          action: 'delete',
          tableName: 'med_checkoffs',
          fields: [],
          actorName: 'Tom',
          doseTime: '13:00:00',
          occurredAt: new Date(2026, 10, 7, 13, 9).toISOString(),
        }),
      ),
    ).toBe('Tom undid a tick, 7 Nov');
  });

  it('says "a dose" when an older row carries no clock time', () => {
    expect(
      historySentence(
        entry({ event: 'dose.ticked', tableName: 'med_checkoffs', fields: [], doseTime: null }),
      ),
    ).toBe('Sara ticked a dose, 6 Nov');
  });

  it('names every field that changed, in the family’s words', () => {
    expect(historySentence(entry({ fields: ['strength', 'form'] }))).toBe(
      'Sara changed strength and form, 6 Nov',
    );
    expect(historySentence(entry({ fields: ['refill_due_on'] }))).toBe(
      'Sara changed refill date, 6 Nov',
    );
  });

  it('gives an archive its own verb instead of "changed archived at"', () => {
    expect(historySentence(entry({ fields: ['archived_at'] }))).toBe(
      'Sara archived a medicine, 6 Nov',
    );
  });

  it('covers adding a medicine and the times that go with it', () => {
    expect(historySentence(entry({ action: 'create', fields: ['name'] }))).toBe(
      'Sara added a medicine, 6 Nov',
    );
    expect(historySentence(entry({ tableName: 'medication_times', action: 'create' }))).toBe(
      'Sara added a time, 6 Nov',
    );
    expect(historySentence(entry({ tableName: 'medication_times', action: 'delete' }))).toBe(
      'Sara removed a time, 6 Nov',
    );
  });

  it('never shows a value — only the field name — because the server sends none', () => {
    const sentence = historySentence(entry({ fields: ['strength'] }));

    expect(sentence).not.toContain('500');
    expect(sentence).not.toContain('mg');
  });

  it('still reads as a sentence with no actor name and no date', () => {
    expect(historySentence(entry({ actorName: null, occurredAt: 'nope' }))).toBe(
      'Someone changed strength',
    );
  });
});

describe('historyEmptyCopy', () => {
  it('says what the list is, for the circle and for one medicine', () => {
    expect(historyEmptyCopy(null).body).toMatch(/every change/i);
    expect(historyEmptyCopy('Metformin').body).toContain('Metformin');
  });
});
