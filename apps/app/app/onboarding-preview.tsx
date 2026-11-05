import { useState, type ReactNode } from 'react';
import { ScrollView, View } from 'react-native';

import { Button, ScreenHeader, Text, ThemeProvider, useTheme } from '@tendshare/ui';

import { OnboardingLoadingView } from '../src/onboarding/components/OnboardingLoadingView';
import { CareView } from '../src/onboarding/components/CareView';
import { InviteView } from '../src/onboarding/components/InviteView';
import { YouView } from '../src/onboarding/components/YouView';
import { onboardingFailureOf } from '../src/onboarding/errors';
import { inviteActions } from '../src/onboarding/inviteActions';

/**
 * Every state of the three onboarding screens, on purpose, at 390px, in both
 * schemes — the onboarding twin of `/auth-preview`.
 *
 * Hidden, unlinked, and holding no care data: it renders the real views with
 * fixture props, so what QA looks at here is the component the app ships, not a
 * mock-up that can drift. It is the only way to see "plan limit", "offline" and
 * "wrong details" without making the network misbehave on cue.
 *
 * The views are pure, so nothing here touches the session, the draft store or
 * Supabase.
 */

const noop = () => undefined;

const TWO_ADDRESSES = ['sara@example.com', 'mike@example.com'];

interface StateFixture {
  readonly key: string;
  readonly label: string;
  readonly render: () => ReactNode;
}

