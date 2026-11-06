/**
 * The four roles, as one capability map.
 *
 * This is the only place in the app that decides what a role may do. Every
 * screen asks this module — never `role === 'owner'` — so the UI cannot offer an
 * action the database will reject, and adding a role later is one entry in one
 * table rather than a hunt through the tree.
 *
 * The map mirrors the Row Level Security policies in
 * `supabase/migrations/20261104120200_identity_authorisation.sql` and the audit
 * and limit triggers that follow them. Where it is deliberately narrower than
 * the database (the audit trail, for one) the entry says so.
 *
 * Plain-language names live here too: a family never sees `view_only` on screen.
 *
 * ## The roles, as a family reads them
 *
 *   * **Owner** — the person who set the circle up. Runs it.
 *   * **Family member** — takes part in care: meds, appointments, updates, costs.
 *   * **View only** — sees what is happening; changes nothing. A grandchild, a
 *     cousin who wants to keep up.
 *   * **Visiting helper** — a paid aide or a neighbour. Sees the plan, and can
 *     check off what they did; sees no documents and no money.
 */

import type { CircleRole } from './circleState';

export type Capability =
  /** See the person being cared for. */
  | 'canSeeCareRecipient'
  /**
   * See their care details: doctors, pharmacies, allergies, conditions and
   * insurance cards — and the free-text note on the profile.
   *
   * Separate from `canSeeCareRecipient` because the two are different answers
   * for a visiting helper: they see *who* they are helping and nothing about
   * what is wrong with them. The database says the same thing — the three
   * profile tables have no policy for `visiting_helper`, and the note column is
   * not granted to any client role at all.
   */
  | 'canSeeCareDetails'
  /** Edit their basics: name, relationship, doctors, allergies. */
  | 'canEditCareRecipient'
  /** See the medication list. */
  | 'canSeeMeds'
  /** Add or change a medication. */
  | 'canEditMeds'
  /** Check a dose or a visit off. */
  | 'canCheckOffMeds'
  /** Add appointments, claim coverage, ask for a swap. */
  | 'canManageCalendar'
  /** Post to the family updates feed. */
  | 'canPostUpdates'
  /** Open the document vault. */
  | 'canSeeDocuments'
  /** See costs, balances and settle-up. */
  | 'canSeeCosts'
  /** Log an expense or record a settle-up. */
  | 'canManageCosts'
  /** Invite somebody into the circle. */
  | 'canInvite'
  /** Change a role or remove a member. */
  | 'canManageMembers'
  /** Rename the circle. */
  | 'canRenameCircle'
  /** Read the circle's activity log. */
  | 'canReadAuditLog'
  /** See the full roster of who is in the circle. */
  | 'canSeeRoster';

export type Capabilities = Readonly<Record<Capability, boolean>>;

/**
 * What each capability is called on screen, in the second person.
 *
 * A role's "what this means" list is built from these, so the description of a
 * role can never drift from the map that enforces it.
 */
export const CAPABILITY_LABELS: Readonly<Record<Capability, string>> = {
  canSeeCareRecipient: 'See who you’re caring for',
  canSeeCareDetails: 'See doctors, allergies and insurance cards',
  canEditCareRecipient: 'Edit their details',
  canSeeMeds: 'See the medication list',
  canEditMeds: 'Add and change medications',
  canCheckOffMeds: 'Check off medications and visits',
  canManageCalendar: 'Add appointments and cover them',
  canPostUpdates: 'Post family updates',
  canSeeDocuments: 'Open the document vault',
  canSeeCosts: 'See costs and who owes what',
  canManageCosts: 'Log costs and record a settle-up',
  canInvite: 'Invite family',
  canManageMembers: 'Change roles and remove people',
  canRenameCircle: 'Rename the circle',
  canReadAuditLog: 'See the activity log',
  canSeeRoster: 'See everyone in the circle',
};

/** Every capability, in the order a role's description lists them. */
export const CAPABILITY_ORDER: readonly Capability[] = [
  'canSeeCareRecipient',
  'canSeeCareDetails',
  'canSeeMeds',
  'canCheckOffMeds',
  'canEditMeds',
  'canManageCalendar',
  'canPostUpdates',
  'canEditCareRecipient',
  'canSeeDocuments',
  'canSeeCosts',
  'canManageCosts',
  'canSeeRoster',
  'canReadAuditLog',
  'canInvite',
  'canManageMembers',
  'canRenameCircle',
];

