import { useState, type ReactNode } from 'react';
import { ScrollView, View } from 'react-native';

import { Button, ConfirmSheet, ScreenHeader, Text, ThemeProvider, useTheme } from '@tendshare/ui';

import type { CircleRole } from '../src/circles/circleState';
import { capabilitiesFor } from '../src/circles/roles';
import { ProfileView } from '../src/profile/components/ProfileView';
import { BasicsSheet, ContactSheet } from '../src/profile/components/ProfileSheets';
import type { CareProfile } from '../src/profile/profileData';

/**
 * Every state of the person profile, on purpose, at 390px, in both schemes —
 * the Task 7 twin of `/circles-preview`.
 *
 * Hidden and unlinked. It renders the real `ProfileView` with fixture props, so
 * what QA and the owner look at is what the app ships: the four sections with
 * content, the same four empty, the visiting helper's one-sentence screen, the
 * reader's read-only note, the loading skeletons, the error, the offline banner,
 * and a name long enough to prove the header wraps instead of clipping.
 *
 * Nothing here touches the session or Supabase, so it works with no account at
 * all — which is the point: the owner can see the whole screen before signing in.
 */

const noop = () => undefined;

const PROFILE: CareProfile = {
  basics: {
    id: 'r1',
    circleId: 'c1',
    fullName: 'Margaret Anne Jones',
    preferredName: 'Mum',
    relationship: 'Mother',
    dateOfBirth: '1942-03-12',
    phone: '+44 7700 900123',
    photoPath: null,
    notes: 'Prefers the quiet room by the window. Hates being rushed in the morning.',
  },
  contacts: [
    {
      id: 'd1',
      kind: 'doctor',
      name: 'Dr Priya Patel',
      organisation: 'Riverside Surgery',
      phone: '+44 20 7946 0011',
      address: '12 Riverside Walk',
      notes: 'Usually in on Tuesdays and Thursdays.',
      isPrimary: true,
    },
    {
      id: 'd2',
      kind: 'doctor',
      name: 'Dr Alan Whitcombe',
      organisation: 'St Mary’s memory clinic',
      phone: '+44 20 7946 0455',
      address: null,
      notes: null,
      isPrimary: false,
    },
    {
      id: 'p1',
      kind: 'pharmacy',
      name: 'Boots on the High Street',
      organisation: 'Boots',
      phone: '+44 20 7946 0900',
      address: null,
      notes: 'They deliver on Fridays if you ring before noon.',
      isPrimary: true,
    },
  ],
  conditions: [
    {
      id: 'a1',
      kind: 'allergy',
      label: 'Penicillin',
      notes: 'Rash the last time, in 2019.',
    },
    { id: 'a2', kind: 'allergy', label: 'Shellfish', notes: null },
    {
      id: 'x1',
      kind: 'condition',
      label: 'Type 2 diabetes',
      notes: 'Managed with tablets.',
    },
    { id: 'x2', kind: 'condition', label: 'Mild arthritis in both knees', notes: null },
  ],
  insurance: [
    {
      id: 'i1',
      planName: 'Blue Cross PPO',
      memberId: 'BC-99213-7',
      groupNumber: '00412',
      imagePath: 'c1/r1/insurance-i1-1.jpg',
    },
    { id: 'i2', planName: 'Medicare Part D', memberId: null, groupNumber: null, imagePath: null },
  ],
};

const EMPTY_SECTIONS: CareProfile = {
  basics: PROFILE.basics,
  contacts: [],
  conditions: [],
  insurance: [],
};

const NO_PERSON: CareProfile = { basics: null, contacts: [], conditions: [], insurance: [] };

/** Long enough to break a header on a small phone if anything clips. */
const LONG_PROFILE: CareProfile = {
  ...PROFILE,
  basics: {
    ...PROFILE.basics!,
    fullName: 'Margaret Anne Jones-Wetherby of the Old Rectory',
    preferredName: 'Margaret Anne Jones-Wetherby of the Old Rectory',
    relationship: 'Mother, and the person who looked after everybody else first',
    notes:
      'A note that runs on for a while, because some families write a paragraph here rather than a line — what she likes, what she does not, who to call first, and where the spare key is kept. '.repeat(
        2,
      ),
  },
  contacts: [
    {
      ...PROFILE.contacts[0]!,
      name: 'Dr Priya Patel-Wetherby of the Riverside Surgery and Memory Clinic',
      organisation: 'Riverside Surgery, the annexe behind the church, second door on the left',
    },
    ...PROFILE.contacts.slice(1),
  ],
};

const LONG_CIRCLE =
  'Margaret’s circle — the Joneses, the Wetherbys, and everyone who helps on Thursdays';

function profileView(options: {
  readonly role: CircleRole;
  readonly circleName?: string;
  readonly profile?: CareProfile | null;
  readonly loadState?: 'loading' | 'ready' | 'error';
  readonly offline?: boolean;
  readonly problem?: { title: string; message: string } | null;
  readonly photoUrl?: string | null;
}): ReactNode {
  const capabilities = capabilitiesFor(options.role);

  return (
    <ProfileView
      capabilities={capabilities}
      cardUrls={{}}
      circleName={options.circleName ?? 'Margaret’s circle'}
      loadState={options.loadState ?? 'ready'}
      offline={options.offline ?? false}
      onAddCondition={noop}
      onAddContact={noop}
      onAddInsurance={noop}
      onBack={noop}
      onChangePhoto={noop}
      onEditBasics={noop}
      onEditCondition={noop}
      onEditContact={noop}
      onEditInsurance={noop}
      onRetry={noop}
      photoUrl={options.photoUrl ?? null}
      problem={options.problem ?? null}
      profile={options.profile === undefined ? PROFILE : options.profile}
      role={options.role}
    />
  );
}

