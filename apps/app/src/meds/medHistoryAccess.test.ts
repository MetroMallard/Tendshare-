import { describe, expect, it } from 'vitest';

import { ALL_ROLES, capabilitiesFor } from '../circles/roles';
import { canReadMedHistory } from './medHistoryAccess';

/**
 * The one place the screen's rule and `medication_history()` are held together.
 *
 * The function refuses a visiting helper and serves everybody else. If a role's
 * capabilities change, this table is where the screen finds out.
 */
describe('canReadMedHistory', () => {
  it('lets the three roles `medication_history()` serves read the history', () => {
    expect(canReadMedHistory(capabilitiesFor('owner'))).toBe(true);
    expect(canReadMedHistory(capabilitiesFor('family_member'))).toBe(true);
    expect(canReadMedHistory(capabilitiesFor('view_only'))).toBe(true);
  });

  it('refuses a visiting helper, who is refused by the function itself', () => {
    expect(canReadMedHistory(capabilitiesFor('visiting_helper'))).toBe(false);
  });

  it('answers the same for every role in the map — no role is left unhandled', () => {
    const answers = ALL_ROLES.map((role) => [role, canReadMedHistory(capabilitiesFor(role))]);

    expect(answers).toEqual([
      ['owner', true],
      ['family_member', true],
      ['view_only', true],
      ['visiting_helper', false],
    ]);
  });

  it('shows nothing to somebody who cannot see the med list at all', () => {
    expect(canReadMedHistory(capabilitiesFor(null))).toBe(false);
  });
});
