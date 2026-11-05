/**
 * The finish flow, against a fake that fails on demand.
 *
 * The failure cases are the reason this file exists. A happy path is easy; the
 * bug the brief calls out is the half-created circle — a circle row with no
 * person in it, left behind by a network failure between two writes, which then
 * costs the plan its "one person cared for" and shows Today nothing to look at.
 * Every ordering and rollback promise below is a promise that cannot happen.
 */
import { describe, expect, it } from 'vitest';

import { circleNameFor, completeOnboarding } from './complete';
import { DRAFT_VERSION, type OnboardingDraft } from './draft';
import type { PostgrestFailure } from './errors';
import type { CreateCircleOutcome, OnboardingWrites } from './writes';

const DRAFT: OnboardingDraft = {
  version: DRAFT_VERSION,
  step: 'invite',
  displayName: 'Sara Jones',
  recipientName: 'Margaret',
  relationship: 'Mother',
  invites: ['mike@example.com'],
  circleId: null,
};

const USER = 'user-1';
const NEW_CIRCLE = 'circle-new';

const RLS_REFUSAL: PostgrestFailure = {
  code: '42501',
  message: 'new row violates row-level security policy for table "circles"',
};

const PLAN_LIMIT: PostgrestFailure = {
  code: 'P0001',
  message: 'the free plan cares for 1 person(s); upgrade to add another',
};

interface FakeOptions {
  readonly failName?: PostgrestFailure;
  readonly failCircle?: PostgrestFailure;
  readonly failRecipient?: PostgrestFailure;
  readonly failDelete?: PostgrestFailure;
}

function fakeWrites(options: FakeOptions = {}) {
  const calls: string[] = [];

  const writes: OnboardingWrites = {
    async saveDisplayName(userId, displayName) {
      calls.push(`profile:${userId}:${displayName}`);
      return options.failName ?? null;
    },
    async createCircle({ name, ownerId }): Promise<CreateCircleOutcome> {
      calls.push(`circle:${name}:${ownerId}`);

      return options.failCircle
        ? { ok: false, failure: options.failCircle }
        : { ok: true, circleId: NEW_CIRCLE };
    },
    async createRecipient({ circleId, fullName, relationship }) {
      calls.push(`recipient:${circleId}:${fullName}:${relationship}`);
      return options.failRecipient ?? null;
    },
    async deleteCircle(circleId) {
      calls.push(`delete:${circleId}`);
      return options.failDelete ?? null;
    },
  };

  return { writes, calls };
}

describe('finishing successfully', () => {
  it('writes the profile, then the circle, then the person — in that order', async () => {
    const { writes, calls } = fakeWrites();

    const result = await completeOnboarding(writes, { userId: USER, draft: DRAFT });

    expect(calls).toEqual([
      `profile:${USER}:Sara Jones`,
      `circle:Margaret's circle:${USER}`,
      `recipient:${NEW_CIRCLE}:Margaret:Mother`,
    ]);

    expect(result).toEqual({ ok: true, circleId: NEW_CIRCLE, invites: ['mike@example.com'] });
  });

  it('tidies the names before they are written', async () => {
    const { writes, calls } = fakeWrites();

    await completeOnboarding(writes, {
      userId: USER,
      draft: { ...DRAFT, displayName: '  Sara   Jones ', recipientName: ' Margaret ' },
    });

    expect(calls[0]).toBe(`profile:${USER}:Sara Jones`);
    expect(calls[2]).toBe(`recipient:${NEW_CIRCLE}:Margaret:Mother`);
  });
});

describe('nothing is written when the answers are not there', () => {
  it('stops before the network for an empty name', async () => {
    const { writes, calls } = fakeWrites();

    const result = await completeOnboarding(writes, {
      userId: USER,
      draft: { ...DRAFT, displayName: '   ' },
    });

    expect(calls).toEqual([]);
    expect(result.ok).toBe(false);
    expect(result.ok === false && result.failure.kind).toBe('name_missing');
  });

  it('stops before the network when the person is only half described', async () => {
    for (const draft of [
      { ...DRAFT, recipientName: '' },
      { ...DRAFT, relationship: null },
    ]) {
      const { writes, calls } = fakeWrites();
      const result = await completeOnboarding(writes, { userId: USER, draft });

      expect(calls).toEqual([]);
      expect(result.ok === false && result.failure.kind).toBe('details_missing');
    }
  });

  it('stops before the network when the device is offline', async () => {
    const { writes, calls } = fakeWrites();

    const result = await completeOnboarding(writes, { userId: USER, draft: DRAFT, offline: true });

    expect(calls).toEqual([]);
    expect(result.ok === false && result.failure.kind).toBe('offline');
  });

  it('stops before the network when the build has no server settings', async () => {
    const { writes, calls } = fakeWrites();

    const result = await completeOnboarding(writes, {
      userId: USER,
      draft: DRAFT,
      notConfigured: true,
    });

    expect(calls).toEqual([]);
    expect(result.ok === false && result.failure.kind).toBe('not_configured');
  });
});