/** Nobody can do anything. The answer when there is no circle yet. */
export const NO_CAPABILITIES: Capabilities = {
  canSeeCareRecipient: false,
  canSeeCareDetails: false,
  canEditCareRecipient: false,
  canSeeMeds: false,
  canEditMeds: false,
  canCheckOffMeds: false,
  canManageCalendar: false,
  canPostUpdates: false,
  canSeeDocuments: false,
  canSeeCosts: false,
  canManageCosts: false,
  canInvite: false,
  canManageMembers: false,
  canRenameCircle: false,
  canReadAuditLog: false,
  canSeeRoster: false,
};

export interface RoleInfo {
  readonly role: CircleRole;
  /** Shown on screen. Never the raw enum. */
  readonly label: string;
  /** One line under the label. */
  readonly description: string;
  readonly capabilities: Capabilities;
}

const OWNER_CAPABILITIES: Capabilities = {
  canSeeCareRecipient: true,
  canSeeCareDetails: true,
  canEditCareRecipient: true,
  canSeeMeds: true,
  canEditMeds: true,
  canCheckOffMeds: true,
  canManageCalendar: true,
  canPostUpdates: true,
  canSeeDocuments: true,
  canSeeCosts: true,
  canManageCosts: true,
  canInvite: true,
  canManageMembers: true,
  canRenameCircle: true,
  canReadAuditLog: true,
  canSeeRoster: true,
};

const FAMILY_MEMBER_CAPABILITIES: Capabilities = {
  ...OWNER_CAPABILITIES,
  // The three things that belong to whoever runs the circle. `circle_members`
  // and `circles` are owner-write at the database, and the audit trail is the
  // care team's record, not a settings screen.
  canInvite: false,
  canManageMembers: false,
  canRenameCircle: false,
};

/**
 * View only: sees the care records, changes nothing.
 *
 * Costs are the one care record it does not see. "View only" is usually a
 * grandchild or a cousin keeping up with how someone is doing; the family's
 * money is for the people paying it, and the cost tables will be scoped to the
 * care team for exactly that reason. Saying so in the role's own description is
 * kinder than a screen that silently omits a tab.
 */
const VIEW_ONLY_CAPABILITIES: Capabilities = {
  ...NO_CAPABILITIES,
  canSeeCareRecipient: true,
  // The care records are what view-only is for; the family's money is not.
  canSeeCareDetails: true,
  canSeeMeds: true,
  canManageCalendar: false,
  canSeeDocuments: true,
  canSeeRoster: true,
};

/**
 * Visiting helper: the narrow slice the brief describes.
 *
 * `canCheckOffMeds` is true here and the database does not yet have a table to
 * check off into — Task 8 adds doses and visits, and its insert policy must
 * grant a helper their own check-offs. Until then no screen calls it. The brief
 * is explicit that this is the helper's one write ("an aide who can check off
 * meds and visits with a code"), so the map states it rather than waiting for
 * the table.
 */
const VISITING_HELPER_CAPABILITIES: Capabilities = {
  ...NO_CAPABILITIES,
  canSeeCareRecipient: true,
  // The owner's directive: a helper sees the person they are helping — name,
  // photo, relationship — and nothing about their health. No doctors, no
  // pharmacies, no allergies, no conditions, no insurance cards, no note. The
  // three profile tables have no RLS policy for this role, so the screen and the
  // database agree.
  canSeeCareDetails: false,
  canSeeMeds: true,
  canCheckOffMeds: true,
  // No roster: `circle_members_select_member` shows a helper their own row only.
  canSeeRoster: false,
  // No documents and no money: power of attorney, insurance cards and the
  // family's balances are not part of an aide's job.
  canSeeDocuments: false,
  canSeeCosts: false,
};