interface StateFixture {
  readonly key: string;
  readonly label: string;
  readonly render: () => ReactNode;
}

const STATES: readonly StateFixture[] = [
  {
    key: 'owner',
    label: 'Profile — owner',
    render: () => profileView({ role: 'owner' }),
  },
  {
    key: 'family',
    label: 'Profile — family member',
    render: () => profileView({ role: 'family_member' }),
  },
  {
    key: 'view-only',
    label: 'Profile — read only',
    render: () => profileView({ role: 'view_only' }),
  },
  {
    key: 'helper',
    label: 'Profile — visiting helper',
    render: () => profileView({ role: 'visiting_helper' }),
  },
  {
    key: 'loading',
    label: 'Profile — loading',
    render: () => profileView({ role: 'owner', loadState: 'loading', profile: null }),
  },
  {
    key: 'empty-sections',
    label: 'Profile — sections empty',
    render: () => profileView({ role: 'owner', profile: EMPTY_SECTIONS }),
  },
  {
    key: 'no-person',
    label: 'Profile — nobody added yet',
    render: () => profileView({ role: 'owner', profile: NO_PERSON }),
  },
  {
    key: 'error',
    label: 'Profile — could not load',
    render: () => profileView({ role: 'owner', loadState: 'error', profile: null }),
  },
  {
    key: 'offline',
    label: 'Profile — offline',
    render: () => profileView({ role: 'owner', offline: true }),
  },
  {
    key: 'problem',
    label: 'Profile — a change was refused',
    render: () =>
      profileView({
        role: 'owner',
        problem: {
          title: 'That didn’t save',
          message: 'The change was put back as it was. Please try again in a moment.',
        },
      }),
  },
  {
    key: 'long',
    label: 'Profile — long names',
    render: () => profileView({ role: 'owner', circleName: LONG_CIRCLE, profile: LONG_PROFILE }),
  },
  {
    key: 'sheet-basics',
    label: 'Profile — the basics sheet',
    render: () => (
      <>
        {profileView({ role: 'owner' })}
        <BasicsSheet
          busy={false}
          initial={{
            fullName: 'Margaret Anne Jones',
            preferredName: 'Mum',
            relationship: 'Mother',
            dateOfBirth: '1942-03-12',
            phone: '+44 7700 900123',
            notes: 'Prefers the quiet room by the window. Hates being rushed in the morning.',
          }}
          onClose={noop}
          onSave={noop}
          visible
        />
      </>
    ),
  },
  {
    key: 'sheet-doctor',
    label: 'Profile — adding a doctor',
    render: () => (
      <>
        {profileView({ role: 'owner' })}
        <ContactSheet busy={false} contact={null} kind="doctor" onClose={noop} onSave={noop} visible />
      </>
    ),
  },
  {
    key: 'sheet-confirm',
    label: 'Profile — removing a contact',
    render: () => (
      <>
        {profileView({ role: 'owner' })}
        <ConfirmSheet
          cancelLabel="Keep it"
          confirmLabel="Remove contact"
          destructive
          message={'“Dr Priya Patel” will be removed from this profile for everyone in the circle, and the change is recorded in the activity log. This cannot be undone.'}
          onClose={noop}
          onConfirm={noop}
          testID="profile-delete-confirm"
          title="Remove “Dr Priya Patel”?"
          visible
        />
      </>
    ),
  },
];

function PreviewBody() {
  const theme = useTheme();
  const [scheme, setScheme] = useState<'light' | 'dark'>('light');
  const [selected, setSelected] = useState<string>('owner');

  const current = STATES.find((state) => state.key === selected) ?? STATES[0];

  return (
    <View style={{ backgroundColor: theme.colors.bg, flex: 1 }}>
      <View style={{ gap: theme.space.xs, padding: theme.space.sm }}>
        <ScreenHeader
          eyebrow="Hidden"
          subtitle="Every state of the person profile, at 390px, in both schemes. Not linked from anywhere."
          title="Profile states"
        />

        <View style={{ flexDirection: 'row', gap: theme.space.xs }}>
          <Button
            label="Light"
            onPress={() => {
              setScheme('light');
            }}
            size="small"
            variant={scheme === 'light' ? 'primary' : 'secondary'}
          />
          <Button
            label="Dark"
            onPress={() => {
              setScheme('dark');
            }}
            size="small"
            variant={scheme === 'dark' ? 'primary' : 'secondary'}
          />
        </View>

        <ScrollView style={{ maxHeight: 140 }}>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.space['2xs'] }}>
            {STATES.map((state) => (
              <Button
                key={state.key}
                label={state.label}
                onPress={() => {
                  setSelected(state.key);
                }}
                size="small"
                testID={`preview-${state.key}`}
                variant={state.key === selected ? 'secondary' : 'ghost'}
              />
            ))}
          </View>
        </ScrollView>

        <Text tone="tertiary" variant="caption">
          {current?.label ?? ''} · {scheme}
        </Text>
      </View>

      <View style={{ alignItems: 'center', flex: 1 }}>
        <View
          style={{
            borderColor: theme.colors.borderStrong,
            borderRadius: theme.radius.card,
            borderWidth: 1,
            flex: 1,
            overflow: 'hidden',
            width: 390,
          }}
          testID="preview-frame"
        >
          {/* `key` remounts the frame when the scheme changes: `initialMode` is
              read once, so without it the Dark button recoloured the page and
              left the phone frame light. */}
          <ThemeProvider initialMode={scheme} key={`${scheme}-${selected}`}>
            <View style={{ flex: 1 }}>{current?.render()}</View>
          </ThemeProvider>
        </View>
      </View>
    </View>
  );
}

export default function ProfilePreviewRoute() {
  return <PreviewBody />;
}
