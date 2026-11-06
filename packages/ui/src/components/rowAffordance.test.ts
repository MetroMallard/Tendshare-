import { describe, expect, it } from 'vitest';

import { showsChevron } from './rowAffordance';

/**
 * A row's chevron is its only "this opens something" mark.
 *
 * The regression these tests pin: the chevron was dropped whenever the row had a
 * trailing slot, so the primary doctor ("Main"), an insurance card with a photo
 * ("Photo") and every allergy looked like plain text while the rows beside them
 * looked tappable — the editable rows, hidden from the people who could edit.
 */
describe('showsChevron', () => {
  it('shows a chevron on a pressable row', () => {
    expect(showsChevron({ pressable: true, hasTrailing: false })).toBe(true);
  });

  it('still shows it when a badge sits in the trailing slot', () => {
    expect(showsChevron({ pressable: true, hasTrailing: true })).toBe(true);
  });

  it('does not care whether there is a trailing slot', () => {
    const withBadge = showsChevron({ pressable: true, hasTrailing: true });
    const withoutBadge = showsChevron({ pressable: true, hasTrailing: false });

    expect(withBadge).toBe(withoutBadge);
  });

  it('leaves a plain row without one', () => {
    expect(showsChevron({ pressable: false, hasTrailing: false })).toBe(false);
    expect(showsChevron({ pressable: false, hasTrailing: true })).toBe(false);
  });

  it('lets a screen turn it off, and on, explicitly', () => {
    // "Sign out" is pressable but goes nowhere, so More turns the chevron off.
    expect(showsChevron({ pressable: true, showChevron: false, hasTrailing: false })).toBe(false);
    expect(showsChevron({ pressable: false, showChevron: true, hasTrailing: true })).toBe(true);
  });
});
