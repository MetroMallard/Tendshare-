import { describe, expect, it } from 'vitest';

import { canResend, nextAvailableAt, secondsRemaining } from './cooldown';

describe('resend cooldown', () => {
  it('counts whole seconds down and stops at zero', () => {
    const start = 1_000_000;
    const availableAt = nextAvailableAt(start, 30);

    expect(secondsRemaining(start, availableAt)).toBe(30);
    expect(secondsRemaining(start + 12_500, availableAt)).toBe(18);
    expect(secondsRemaining(start + 30_000, availableAt)).toBe(0);
    expect(secondsRemaining(start + 90_000, availableAt)).toBe(0);
  });

  it('allows a resend before any code has been sent', () => {
    expect(canResend(0, null)).toBe(true);
  });

  it('never runs backwards', () => {
    expect(secondsRemaining(5_000, 4_000)).toBe(0);
  });
});
