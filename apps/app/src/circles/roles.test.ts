import { describe, expect, it } from 'vitest';

import {
  ALL_ROLES,
  ASSIGNABLE_ROLES,
  CAPABILITY_LABELS,
  CAPABILITY_ORDER,
  CIRCLE_NAME_MAX_LENGTH,
  NO_CAPABILITIES,
  ROLES,
  canChangeRoleOf,
  canRemoveMember,
  capabilitiesFor,
  capabilitySummary,
  isCircleRole,
  memberRowSpokenLabel,
  roleDescription,
  roleLabel,
  roleWithCount,
  type Capabilities,
  type Capability,
} from './roles';
import type { CircleRole } from './circleState';

/** The map, written out longhand. If the implementation drifts, this fails. */
const EXPECTED: Readonly<Record<CircleRole, readonly Capability[]>> = {
  owner: [
    'canSeeCareRecipient',
    'canEditCareRecipient',
    'canSeeMeds',
    'canEditMeds',
    'canCheckOffMeds',
    'canManageCalendar',
    'canPostUpdates',
    'canSeeDocuments',
    'canSeeCosts',
    'canManageCosts',
    'canInvite',
    'canManageMembers',
    'canRenameCircle',
    'canReadAuditLog',
    'canSeeRoster',
  ],
  family_member: [
    'canSeeCareRecipient',
    'canEditCareRecipient',
    'canSeeMeds',
    'canEditMeds',
    'canCheckOffMeds',
    'canManageCalendar',
    'canPostUpdates',
    'canSeeDocuments',
    'canSeeCosts',
    'canManageCosts',
    'canReadAuditLog',
    'canSeeRoster',
  ],
  view_only: ['canSeeCareRecipient', 'canSeeMeds', 'canSeeDocuments', 'canSeeRoster'],
  visiting_helper: ['canSeeCareRecipient', 'canSeeMeds', 'canCheckOffMeds'],
};

function capabilitiesOf(role: CircleRole): Capabilities {
  return ROLES[role].capabilities;
}

describe('the capability map', () => {
  for (const role of ALL_ROLES) {
    it(`${role} has exactly the capabilities in the table`, () => {
      const granted = CAPABILITY_ORDER.filter((capability) => capabilitiesOf(role)[capability]);

      expect(granted.sort()).toEqual([...EXPECTED[role]].sort());
    });

    it(`${role} answers every capability with a boolean`, () => {
      for (const capability of CAPABILITY_ORDER) {
        expect(typeof capabilitiesOf(role)[capability]).toBe('boolean');
      }
    });
  }

  it('gives the owner everything', () => {
    for (const capability of CAPABILITY_ORDER) {
      expect(capabilitiesOf('owner')[capability], `owner should have ${capability}`).toBe(true);
    }
  });

  it('never lets a view-only member or a helper write anything', () => {
    const writes: readonly Capability[] = [
      'canEditCareRecipient',
      'canEditMeds',
      'canManageCalendar',
      'canPostUpdates',
      'canManageCosts',
      'canInvite',
      'canManageMembers',
      'canRenameCircle',
    ];

    for (const role of ['view_only', 'visiting_helper'] as const) {
      for (const capability of writes) {
        expect(capabilitiesOf(role)[capability], `${role} must not have ${capability}`).toBe(false);
      }
    }
  });

  it('lets a visiting helper check off meds and visits, and nothing else', () => {
    expect(capabilitiesOf('visiting_helper').canCheckOffMeds).toBe(true);
    expect(capabilitiesOf('visiting_helper').canSeeMeds).toBe(true);
    // No roster, no documents, no money: the narrow slice the brief describes.
    expect(capabilitiesOf('visiting_helper').canSeeRoster).toBe(false);
    expect(capabilitiesOf('visiting_helper').canSeeDocuments).toBe(false);
    expect(capabilitiesOf('visiting_helper').canSeeCosts).toBe(false);
    expect(capabilitiesOf('visiting_helper').canReadAuditLog).toBe(false);
  });

  it('keeps the three owner-only powers away from a family member', () => {
    const family = capabilitiesOf('family_member');

    expect(family.canManageMembers).toBe(false);
    expect(family.canInvite).toBe(false);
    expect(family.canRenameCircle).toBe(false);
    // …but they do write care data, which is the point of the role.
    expect(family.canEditCareRecipient).toBe(true);
    expect(family.canEditMeds).toBe(true);
  });

  it('hides costs from view-only, because the money is the care team’s', () => {
    expect(capabilitiesOf('view_only').canSeeCosts).toBe(false);
    expect(capabilitiesOf('family_member').canSeeCosts).toBe(true);
  });

  it('grants nothing when there is no circle, or an unknown role', () => {
    expect(capabilitiesFor(null)).toEqual(NO_CAPABILITIES);
    expect(capabilitiesFor(undefined)).toEqual(NO_CAPABILITIES);
    expect(capabilitiesFor('stranger' as CircleRole)).toEqual(NO_CAPABILITIES);

    for (const capability of CAPABILITY_ORDER) {
      expect(NO_CAPABILITIES[capability]).toBe(false);
    }
  });
});

