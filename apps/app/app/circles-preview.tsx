import { useState, type ReactNode } from 'react';
import { ScrollView, View } from 'react-native';

import { Button, Card, ScreenHeader, Text, ThemeProvider, useTheme } from '@tendshare/ui';

import { Screen } from '../src/components/Screen';
import { circleDisplayName, type CircleSummary } from '../src/circles/activeCircle';
import { CircleSwitcher } from '../src/circles/components/CircleSwitcher';
import { MembersView } from '../src/circles/components/MembersView';
import type { CircleMember } from '../src/circles/loadCircles';
import type { CircleRole } from '../src/circles/circleState';
import { capabilitiesFor } from '../src/circles/roles';

/**
 * Every state of the members screen and the circle switcher, on purpose, at
 * 390px, in both schemes — the Task 6 twin of `/onboarding-preview`.
 *
 * Hidden and unlinked. It renders the real components with fixture props, so
 * what QA looks at is what the app ships rather than a mock-up that drifts: the
 * loading skeletons, the offline note, the read-only roster for a family member,
 * and a circle name long enough to prove the header truncates instead of
 * wrapping.
 *
 * Nothing here touches the session or Supabase.
 */

const noop = () => undefined;

const MEMBERS: readonly CircleMember[] = [
  { profileId: 'p1', role: 'owner', displayName: 'Sara Jones', isSelf: true },
  { profileId: 'p2', role: 'family_member', displayName: 'Mike Jones', isSelf: false },
  { profileId: 'p3', role: 'view_only', displayName: 'Ella Jones', isSelf: false },
  { profileId: 'p4', role: 'visiting_helper', displayName: 'Grace Adeyemi', isSelf: false },
];

const LONG_NAME = 'Margaret’s circle — the Joneses and everyone who helps out on Thursdays';

const ONE_CIRCLE: readonly CircleSummary[] = [
  {
    circleId: 'c1',
    name: 'Margaret’s circle',
    role: 'owner',
    planTier: 'family',
    recipientName: 'Margaret',
    memberCount: 4,
  },
];

const TWO_CIRCLES: readonly CircleSummary[] = [
  ...ONE_CIRCLE,
  {
    circleId: 'c2',
    name: LONG_NAME,
    role: 'family_member',
    planTier: 'free',
    recipientName: 'Robert',
    memberCount: 3,
  },
];

function membersView(options: {
  readonly role: CircleRole;
  readonly circleName?: string;
  readonly members?: readonly CircleMember[] | null;
  readonly memberLimit?: number | null;
  readonly loadState?: 'loading' | 'ready' | 'error';
  readonly offline?: boolean;
  readonly problem?: { title: string; message: string } | null;
}): ReactNode {
  return (
    <MembersView
      capabilities={capabilitiesFor(options.role)}
      circleName={options.circleName ?? 'Margaret’s circle'}
      loadState={options.loadState ?? 'ready'}
      memberLimit={options.memberLimit ?? null}
      members={options.members === undefined ? MEMBERS : options.members}
      offline={options.offline ?? false}
      onBack={noop}
      onOpenRecipient={noop}
      onRename={noop}
      onRetry={noop}
      onSelectMember={noop}
      problem={options.problem ?? null}
      recipient={{ fullName: 'Margaret Jones', relationship: 'Mother' }}
      role={options.role}
    />
  );
}

/** The top of the More tab, which is where the switcher lives. */
function switcherView(options: {
  readonly circles: readonly CircleSummary[];
  readonly offline?: boolean;
}): ReactNode {
  const active = options.circles[0] ?? null;

  return (
    <Screen>
      <ScreenHeader
        eyebrow={active === null ? undefined : circleDisplayName(active)}
        subtitle="Your circle, the people in it, and your settings."
        title="More"
      />
      <Card padding="none">
        <CircleSwitcher
          active={active}
          circles={options.circles}
          offline={options.offline ?? false}
          onSwitch={noop}
        />
      </Card>
      <Text tone="tertiary" variant="caption">
        One circle: no switcher, just the name. Two: the same row becomes the way to change it.
      </Text>
    </Screen>
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
    label: 'Members — owner',
    render: () => membersView({ role: 'owner' }),
  },
  {
    key: 'owner-long-name',
    label: 'Members — long circle name',
    render: () => membersView({ role: 'owner', circleName: LONG_NAME }),
  },
  {
    key: 'owner-limit',
    label: 'Members — free plan at its limit',
    render: () =>
      membersView({
        role: 'owner',
        memberLimit: 3,
        members: MEMBERS.slice(0, 3),
      }),
  },
  {
    key: 'family',
    label: 'Members — family member (read-only)',
    render: () =>
      membersView({
        role: 'family_member',
        members: MEMBERS.map((member) =>
          member.profileId === 'p2' ? { ...member, isSelf: true } : { ...member, isSelf: false },
        ),
      }),
  },
  {
    key: 'view-only',
    label: 'Members — view only (read-only)',
    render: () => membersView({ role: 'view_only' }),
  },
  {
    key: 'helper',
    label: 'Members — visiting helper',
    render: () => membersView({ role: 'visiting_helper', members: [MEMBERS[3]!] }),
  },
  {
    key: 'loading',
    label: 'Members — loading',
    render: () => membersView({ role: 'owner', loadState: 'loading', members: null }),
  },
  {
    key: 'error',
    label: 'Members — could not load',
    render: () => membersView({ role: 'owner', loadState: 'error', members: null }),
  },
  {
    key: 'offline',
    label: 'Members — offline',
    render: () => membersView({ role: 'owner', offline: true }),
  },
  {
    key: 'problem',
    label: 'Members — only the owner can do that',
    render: () =>
      membersView({
        role: 'owner',
        problem: {
          title: 'Only the owner can do that',
          message: 'Nothing has changed. Ask whoever set the circle up to make this change.',
        },
      }),
  },
  {
    key: 'switch-one',
    label: 'Switcher — one circle',
    render: () => switcherView({ circles: ONE_CIRCLE }),
  },
  {
    key: 'switch-two',
    label: 'Switcher — two circles',
    render: () => switcherView({ circles: TWO_CIRCLES }),
  },
  {
    key: 'switch-long',
    label: 'Switcher — long name',
    render: () =>
      switcherView({
        circles: [{ ...TWO_CIRCLES[1]!, circleId: 'c2' }, ...ONE_CIRCLE],
      }),
  },
  {
    key: 'switch-offline',
    label: 'Switcher — offline',
    render: () => switcherView({ circles: TWO_CIRCLES, offline: true }),
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
          subtitle="Members and switcher states, at 390px, in both schemes. Not linked from anywhere."
          title="Circle states"
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
          <ThemeProvider initialMode={scheme} key={scheme}>
            <View style={{ flex: 1 }}>{current?.render()}</View>
          </ThemeProvider>
        </View>
      </View>
    </View>
  );
}

export default function CirclesPreviewRoute() {
  return <PreviewBody />;
}
