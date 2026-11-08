import { describe, expect, it } from 'vitest';

import {
  actorName,
  checkOffLine,
  spokenTime,
  tickAccessibilityHint,
  tickAccessibilityLabel,
  tickedSentence,
  undoCopy,
} from './checkoffSentence';

/** A local moment, so the test does not depend on the machine's timezone. */
function at(hours: number, minutes: number): string {
  return new Date(2026, 10, 7, hours, minutes).toISOString();
}

describe('actorName', () => {
  it('uses the name when there is one', () => {
    expect(actorName('Sara')).toBe('Sara');
    expect(actorName('  Priya  ')).toBe('Priya');
  });

  it('says "Someone" when the account that ticked has been deleted', () => {
    expect(actorName(null)).toBe('Someone');
    expect(actorName('   ')).toBe('Someone');
  });
});

describe('spokenTime', () => {
  it('reads a timestamp as a clock time, in the device’s own time', () => {
    expect(spokenTime(at(8, 12))).toBe('8:12 am');
    expect(spokenTime(at(13, 0))).toBe('1:00 pm');
    expect(spokenTime(at(0, 5))).toBe('12:05 am');
    expect(spokenTime(at(12, 30))).toBe('12:30 pm');
  });

  it('answers nothing rather than "Invalid Date" for a broken value', () => {
    expect(spokenTime('not a date')).toBe('');
  });
});

describe('checkOffLine', () => {
  it('says who and when, which is the whole point of the row', () => {
    expect(checkOffLine({ takenByName: 'Sara', takenAt: at(8, 12) })).toBe('Sara, 8:12 am');
  });

  it('keeps the fact when the name is gone', () => {
    expect(checkOffLine({ takenByName: null, takenAt: at(8, 12) })).toBe('Someone, 8:12 am');
  });

  it('never shows a bare name with a broken timestamp', () => {
    expect(checkOffLine({ takenByName: 'Sara', takenAt: 'nope' })).toBe('Sara');
  });
});

describe('tickedSentence', () => {
  it('is the whole fact, in the past tense, for the Today card', () => {
    expect(tickedSentence({ takenByName: 'Sara', takenAt: at(8, 12) })).toBe(
      'Sara ticked this at 8:12 am',
    );
  });

  it('still makes sense with no name and no readable time', () => {
    expect(tickedSentence({ takenByName: null, takenAt: 'nope' })).toBe('Someone ticked this');
  });
});

describe('tickAccessibilityLabel', () => {
  it('names the medicine and the time, and says the state first', () => {
    expect(
      tickAccessibilityLabel({
        medicationName: 'Metformin',
        doseTime: '08:00',
        checkOff: null,
      }),
    ).toBe('Not ticked: Metformin 8:00 am');
  });

  it('says who ticked it, in the brief’s own words', () => {
    expect(
      tickAccessibilityLabel({
        medicationName: 'Metformin',
        doseTime: '08:00',
        checkOff: { takenByName: 'Sara', takenAt: at(8, 12) },
      }),
    ).toBe('Ticked: Metformin 8:00 am, by Sara');
  });

  it('never leaves the state to colour alone — a deleted account still says ticked', () => {
    expect(
      tickAccessibilityLabel({
        medicationName: 'Metformin',
        doseTime: '13:00:00',
        checkOff: { takenByName: null, takenAt: at(13, 4) },
      }),
    ).toBe('Ticked: Metformin 1:00 pm, by Someone');
  });
});

describe('tickAccessibilityHint', () => {
  it('says what the press will do', () => {
    expect(tickAccessibilityHint(null)).toMatch(/given/i);
    expect(tickAccessibilityHint({ takenByName: 'Sara', takenAt: at(8, 12) })).toMatch(
      /undoing/i,
    );
  });
});

describe('undoCopy', () => {
  it('names what disappears and says the history keeps it', () => {
    const copy = undoCopy({
      medicationName: 'Metformin',
      doseTime: '13:00',
      checkOff: { takenByName: 'Priya', takenAt: at(13, 4) },
    });

    expect(copy.title).toBe('Undo this tick?');
    expect(copy.message).toContain('Priya ticked the 1:00 pm Metformin');
    expect(copy.message).toMatch(/history keeps both/i);
    expect(copy.confirmLabel).toBe('Undo the tick');
  });
});
