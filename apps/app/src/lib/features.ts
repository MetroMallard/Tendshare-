/**
 * Features that exist in the code but are not switched on yet.
 *
 * One flat object, read by screens, so switching something on is a one-line
 * change and not a hunt through the tree. Anything here must be **honest when
 * off**: a screen behind a false flag explains what is not available instead of
 * pretending, and never claims an action happened that did not.
 */
export const features = {
  /**
   * Invitations (Task 11). There is no invitation table, no email service and no
   * deep link yet, so screen 3 collects addresses locally and says plainly that
   * nothing has been sent. Flipping this to `true` turns the same screen into a
   * real send — see `src/onboarding/inviteActions.ts`.
   */
  invitesEnabled: false,
} as const;