export const ROLES: Readonly<Record<CircleRole, RoleInfo>> = {
  owner: {
    role: 'owner',
    label: 'Owner',
    description: 'Runs the circle. Can change anything, including who is in it.',
    capabilities: OWNER_CAPABILITIES,
  },
  family_member: {
    role: 'family_member',
    label: 'Family member',
    description: 'Takes part in care: medications, appointments, updates and costs.',
    capabilities: FAMILY_MEMBER_CAPABILITIES,
  },
  view_only: {
    role: 'view_only',
    label: 'View only',
    description: 'Sees what’s happening. Can’t change anything, or see costs.',
    capabilities: VIEW_ONLY_CAPABILITIES,
  },
  visiting_helper: {
    role: 'visiting_helper',
    label: 'Visiting helper',
    description:
      'A paid aide or a neighbour. Sees who they are helping and checks off what they did — not their medical details.',
    capabilities: VISITING_HELPER_CAPABILITIES,
  },
};

/** Every role, in the order the members screen lists them. */
export const ALL_ROLES: readonly CircleRole[] = [
  'owner',
  'family_member',
  'view_only',
  'visiting_helper',
];

/**
 * The roles an owner may give somebody.
 *
 * `owner` is excluded because there is exactly one, and handing the circle over
 * is a transfer feature with its own consent step — not a dropdown. The
 * database enforces the same rule (`circle_members_update_owner`).
 */
export const ASSIGNABLE_ROLES: readonly CircleRole[] = [
  'family_member',
  'view_only',
  'visiting_helper',
];

export function isCircleRole(value: unknown): value is CircleRole {
  return typeof value === 'string' && ALL_ROLES.includes(value as CircleRole);
}

/**
 * The capabilities of a role, or none at all.
 *
 * `null` — no circle loaded yet, or a role the server sent that this build does
 * not know — is deliberately not an error: it means "show nothing you cannot
 * prove", which is the same answer a failed request should give.
 */
export function capabilitiesFor(role: CircleRole | null | undefined): Capabilities {
  if (role === null || role === undefined || !isCircleRole(role)) {
    return NO_CAPABILITIES;
  }

  return ROLES[role].capabilities;
}

export function roleLabel(role: CircleRole | null | undefined): string {
  return role !== null && role !== undefined && isCircleRole(role) ? ROLES[role].label : 'Member';
}

export function roleDescription(role: CircleRole | null | undefined): string {
  return role !== null && role !== undefined && isCircleRole(role)
    ? ROLES[role].description
    : 'Part of this circle.';
}

/**
 * What a screen reader says for one row of the roster.
 *
 * The row shows three things — a name, a role badge and the sentence describing
 * what that role may do — and it is one accessibility element, so the label has
 * to carry all three in the order they are read. The description is the part
 * that matters: it is the sentence that answers "what can this person do?", and
 * a screen reader must never get less of it than the eye does.
 */
export function memberRowSpokenLabel(input: {
  readonly displayName: string;
  readonly role: CircleRole;
  readonly isSelf?: boolean;
}): string {
  const name = input.displayName.trim();
  const you = input.isSelf === true ? ', you' : '';

  return `${name}${you}. ${roleLabel(input.role)}. ${roleDescription(input.role)}`;
}

/** "Owner · 4 members" — the subtitle under a circle's name. */
export function roleWithCount(role: CircleRole | null | undefined, members: number | null): string {
  const label = roleLabel(role);

  if (members === null || members <= 0) {
    return label;
  }

  return `${label} · ${members} ${members === 1 ? 'member' : 'members'}`;
}

/**
 * The sentences under a role in the members screen: what this role can do,
 * taken from the same map the UI obeys.
 */
export function capabilitySummary(role: CircleRole | null | undefined): readonly string[] {
  const capabilities = capabilitiesFor(role);

  return CAPABILITY_ORDER.filter((capability) => capabilities[capability]).map(
    (capability) => CAPABILITY_LABELS[capability],
  );
}

/**
 * May `actor` change what `target` is?
 *
 * Owner only, never the owner's own row (the database refuses that outright),
 * and never to `owner`.
 */
export function canChangeRoleOf(
  actorRole: CircleRole | null | undefined,
  targetRole: CircleRole | null | undefined,
): boolean {
  if (targetRole === null || targetRole === undefined) {
    return false;
  }

  return capabilitiesFor(actorRole).canManageMembers && targetRole !== 'owner';
}

/** May `actor` remove `target`? Same rule as a role change. */
export function canRemoveMember(
  actorRole: CircleRole | null | undefined,
  targetRole: CircleRole | null | undefined,
): boolean {
  return canChangeRoleOf(actorRole, targetRole);
}

/** The longest circle name the app accepts, in characters. */
export const CIRCLE_NAME_MAX_LENGTH = 40;
