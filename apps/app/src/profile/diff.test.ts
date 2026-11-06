import { describe, expect, it } from 'vitest';

import { buildPatch, changedFields, isUnchanged } from './diff';

const CONTACT_FIELDS = ['name', 'organisation', 'phone', 'address', 'notes', 'is_primary'] as const;

const BEFORE = {
  name: 'Dr Patel',
  organisation: 'Riverside Clinic',
  phone: '555 0142',
  address: null,
  notes: null,
  is_primary: false,
};

describe('what changed', () => {
  it('says nothing when nothing changed', () => {
    const after = { ...BEFORE, address: '', notes: '   ' };

    expect(changedFields(BEFORE, after, CONTACT_FIELDS)).toEqual([]);
    expect(isUnchanged(BEFORE, after, CONTACT_FIELDS)).toBe(true);
  });

  it('names the fields, sorted, and never their values', () => {
    const after = {
      ...BEFORE,
      phone: '555 0199',
      address: '12 Mill Lane',
      name: 'Dr Priya Patel',
    };

    const changed = changedFields(BEFORE, after, CONTACT_FIELDS);

    expect(changed).toEqual(['address', 'name', 'phone']);
    // The audit payload the trigger writes is this list. It must not contain a
    // value, which is the whole rule.
    expect(changed.join(',')).not.toContain('555');
    expect(changed.join(',')).not.toContain('Priya');
  });

  it('counts a boolean as a change', () => {
    expect(changedFields(BEFORE, { ...BEFORE, is_primary: true }, CONTACT_FIELDS)).toEqual([
      'is_primary',
    ]);
  });

  it('treats a cleared field as a change', () => {
    const before = { ...BEFORE, phone: '555 0142' };
    const after = { ...BEFORE, phone: '' };

    expect(changedFields(before, after, CONTACT_FIELDS)).toEqual(['phone']);
  });
});

describe('the patch that gets sent', () => {
  it('carries only the changed fields, trimmed, with empty as null', () => {
    const patch = buildPatch(
      BEFORE,
      { ...BEFORE, phone: '  555 0199 ', address: '12 Mill Lane' },
      CONTACT_FIELDS,
    );

    expect(patch).toEqual({ phone: '555 0199', address: '12 Mill Lane' });
  });

  it('is empty when the sheet was opened and closed', () => {
    expect(buildPatch(BEFORE, { ...BEFORE }, CONTACT_FIELDS)).toEqual({});
  });

  it('clears a field by sending null, not by sending nothing', () => {
    const patch = buildPatch({ ...BEFORE, phone: '555 0142' }, { ...BEFORE, phone: '' }, ['phone']);

    expect(patch).toEqual({ phone: null });
  });
});
