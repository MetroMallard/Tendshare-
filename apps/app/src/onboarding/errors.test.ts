/**
 * What the person reads when finishing setup fails.
 *
 * The point of these tests is not the wording — it is the two promises the
 * wording keeps: a raw database message never reaches the screen, and a plan
 * limit is explained as a plan limit rather than as an error.
 */
import { describe, expect, it } from 'vitest';

import {
  describeOnboardingFailure,
  onboardingFailureOf,
  type OnboardingFailureKind,
} from './errors';

const KINDS: readonly OnboardingFailureKind[] = [
  'offline',
  'not_configured',
  'signed_out',
  'name_missing',
  'details_missing',
  'plan_limit',
  'not_allowed',
  'invalid_details',
  'already_set_up',
  'unknown',
];

describe('every failure', () => {
  it('has a title and a sentence, both written for a person', () => {
    for (const kind of KINDS) {
      const failure = onboardingFailureOf(kind);
      expect(failure.kind).toBe(kind);
      expect(failure.title.length).toBeGreaterThan(3);
      expect(failure.message.length).toBeGreaterThan(30);
      expect(failure.message).not.toMatch(/PGRST|PostgREST|pg_|relation "|row-level security/i);
    }
  });

  it('says nothing about health, doses or treatment', () => {
    for (const kind of KINDS) {
      expect(onboardingFailureOf(kind).message).not.toMatch(
        /\b(dose|dosage|mg|milligram|diagnos\w*|medical advice|prescri\w*|treat\w*)\b/i,
      );
    }
  });
});

describe('the plan limit', () => {
  it('is recognised from the trigger’s own message', () => {
    const failure = describeOnboardingFailure({
      code: 'P0001',
      message: 'the free plan cares for 1 person(s); upgrade to add another',
    });

    expect(failure.kind).toBe('plan_limit');
    expect(failure.message).toContain('Family Plus');
    expect(failure.message).not.toContain('P0001');
    expect(failure.message).not.toContain('person(s)');
  });

  it('is recognised even if the message is reworded later', () => {
    expect(describeOnboardingFailure({ code: null, message: 'upgrade to add another' }).kind).toBe(
      'plan_limit',
    );
  });

  it('is not a retry — pressing the same button again cannot help', () => {
    expect(describeOnboardingFailure({ code: 'P0001', message: '' }).retryable).toBe(false);
  });
});

describe('the rest of the database errors', () => {
  it('maps a row-level security refusal to a plain permission sentence', () => {
    const failure = describeOnboardingFailure({
      code: '42501',
      message: 'new row violates row-level security policy for table "circles"',
    });

    expect(failure.kind).toBe('not_allowed');
    expect(failure.message).not.toContain('row-level security');
    expect(failure.message).not.toContain('circles');
  });

  it('maps a check constraint to "check the details"', () => {
    expect(
      describeOnboardingFailure({ code: '23514', message: 'violates check constraint' }).kind,
    ).toBe('invalid_details');
  });

  it('maps a foreign key failure to a stale session', () => {
    expect(
      describeOnboardingFailure({ code: '23503', message: 'violates foreign key constraint' }).kind,
    ).toBe('signed_out');
  });

  it('maps a unique violation to "already set up"', () => {
    expect(describeOnboardingFailure({ code: '23505', message: 'duplicate key value' }).kind).toBe(
      'already_set_up',
    );
  });

  it('falls back to a calm unknown for anything else', () => {
    expect(describeOnboardingFailure({ code: 'XX000', message: 'internal error' }).kind).toBe(
      'unknown',
    );
    expect(describeOnboardingFailure(null).kind).toBe('unknown');
  });
});

describe('the states a screen knows without the network', () => {
  it('offline wins over a database message', () => {
    expect(
      describeOnboardingFailure({ code: '42501', message: 'nope' }, { offline: true }).kind,
    ).toBe('offline');
  });

  it('a dropped connection is recognised from the error itself', () => {
    expect(describeOnboardingFailure({ code: null, message: 'Failed to fetch' }).kind).toBe(
      'offline',
    );
    expect(describeOnboardingFailure({ code: null, message: 'Network request failed' }).kind).toBe(
      'offline',
    );
  });

  it('a build with no server settings says so', () => {
    expect(describeOnboardingFailure(null, { notConfigured: true }).kind).toBe('not_configured');
  });

  it('a session that ended mid-flow says so', () => {
    expect(describeOnboardingFailure(null, { signedOut: true }).kind).toBe('signed_out');
  });
});
