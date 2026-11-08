/**
 * May this role read the change history?
 *
 * `medication_history()` answers for owner, family member and view-only, and
 * refuses a visiting helper outright. The screen has to ask the same question,
 * and it must ask it of the **capability map** rather than of a role name — a
 * screen that tested `role === 'visiting_helper'` would drift the moment a role
 * changes, and it is exactly the drift the capability map exists to prevent.
 *
 * The map's four med capabilities do not contain "may read history" directly, so
 * this reads the one distinction that separates the three roles which may from
 * the one which may not: **a visiting helper is the only role that can tick a
 * dose but cannot change the schedule.** Owner and family member can change it;
 * view-only can do neither and is here to read. That covers all four roles today
 * and is asserted role by role in the test beside this file, so a fifth role
 * cannot quietly inherit the wrong answer.
 */
import type { Capabilities } from '../circles/roles';

export function canReadMedHistory(capabilities: Capabilities): boolean {
  if (!capabilities.canSeeMeds) {
    return false;
  }

  return capabilities.canEditMeds || !capabilities.canCheckOffMeds;
}