const STATES: readonly StateFixture[] = [
  {
    key: 'you',
    label: '1. You — empty',
    render: () => (
      <YouView
        displayName=""
        failure={null}
        offline={false}
        onChangeName={noop}
        onSubmit={noop}
        submitting={false}
      />
    ),
  },
  {
    key: 'you-filled',
    label: '1. You — filled',
    render: () => (
      <YouView
        displayName="Sara Jones"
        failure={null}
        offline={false}
        onChangeName={noop}
        onSubmit={noop}
        onStartOver={noop}
        submitting={false}
      />
    ),
  },
  {
    key: 'you-error',
    label: '1. You — empty name',
    render: () => (
      <YouView
        displayName=""
        failure={null}
        nameError="Please add your name."
        offline={false}
        onChangeName={noop}
        onSubmit={noop}
        submitting={false}
      />
    ),
  },
  {
    key: 'you-offline',
    label: '1. You — offline',
    render: () => (
      <YouView
        displayName="Sara"
        failure={null}
        offline
        onChangeName={noop}
        onSubmit={noop}
        submitting={false}
      />
    ),
  },
  {
    key: 'care',
    label: '2. Who — empty',
    render: () => (
      <CareView
        failure={null}
        offline={false}
        onBack={noop}
        onChangeName={noop}
        onChangeRelationship={noop}
        onSubmit={noop}
        recipientName=""
        relationship={null}
        submitting={false}
      />
    ),
  },
  {
    key: 'care-filled',
    label: '2. Who — filled',
    render: () => (
      <CareView
        failure={null}
        offline={false}
        onBack={noop}
        onChangeName={noop}
        onChangeRelationship={noop}
        onSubmit={noop}
        recipientName="Margaret"
        relationship="Mother"
        submitting={false}
      />
    ),
  },
  {
    key: 'care-errors',
    label: '2. Who — nothing chosen',
    render: () => (
      <CareView
        failure={null}
        nameError="Please add their name."
        offline={false}
        onBack={noop}
        onChangeName={noop}
        onChangeRelationship={noop}
        onSubmit={noop}
        recipientName=""
        relationship={null}
        relationshipError="Choose how they are related to you."
        submitting={false}
      />
    ),
  },
  {
    key: 'care-offline',
    label: '2. Who — offline',
    render: () => (
      <CareView
        failure={null}
        offline
        onBack={noop}
        onChangeName={noop}
        onChangeRelationship={noop}
        onSubmit={noop}
        recipientName="Margaret"
        relationship="Grandparent"
        submitting={false}
      />
    ),
  },
  {
    key: 'invite',
    label: '3. Invite — skip is primary',
    render: () => (
      <InviteView
        actions={inviteActions({ addressCount: 0, invitesEnabled: false })}
        addresses={[]}
        email=""
        failure={null}
        invitesEnabled={false}
        onAddEmail={noop}
        onBack={noop}
        onChangeEmail={noop}
        onFinish={noop}
        onRemoveAddress={noop}
        onSkip={noop}
        offline={false}
        submitting={false}
      />
    ),
  },
  {
    key: 'invite-addresses',
    label: '3. Invite — two addresses',
    render: () => (
      <InviteView
        actions={inviteActions({ addressCount: 2, invitesEnabled: false })}
        addresses={TWO_ADDRESSES}
        email=""
        failure={null}
        invitesEnabled={false}
        onAddEmail={noop}
        onBack={noop}
        onChangeEmail={noop}
        onFinish={noop}
        onRemoveAddress={noop}
        onSkip={noop}
        offline={false}
        submitting={false}
      />
    ),
  },
  {
    key: 'invite-typing',
    label: '3. Invite — typing an address',
    render: () => (
      <InviteView
        actions={inviteActions({ addressCount: 1, invitesEnabled: false })}
        addresses={['sara@example.com']}
        email="mike@example.com"
        failure={null}
        invitesEnabled={false}
        onAddEmail={noop}
        onBack={noop}
        onChangeEmail={noop}
        onFinish={noop}
        onRemoveAddress={noop}
        onSkip={noop}
        offline={false}
        submitting={false}
      />
    ),
  },
  {
    key: 'invite-bad-address',
    label: '3. Invite — bad address',
    render: () => (
      <InviteView
        actions={inviteActions({ addressCount: 0, invitesEnabled: false })}
        addresses={[]}
        email="mike@example"
        failure={null}
        inviteProblem="That address doesn't look quite right. Check the spelling and try again."
        invitesEnabled={false}
        onAddEmail={noop}
        onBack={noop}
        onChangeEmail={noop}
        onFinish={noop}
        onRemoveAddress={noop}
        onSkip={noop}
        offline={false}
        submitting={false}
      />
    ),
  },
  {
    key: 'invite-offline',
    label: '3. Invite — offline',
    render: () => (
      <InviteView
        actions={inviteActions({ addressCount: 0, invitesEnabled: false })}
        addresses={[]}
        email=""
        failure={null}
        invitesEnabled={false}
        onAddEmail={noop}
        onBack={noop}
        onChangeEmail={noop}
        onFinish={noop}
        onRemoveAddress={noop}
        onSkip={noop}
        offline
        submitting={false}
      />
    ),
  },
  {
    key: 'invite-plan-limit',
    label: '3. Invite — plan limit',
    render: () => (
      <InviteView
        actions={inviteActions({ addressCount: 0, invitesEnabled: false })}
        addresses={[]}
        email=""
        failure={onboardingFailureOf('plan_limit')}
        invitesEnabled={false}
        onAddEmail={noop}
        onBack={noop}
        onChangeEmail={noop}
        onFinish={noop}
        onRemoveAddress={noop}
        onSkip={noop}
        offline={false}
        submitting={false}
      />
    ),
  },
  {
    key: 'invite-failed',
    label: '3. Invite — save failed',
    render: () => (
      <InviteView
        actions={inviteActions({ addressCount: 0, invitesEnabled: false })}
        addresses={[]}
        email=""
        failure={onboardingFailureOf('unknown')}
        invitesEnabled={false}
        onAddEmail={noop}
        onBack={noop}
        onChangeEmail={noop}
        onFinish={noop}
        onRemoveAddress={noop}
        onSkip={noop}
        offline={false}
        submitting={false}
      />
    ),
  },
  {
    key: 'invite-saving',
    label: '3. Invite — saving',
    render: () => (
      <InviteView
        actions={inviteActions({ addressCount: 2, invitesEnabled: false })}
        addresses={TWO_ADDRESSES}
        email=""
        failure={null}
        invitesEnabled={false}
        onAddEmail={noop}
        onBack={noop}
        onChangeEmail={noop}
        onFinish={noop}
        onRemoveAddress={noop}
        onSkip={noop}
        offline={false}
        submitting
      />
    ),
  },
  {
    key: 'invites-on',
    label: '3. Invite — invites switched on',
    render: () => (
      <InviteView
        actions={inviteActions({ addressCount: 2, invitesEnabled: true })}
        addresses={TWO_ADDRESSES}
        email=""
        failure={null}
        invitesEnabled
        onAddEmail={noop}
        onBack={noop}
        onChangeEmail={noop}
        onFinish={noop}
        onRemoveAddress={noop}
        onSkip={noop}
        offline={false}
        submitting={false}
      />
    ),
  },
  {
    key: 'loading',
    label: 'Reading the draft',
    render: () => <OnboardingLoadingView />,
  },
];

function PreviewBody() {
  const theme = useTheme();
  const [scheme, setScheme] = useState<'light' | 'dark'>('light');
  const [selected, setSelected] = useState<string>('you');

  const current = STATES.find((state) => state.key === selected) ?? STATES[0];

  return (
    <View style={{ backgroundColor: theme.colors.bg, flex: 1 }}>
      <View style={{ gap: theme.space.xs, padding: theme.space.sm }}>
        <ScreenHeader
          eyebrow="Hidden"
          subtitle="Every onboarding state, at 390px, in both schemes. Not linked from anywhere."
          title="Onboarding states"
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

export default function OnboardingPreviewRoute() {
  return <PreviewBody />;
}