describe('when the profile cannot be saved', () => {
  it('creates no circle at all', async () => {
    const { writes, calls } = fakeWrites({ failName: RLS_REFUSAL });

    const result = await completeOnboarding(writes, { userId: USER, draft: DRAFT });

    expect(calls).toEqual([`profile:${USER}:Sara Jones`]);
    expect(result.ok).toBe(false);
    expect(result.ok === false && result.failure.kind).toBe('not_allowed');
    expect(result.ok === false && result.circleId).toBeNull();
  });
});

describe('when the circle cannot be created', () => {
  it('never writes a person against a circle that does not exist', async () => {
    const { writes, calls } = fakeWrites({ failCircle: RLS_REFUSAL });

    const result = await completeOnboarding(writes, { userId: USER, draft: DRAFT });

    expect(calls.some((call) => call.startsWith('recipient:'))).toBe(false);
    expect(result.ok === false && result.circleId).toBeNull();
  });

  it('says something a person can read instead of the database message', async () => {
    const { writes } = fakeWrites({ failCircle: RLS_REFUSAL });

    const result = await completeOnboarding(writes, { userId: USER, draft: DRAFT });
    const failure = result.ok === false ? result.failure : null;

    expect(failure?.message).not.toContain('row-level security');
    expect(failure?.message).not.toContain('circles');
    expect(failure?.retryable).toBe(true);
  });
});

describe('when the person cannot be added to a circle that was just created', () => {
  it('undoes the circle, so a retry starts clean and creates exactly one', async () => {
    const { writes, calls } = fakeWrites({ failRecipient: PLAN_LIMIT });

    const result = await completeOnboarding(writes, { userId: USER, draft: DRAFT });

    expect(calls).toEqual([
      `profile:${USER}:Sara Jones`,
      `circle:Margaret's circle:${USER}`,
      `recipient:${NEW_CIRCLE}:Margaret:Mother`,
      `delete:${NEW_CIRCLE}`,
    ]);
    expect(result.ok).toBe(false);
    expect(result.ok === false && result.circleId).toBeNull();
  });

  it('explains a plan limit as a plan limit', async () => {
    const { writes } = fakeWrites({ failRecipient: PLAN_LIMIT });

    const result = await completeOnboarding(writes, { userId: USER, draft: DRAFT });

    expect(result.ok === false && result.failure.kind).toBe('plan_limit');
  });

  it('keeps the circle when the undo itself fails, so the retry can finish it', async () => {
    const { writes, calls } = fakeWrites({ failRecipient: PLAN_LIMIT, failDelete: RLS_REFUSAL });

    const result = await completeOnboarding(writes, { userId: USER, draft: DRAFT });

    expect(calls.at(-1)).toBe(`delete:${NEW_CIRCLE}`);
    expect(result.ok === false && result.circleId).toBe(NEW_CIRCLE);
  });
});

describe('retrying after a failure', () => {
  it('adopts the circle it was given instead of creating a second one', async () => {
    const { writes, calls } = fakeWrites();

    const result = await completeOnboarding(writes, {
      userId: USER,
      draft: { ...DRAFT, circleId: 'circle-from-last-time' },
      existingCircleId: 'circle-from-last-time',
    });

    expect(calls.some((call) => call.startsWith('circle:'))).toBe(false);
    expect(calls).toContain('recipient:circle-from-last-time:Margaret:Mother');
    expect(result).toEqual({
      ok: true,
      circleId: 'circle-from-last-time',
      invites: ['mike@example.com'],
    });
  });

  it('does not undo a circle it did not create this time', async () => {
    const { writes, calls } = fakeWrites({ failRecipient: PLAN_LIMIT });

    await completeOnboarding(writes, {
      userId: USER,
      draft: DRAFT,
      existingCircleId: 'circle-from-last-time',
    });

    // The person still gets a clean retry, and the adopted circle is removed so
    // the plan limit is not spent twice.
    expect(calls).toContain('delete:circle-from-last-time');
  });
});

describe('the circle’s name', () => {
  it('is the cared-for person’s, so the switcher reads like a family, not a database', () => {
    expect(circleNameFor('Margaret')).toBe("Margaret's circle");
    expect(circleNameFor('  Margaret  ')).toBe("Margaret's circle");
  });

  it('fits the column even for a very long name', () => {
    expect(circleNameFor('a'.repeat(200)).length).toBeLessThanOrEqual(80);
  });
});
