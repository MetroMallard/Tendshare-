import { describe, expect, it } from 'vitest';

import { resolveCircleState, type MembershipSummary } from './circleState';

function member(circleId: string, role: MembershipSummary['role']): MembershipSummary {
  return { circleId, role };
}

describe('no memberships at all', () => {
  it('means this person has never set up a circle', () => {
    expect(resolveCircleState({ memberships: [], circleIdsWithRecipient: [] })).toEqual({
      state: 'none',
      circleId: null,
    });
  });
});

describe('an owned circle with a person in it', () => {
  it('means setup is finished', () => {
    expect(
      resolveCircleState({
        memberships: [member('circle-a', 'owner')],
        circleIdsWithRecipient: ['circle-a'],
      }),
    ).toEqual({ state: 'ready', circleId: null });
  });
});

describe('an owned circle with nobody in it', () => {
  it('is the half-finished state a network failure leaves behind', () => {
    expect(
      resolveCircleState({
        memberships: [member('circle-a', 'owner')],
        circleIdsWithRecipient: [],
      }),
    ).toEqual({ state: 'incomplete', circleId: 'circle-a' });
  });

  it('is what lets a retry adopt the circle instead of making a second one', () => {
    const resolution = resolveCircleState({
      memberships: [member('circle-a', 'owner'), member('circle-b', 'owner')],
      circleIdsWithRecipient: [],
    });

    expect(resolution.state).toBe('incomplete');
    expect(resolution.circleId).toBe('circle-a');
  });

  it('does not hide a finished circle behind an unfinished one', () => {
    expect(
      resolveCircleState({
        memberships: [member('circle-a', 'owner'), member('circle-b', 'owner')],
        circleIdsWithRecipient: ['circle-b'],
      }).state,
    ).toBe('ready');
  });
});

describe('a circle someone else owns', () => {
  it('is a working circle for an invited member — not a reason to onboard them', () => {
    for (const role of ['family_member', 'view_only', 'visiting_helper'] as const) {
      expect(
        resolveCircleState({
          memberships: [member('circle-a', role)],
          circleIdsWithRecipient: ['circle-a'],
        }),
      ).toEqual({ state: 'ready', circleId: null });
    }
  });

  it('wins over an unfinished circle of their own, so they are never stuck', () => {
    expect(
      resolveCircleState({
        memberships: [member('circle-a', 'family_member'), member('circle-b', 'owner')],
        circleIdsWithRecipient: ['circle-a'],
      }).state,
    ).toBe('ready');
  });
});
