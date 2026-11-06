import { describe, expect, it } from 'vitest';

import {
  chooseActiveCircle,
  circleDisplayName,
  rememberedChoiceFor,
  shouldShowSwitcher,
  type CircleSummary,
} from './activeCircle';
import type { CircleRole } from './circleState';

function circle(
  circleId: string,
  options: Partial<Omit<CircleSummary, 'circleId'>> = {},
): CircleSummary {
  return {
    circleId,
    name: `Circle ${circleId}`,
    role: 'owner' as CircleRole,
    planTier: 'family',
    recipientName: 'Margaret',
    memberCount: 4,
    ...options,
  };
}

describe('choosing the active circle', () => {
  it('has no answer when the person is in no circle', () => {
    expect(chooseActiveCircle([], null)).toBeNull();
    expect(chooseActiveCircle([], 'circle-a')).toBeNull();
  });

  it('uses the circle this device last showed, when they are still in it', () => {
    const circles = [circle('circle-a'), circle('circle-b')];

    expect(chooseActiveCircle(circles, 'circle-b')?.circleId).toBe('circle-b');
  });

  it('falls back to the first circle when there is no remembered choice', () => {
    const circles = [circle('circle-a'), circle('circle-b')];

    expect(chooseActiveCircle(circles, null)?.circleId).toBe('circle-a');
  });

  it('falls back when the remembered circle is gone — removed, or deleted', () => {
    const circles = [circle('circle-a'), circle('circle-b')];

    // Being removed from one family must not empty the app for the other.
    expect(chooseActiveCircle(circles, 'circle-zzz')?.circleId).toBe('circle-a');
  });

  it('keeps the database’s order, so the fallback is the same on every launch', () => {
    const circles = [circle('older'), circle('newer')];

    expect(chooseActiveCircle(circles, null)?.circleId).toBe('older');
    expect(chooseActiveCircle([...circles].reverse(), null)?.circleId).toBe('newer');
  });

  it('works with a single circle', () => {
    expect(chooseActiveCircle([circle('only')], 'anything')?.circleId).toBe('only');
  });
});

describe('the switcher', () => {
  it('is hidden for one circle: a picker with one option is clutter', () => {
    expect(shouldShowSwitcher([])).toBe(false);
    expect(shouldShowSwitcher([circle('only')])).toBe(false);
  });

  it('appears as soon as there are two', () => {
    expect(shouldShowSwitcher([circle('a'), circle('b')])).toBe(true);
  });
});

describe('what a circle is called on screen', () => {
  it('uses the name the family gave it', () => {
    expect(circleDisplayName(circle('a', { name: 'Mum’s circle' }))).toBe('Mum’s circle');
  });

  it('falls back to who is being cared for when the role cannot read the name', () => {
    // A visiting helper cannot read `circles` at all.
    expect(
      circleDisplayName(
        circle('a', { name: null, recipientName: 'Margaret', role: 'visiting_helper' }),
      ),
    ).toBe('Caring for Margaret');
  });

  it('ignores a blank name rather than showing an empty line', () => {
    expect(circleDisplayName(circle('a', { name: '   ' }))).toBe('Caring for Margaret');
  });

  it('always has something to show', () => {
    expect(circleDisplayName(circle('a', { name: null, recipientName: null }))).toBe('Your circle');
  });
});

describe('what to remember on this device', () => {
  it('remembers nothing when there is only one circle', () => {
    expect(rememberedChoiceFor([circle('only')], 'only')).toBeNull();
  });

  it('remembers the chosen circle when there are several', () => {
    expect(rememberedChoiceFor([circle('a'), circle('b')], 'b')).toBe('b');
  });

  it('remembers nothing for an id that is not in the list', () => {
    expect(rememberedChoiceFor([circle('a'), circle('b')], 'gone')).toBeNull();
    expect(rememberedChoiceFor([circle('a'), circle('b')], null)).toBeNull();
  });
});
