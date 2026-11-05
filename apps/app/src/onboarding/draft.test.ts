import { describe, expect, it } from 'vitest';

import {
  DRAFT_VERSION,
  draftHasContent,
  emptyDraft,
  hasName,
  hasRecipient,
  parseDraft,
  resumeStep,
  serialiseDraft,
  type OnboardingDraft,
} from './draft';

const FILLED: OnboardingDraft = {
  version: DRAFT_VERSION,
  step: 'invite',
  displayName: 'Sara Jones',
  recipientName: 'Margaret',
  relationship: 'Mother',
  invites: ['mike@example.com'],
  circleId: null,
};

describe('a fresh draft', () => {
  it('starts on the first screen with nothing filled in', () => {
    expect(emptyDraft()).toEqual({
      version: DRAFT_VERSION,
      step: 'you',
      displayName: '',
      recipientName: '',
      relationship: null,
      invites: [],
      circleId: null,
    });
  });

  it('has nothing worth starting over for', () => {
    expect(draftHasContent(emptyDraft())).toBe(false);
  });
});

describe('surviving a closed app', () => {
  it('comes back exactly as it went in', () => {
    const restored = parseDraft(serialiseDraft(FILLED));
    expect(restored).toEqual(FILLED);
  });

  it('restores a draft that was interrupted on screen 2', () => {
    const interrupted: OnboardingDraft = { ...FILLED, step: 'care', invites: [] };
    const restored = parseDraft(serialiseDraft(interrupted));

    expect(restored.step).toBe('care');
    expect(restored.displayName).toBe('Sara Jones');
    expect(restored.recipientName).toBe('Margaret');
    expect(restored.relationship).toBe('Mother');
    expect(resumeStep(restored)).toBe('care');
  });

  it('keeps the id of a circle that never got its person', () => {
    const orphan = '6f9619ff-8b86-d011-b42d-00cf4fc964ff';
    const restored = parseDraft(serialiseDraft({ ...FILLED, circleId: orphan }));
    expect(restored.circleId).toBe(orphan);
  });
});

describe('a stored draft that cannot be trusted', () => {
  it('becomes an empty draft rather than an exception', () => {
    for (const raw of [null, undefined, '', 'not json', '[]', '"string"', '42', 'null']) {
      expect(parseDraft(raw)).toEqual(emptyDraft());
    }
  });

  it('is discarded when it was written by a different version', () => {
    const older = JSON.stringify({ ...FILLED, version: DRAFT_VERSION - 1 });
    expect(parseDraft(older)).toEqual(emptyDraft());
  });

  it('drops fields that do not fit the shape', () => {
    const mangled = JSON.stringify({
      version: DRAFT_VERSION,
      step: 'somewhere-else',
      displayName: 12,
      recipientName: 'Margaret',
      relationship: 'Aunt',
      invites: ['not-an-email', 'mike@example.com', 'MIKE@example.com', 7],
      circleId: 'nope',
    });

    const restored = parseDraft(mangled);

    expect(restored.step).toBe('you');
    expect(restored.displayName).toBe('');
    expect(restored.recipientName).toBe('Margaret');
    expect(restored.relationship).toBeNull();
    expect(restored.invites).toEqual(['mike@example.com']);
    expect(restored.circleId).toBeNull();
  });
});

describe('which step to resume on', () => {
  it('stays where they were when the answers are there', () => {
    expect(resumeStep(FILLED)).toBe('invite');
  });

  it('never opens a later screen than the answers justify', () => {
    // Left on screen 2 with no name: screen 1 is the only thing that helps.
    expect(resumeStep({ ...FILLED, step: 'care', displayName: '' })).toBe('you');
    // Left on screen 3 with no relationship: back to screen 2.
    expect(resumeStep({ ...FILLED, step: 'invite', relationship: null })).toBe('care');
    // Left on screen 3 with no name at all: the very beginning.
    expect(resumeStep({ ...emptyDraft(), step: 'invite' })).toBe('you');
  });

  it('honours a deliberate return to screen 1', () => {
    expect(resumeStep({ ...FILLED, step: 'you' })).toBe('you');
  });
});

describe('what counts as filled in', () => {
  it('knows a name when it sees one', () => {
    expect(hasName({ ...emptyDraft(), displayName: 'Sara' })).toBe(true);
    expect(hasName({ ...emptyDraft(), displayName: '   ' })).toBe(false);
  });

  it('needs both the name and the relationship for the person', () => {
    expect(hasRecipient({ ...emptyDraft(), recipientName: 'Margaret' })).toBe(false);
    expect(hasRecipient({ ...emptyDraft(), relationship: 'Mother' })).toBe(false);
    expect(
      hasRecipient({ ...emptyDraft(), recipientName: 'Margaret', relationship: 'Mother' }),
    ).toBe(true);
  });

  it('treats any typed answer as worth keeping', () => {
    expect(draftHasContent({ ...emptyDraft(), recipientName: 'M' })).toBe(true);
    expect(draftHasContent({ ...emptyDraft(), invites: ['a@example.com'] })).toBe(true);
  });
});
