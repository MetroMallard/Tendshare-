import { describe, expect, it } from 'vitest';

import { medProblemCopy, medProblemOf, type MedProblem } from './medActions';

describe('medProblemOf', () => {
  it('recognises the unique slot key, which is the only duplicate a family can hit', () => {
    expect(medProblemOf({ code: '23505' })).toBe('already_ticked');
    expect(
      medProblemOf({
        code: '23505',
        message: 'duplicate key value violates unique constraint "med_checkoffs_slot_key"',
      }),
    ).toBe('already_ticked');
  });

  it('reads a policy refusal as a permission problem, not a glitch', () => {
    expect(medProblemOf({ code: '42501' })).toBe('not_allowed');
    expect(
      medProblemOf({ message: 'new row violates row-level security policy for table "medications"' }),
    ).toBe('not_allowed');
    expect(medProblemOf({ code: '42501', message: 'this history is not shared with your role' })).toBe(
      'not_allowed',
    );
  });

  it('does not mistake a missing table or a network failure for a permission problem', () => {
    expect(medProblemOf({ code: '42P01', message: 'relation does not exist' })).toBe('unknown');
    expect(medProblemOf({ message: 'Failed to fetch' })).toBe('unknown');
    expect(medProblemOf(null)).toBe('unknown');
  });

  it('never reads a plan refusal as a permission problem', () => {
    // The med tables carry no plan trigger at all — ticking is free — so this
    // guards the day one is added by mistake.
    expect(
      medProblemOf({ code: 'P0001', message: 'the free plan cares for 1 person(s)' }),
    ).toBe('unknown');
  });
});

describe('medProblemCopy', () => {
  const problems: readonly MedProblem[] = ['not_allowed', 'already_ticked', 'offline', 'unknown'];

  it('has a calm sentence for every case', () => {
    for (const problem of problems) {
      const copy = medProblemCopy(problem);

      expect(copy.title.length).toBeGreaterThan(0);
      expect(copy.message.length).toBeGreaterThan(20);
    }
  });

  it('never blames the person and never says nothing was saved when something was', () => {
    for (const problem of problems) {
      const copy = medProblemCopy(problem);

      expect(copy.message).not.toMatch(/you (did|must|should|failed)/i);
      expect(copy.message).not.toMatch(/invalid|illegal|error:/i);
    }
  });

  it('says the tick already happened rather than showing a database error', () => {
    const copy = medProblemCopy('already_ticked');

    expect(copy.message).toMatch(/already ticked/i);
    expect(copy.message).toMatch(/nothing is wrong/i);
  });

  it('says what was kept, so nobody has to retype it', () => {
    expect(medProblemCopy('offline').message).toMatch(/still here/i);
    expect(medProblemCopy('unknown').message).toMatch(/still here/i);
    expect(medProblemCopy('not_allowed').message).toMatch(/nothing was changed/i);
  });
});
