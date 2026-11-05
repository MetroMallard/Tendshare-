/**
 * The resend cooldown, as arithmetic rather than a `setInterval` scattered
 * through a screen.
 *
 * Two reasons it is a pure function: it is testable without a clock, and the
 * cooldown survives the screen re-rendering, which it does constantly while the
 * code is being typed.
 */

/** Long enough that a person can find the email, short enough not to annoy. */
export const RESEND_COOLDOWN_SECONDS = 30;

/** When the next code may be requested. */
export function nextAvailableAt(now: number, seconds: number = RESEND_COOLDOWN_SECONDS): number {
  return now + Math.max(0, seconds) * 1000;
}

/** Whole seconds left, rounded up, never negative. */
export function secondsRemaining(now: number, availableAt: number | null): number {
  if (availableAt === null) {
    return 0;
  }

  return Math.max(0, Math.ceil((availableAt - now) / 1000));
}

export function canResend(now: number, availableAt: number | null): boolean {
  return secondsRemaining(now, availableAt) === 0;
}
