/**
 * What screen 3's buttons say, and whether they can be pressed.
 *
 * The brief for this task is blunt: the invite button may only be enabled if it
 * truly sends. Invites are Task 11 — there is no invitation table, no email
 * service and no deep link yet — so today the honest screen is:
 *
 *   * add addresses if you like, and they are kept **on this device** with a
 *     plain statement that nothing has been sent;
 *   * leave with **"Invite them later"**, which is the primary action when no
 *     addresses have been added, so the skip is the obvious path rather than a
 *     grey line at the bottom of the screen.
 *
 * A `features.invitesEnabled` flag flips the same function to the real flow in
 * Task 11. No screen ever claims an email was sent when it was not.
 */
import { features } from '../lib/features';

export interface InviteAction {
  readonly label: string;
  readonly testID: string;
  /** Shown under the buttons when the action needs explaining. */
  readonly hint?: string;
}

export interface InviteActions {
  readonly primary: InviteAction;
  /** The skip. Always present, always prominent — never hidden behind a link. */
  readonly secondary: InviteAction | null;
}

export interface InviteActionInput {
  readonly addressCount: number;
  /** Whether this build can actually send invitations. */
  readonly invitesEnabled: boolean;
}

export function inviteActions({ addressCount, invitesEnabled }: InviteActionInput): InviteActions {
  const hasAddresses = addressCount > 0;

  if (!invitesEnabled) {
    return {
      primary: hasAddresses
        ? {
            label: 'Save and finish',
            testID: 'onboarding-finish',
            hint: 'Nothing has been sent yet. These addresses stay on this device until invites are switched on.',
          }
        : {
            label: 'Invite them later',
            testID: 'onboarding-finish',
            hint: 'You can invite your family any time from the More tab.',
          },
      secondary: hasAddresses
        ? {
            label: 'Invite them later',
            testID: 'onboarding-skip',
            hint: 'Finish without keeping these addresses.',
          }
        : null,
    };
  }

  return {
    primary: hasAddresses
      ? { label: 'Send invites', testID: 'onboarding-finish' }
      : { label: 'Finish setup', testID: 'onboarding-finish' },
    secondary: hasAddresses ? { label: 'Invite them later', testID: 'onboarding-skip' } : null,
  };
}

/** The actions as the app should render them today. */
export function currentInviteActions(addressCount: number): InviteActions {
  return inviteActions({ addressCount, invitesEnabled: features.invitesEnabled });
}
