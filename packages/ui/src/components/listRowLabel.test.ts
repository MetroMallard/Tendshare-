import { describe, expect, it } from 'vitest';

import { listRowAccessibilityLabel } from './listRowLabel';

/**
 * The spoken label is the only way a screen reader user learns what a row says,
 * and a row is one element — so these tests pin the composition, not the
 * rendering. A label that drops the subtitle is a row that silently stops
 * explaining itself.
 */
describe('listRowAccessibilityLabel', () => {
  it('says the title and the subtitle as two sentences', () => {
    expect(listRowAccessibilityLabel({ title: 'Margaret Chen', subtitle: 'Lives at home' })).toBe(
      'Margaret Chen. Lives at home.',
    );
  });

  it('adds a full stop when the copy does not end in one, and never doubles it', () => {
    expect(listRowAccessibilityLabel({ title: 'Documents' })).toBe('Documents.');
    expect(listRowAccessibilityLabel({ title: 'Documents', subtitle: 'Opens the vault.' })).toBe(
      'Documents. Opens the vault.',
    );
  });

  it('says just the title when there is no subtitle', () => {
    expect(listRowAccessibilityLabel({ title: 'Metformin 500 mg' })).toBe('Metformin 500 mg.');
  });

  it('lets a screen take over the whole label', () => {
    // A row that also shows a badge needs to say the badge: the default
    // composition would read the name and description and skip the role.
    expect(
      listRowAccessibilityLabel({
        title: 'Margaret Chen (you)',
        subtitle: 'Runs the circle.',
        spokenLabel: 'Margaret Chen, you. Owner. Runs the circle.',
      }),
    ).toBe('Margaret Chen, you. Owner. Runs the circle.');
  });

  it('falls back to the composed label when the override is blank', () => {
    expect(listRowAccessibilityLabel({ title: 'Cardiology', spokenLabel: '   ' })).toBe(
      'Cardiology.',
    );
  });

  it('never leaves a dangling separator when the title is empty', () => {
    expect(listRowAccessibilityLabel({ title: '  ', subtitle: 'Lives at home' })).toBe(
      'Lives at home.',
    );
  });
});
