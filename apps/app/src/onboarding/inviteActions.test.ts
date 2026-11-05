import { describe, expect, it } from 'vitest';

import { inviteActions } from './inviteActions';

describe('while invites are switched off — which is today', () => {
  it('makes the skip the primary action when no addresses have been added', () => {
    const actions = inviteActions({ addressCount: 0, invitesEnabled: false });

    expect(actions.primary.label).toBe('Invite them later');
    expect(actions.secondary).toBeNull();
  });

  it('never claims an email was sent', () => {
    for (const addressCount of [0, 1, 3]) {
      const actions = inviteActions({ addressCount, invitesEnabled: false });
      const labels = [actions.primary.label, actions.secondary?.label ?? '']
        .join(' ')
        .toLowerCase();

      // No button in this state may say it sends anything.
      expect(labels).not.toMatch(/send|sent|delivered|email|invite them now/);
      // And the hint has to say what actually happens to the addresses.
      expect(actions.primary.hint?.toLowerCase()).toMatch(/this device|more tab/);
    }
  });

  it('says plainly that nothing has been sent once an address is added', () => {
    const actions = inviteActions({ addressCount: 2, invitesEnabled: false });
    expect(actions.primary.hint?.toLowerCase()).toContain('nothing has been sent');
  });

  it('offers the skip as a real, separate button once there is something to skip', () => {
    const actions = inviteActions({ addressCount: 2, invitesEnabled: false });

    expect(actions.primary.label).toBe('Save and finish');
    expect(actions.secondary?.label).toBe('Invite them later');
    expect(actions.secondary?.testID).not.toBe(actions.primary.testID);
  });
});

describe('once invites are switched on', () => {
  it('sends, and says so', () => {
    const actions = inviteActions({ addressCount: 2, invitesEnabled: true });
    expect(actions.primary.label).toBe('Send invites');
    expect(actions.secondary?.label).toBe('Invite them later');
  });

  it('still lets someone finish without inviting anybody', () => {
    const actions = inviteActions({ addressCount: 0, invitesEnabled: true });
    expect(actions.primary.label).toBe('Finish setup');
    expect(actions.secondary).toBeNull();
  });
});

describe('the buttons', () => {
  it('always have a distinct test id for the finish and the skip', () => {
    const actions = inviteActions({ addressCount: 1, invitesEnabled: false });
    expect(actions.primary.testID).toBe('onboarding-finish');
    expect(actions.secondary?.testID).toBe('onboarding-skip');
  });
});
