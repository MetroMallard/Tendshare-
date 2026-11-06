import { describe, expect, it } from 'vitest';

import {
  memberProblemCopy,
  memberProblemOf,
  validateCircleName,
  type MemberProblem,
} from './memberActions';
import { CIRCLE_NAME_MAX_LENGTH } from './roles';

describe('reading a refusal from the database', () => {
  it('recognises our own plan-limit trigger', () => {
    expect(
      memberProblemOf({
        message: 'the free plan covers up to 3 people in a circle; upgrade to add another',
      }),
    ).toBe('plan_limit');
    expect(memberProblemOf({ message: 'the free plan cares for 1 person(s)' })).toBe('plan_limit');
  });

  it('recognises a policy refusal, by code or by message', () => {
    expect(memberProblemOf({ message: 'new row violates row-level security policy', code: '42501' }))
      .toBe('not_allowed');
    expect(memberProblemOf({ message: 'permission denied for table circle_members' })).toBe(
      'not_allowed',
    );
    expect(memberProblemOf({ code: '42501' })).toBe('not_allowed');
  });

  it('recognises a network failure', () => {
    expect(memberProblemOf({ message: 'TypeError: Failed to fetch' })).toBe('offline');
    expect(memberProblemOf({ message: 'Network request failed' })).toBe('offline');
    expect(memberProblemOf({ message: 'TimeoutError: timeout' })).toBe('offline');
  });

  it('falls back to something safe rather than guessing', () => {
    expect(memberProblemOf({ message: 'unexpected things' })).toBe('unknown');
    expect(memberProblemOf({})).toBe('unknown');
  });

  it('never reads a plan refusal as a permission problem', () => {
    // The plan trigger raises P0001; a policy refusal is 42501. Same shape of
    // error, very different sentence for the family.
    expect(
      memberProblemOf({
        message: 'the family plan covers up to 3 people in a circle; upgrade to add another',
        code: 'P0001',
      }),
    ).toBe('plan_limit');
  });
});

describe('what we say when a change is refused', () => {
  const problems: readonly MemberProblem[] = ['not_allowed', 'plan_limit', 'offline', 'unknown'];

  it('has a calm sentence for each problem, with nothing technical in it', () => {
    for (const problem of problems) {
      const copy = memberProblemCopy(problem);

      expect(copy.title.length).toBeGreaterThan(3);
      expect(copy.message.length).toBeGreaterThan(20);
      expect(`${copy.title} ${copy.message}`).not.toMatch(/row-level|rls|42501|p0001|policy|error/i);
      expect(`${copy.title} ${copy.message}`).not.toContain('_');
    }
  });

  it('says plainly that nothing was lost, and nobody was removed', () => {
    expect(memberProblemCopy('plan_limit').message).toMatch(/Nobody has been removed/i);
    expect(memberProblemCopy('not_allowed').message).toMatch(/Nothing has changed/i);
    expect(memberProblemCopy('offline').message).toMatch(/Nothing has changed/i);
  });
});

describe('the circle name', () => {
  it('refuses an empty name', () => {
    expect(validateCircleName('')).toBe('Please give the circle a name.');
    expect(validateCircleName('   ')).toBe('Please give the circle a name.');
  });

  it('accepts a name at the soft limit', () => {
    expect(validateCircleName('a'.repeat(CIRCLE_NAME_MAX_LENGTH))).toBeNull();
  });

  it('refuses one character more, in plain words', () => {
    expect(validateCircleName('a'.repeat(CIRCLE_NAME_MAX_LENGTH + 1))).toBe(
      `Keep it to ${String(CIRCLE_NAME_MAX_LENGTH)} characters or fewer.`,
    );
  });

  it('measures the trimmed name, so trailing spaces never count', () => {
    expect(validateCircleName(`  ${'a'.repeat(CIRCLE_NAME_MAX_LENGTH)}  `)).toBeNull();
  });
});