describe('plain-language names', () => {
  it('never shows a raw enum on screen', () => {
    for (const role of ALL_ROLES) {
      const { label, description } = ROLES[role];

      expect(label).not.toBe(role);
      expect(label).not.toContain('_');
      expect(description).not.toContain('_');
      expect(description.length).toBeGreaterThan(20);
    }
  });

  it('uses the four names the brief asks for', () => {
    expect(ALL_ROLES.map(roleLabel)).toEqual([
      'Owner',
      'Family member',
      'View only',
      'Visiting helper',
    ]);
  });

  it('describes an unknown or missing role without crashing', () => {
    expect(roleLabel(null)).toBe('Member');
    expect(roleDescription(null)).toBe('Part of this circle.');
    expect(roleLabel('nonsense' as CircleRole)).toBe('Member');
  });

  it('labels every capability in the second person', () => {
    for (const capability of CAPABILITY_ORDER) {
      const label = CAPABILITY_LABELS[capability];

      expect(label.length).toBeGreaterThan(8);
      expect(label).not.toContain('_');
    }
  });

  it('summarises a role from the same map the UI obeys', () => {
    expect(capabilitySummary('visiting_helper')).toEqual([
      'See who you’re caring for',
      'See the medication list',
      'Check off medications and visits',
    ]);

    expect(capabilitySummary(null)).toEqual([]);
    expect(capabilitySummary('owner')).toHaveLength(CAPABILITY_ORDER.length);
  });

  it('counts members in the subtitle, in words a person would say', () => {
    expect(roleWithCount('owner', 4)).toBe('Owner · 4 members');
    expect(roleWithCount('family_member', 1)).toBe('Family member · 1 member');
    expect(roleWithCount('view_only', null)).toBe('View only');
    expect(roleWithCount('view_only', 0)).toBe('View only');
  });
});

describe('who may change whom', () => {
  it('lets the owner manage every other role', () => {
    for (const target of ['family_member', 'view_only', 'visiting_helper'] as const) {
      expect(canChangeRoleOf('owner', target)).toBe(true);
      expect(canRemoveMember('owner', target)).toBe(true);
    }
  });

  it('never lets anybody manage the owner’s own row', () => {
    expect(canChangeRoleOf('owner', 'owner')).toBe(false);
    expect(canRemoveMember('owner', 'owner')).toBe(false);
  });

  it('never lets a non-owner manage anybody', () => {
    for (const actor of ['family_member', 'view_only', 'visiting_helper'] as const) {
      for (const target of ['family_member', 'view_only', 'visiting_helper'] as const) {
        expect(canChangeRoleOf(actor, target), `${actor} must not manage ${target}`).toBe(false);
      }
    }
  });

  it('answers no when there is no role at all', () => {
    expect(canChangeRoleOf(null, 'view_only')).toBe(false);
    expect(canChangeRoleOf('owner', null)).toBe(false);
  });

  it('offers only roles an owner may give', () => {
    expect(ASSIGNABLE_ROLES).not.toContain('owner');
    expect([...ASSIGNABLE_ROLES]).toEqual(['family_member', 'view_only', 'visiting_helper']);
  });
});

describe('the circle name limit', () => {
  it('is a soft 40 characters, inside the database’s 80', () => {
    expect(CIRCLE_NAME_MAX_LENGTH).toBe(40);
  });
});

describe('isCircleRole', () => {
  it('recognises the four roles and nothing else', () => {
    for (const role of ALL_ROLES) {
      expect(isCircleRole(role)).toBe(true);
    }

    expect(isCircleRole('admin')).toBe(false);
    expect(isCircleRole(null)).toBe(false);
    expect(isCircleRole(3)).toBe(false);
  });
});

describe('the spoken label for a roster row', () => {
  it('says the name, the role and the whole description', () => {
    for (const role of ALL_ROLES) {
      const label = memberRowSpokenLabel({ displayName: 'Margaret Chen', role });

      expect(label).toContain('Margaret Chen');
      expect(label).toContain(ROLES[role].label);
      // The description is the sentence that explains what the person may do.
      // A row that clips it on screen is a bug; a label that drops it is worse.
      expect(label).toContain(ROLES[role].description);
    }
  });

  it('says "you" for the reader’s own row, and only for it', () => {
    expect(memberRowSpokenLabel({ displayName: 'Sam Okonkwo', isSelf: true, role: 'owner' })).toBe(
      `Sam Okonkwo, you. Owner. ${ROLES.owner.description}`,
    );

    expect(memberRowSpokenLabel({ displayName: 'Sam Okonkwo', role: 'owner' })).not.toContain(
      'you.',
    );
  });

  it('never reads out a raw role enum', () => {
    for (const role of ALL_ROLES) {
      const label = memberRowSpokenLabel({ displayName: 'Priya Raman', role });

      expect(label).not.toContain('_');
    }
  });

  it('every description is a whole sentence, never an ellipsis', () => {
    for (const role of ALL_ROLES) {
      const description = ROLES[role].description;

      expect(description.length).toBeGreaterThan(20);
      expect(description.endsWith('.')).toBe(true);
      expect(description).not.toContain('…');
      expect(description).not.toContain('...');
    }
  });
});
