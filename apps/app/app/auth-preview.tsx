import { useState, type ReactNode } from 'react';
import { ScrollView, View } from 'react-native';

import { Button, ScreenHeader, Text, ThemeProvider, useTheme } from '@tendshare/ui';

import { SessionLoadingView } from '../src/auth/components/SessionLoadingView';
import { SignInView } from '../src/auth/components/SignInView';
import { VerifyView } from '../src/auth/components/VerifyView';
import { failureOf } from '../src/auth/errors';
import { providerViews } from '../src/auth/providers';

/**
 * Every state of both auth screens, on purpose, at 390px, in both schemes.
 *
 * This is the auth twin of `/gallery`: hidden, unlinked, no care data, and the
 * only way to look at "wrong code" or "offline" without waiting for the network
 * to misbehave on cue. QA and the owner open `/auth-preview` directly.
 *
 * The screens themselves are pure views, so each state here is the real
 * component with fixture props — not a mock-up that can drift.
 */

const GOOGLE_ON = providerViews({ google: true, apple: false });
const GOOGLE_OFF = providerViews({ google: false, apple: false });

const noop = () => undefined;

interface StateFixture {
  readonly key: string;
  readonly label: string;
  readonly render: () => ReactNode;
}

const STATES: readonly StateFixture[] = [
  {
    key: 'sign-in',
    label: 'Sign in',
    render: () => (
      <SignInView
        busyProvider={null}
        email=""
        failure={null}
        notConfigured={false}
        offline={false}
        onChangeEmail={noop}
        onProvider={noop}
        onSubmit={noop}
        providers={GOOGLE_OFF}
        providersLoading={false}
        submitting={false}
      />
    ),
  },
  {
    key: 'sign-in-typed',
    label: 'Sign in — email typed',
    render: () => (
      <SignInView
        busyProvider={null}
        email="sara@example.com"
        failure={null}
        notConfigured={false}
        offline={false}
        onChangeEmail={noop}
        onProvider={noop}
        onSubmit={noop}
        providers={GOOGLE_ON}
        providersLoading={false}
        submitting={false}
      />
    ),
  },
  {
    key: 'sign-in-sending',
    label: 'Sign in — sending',
    render: () => (
      <SignInView
        busyProvider={null}
        email="sara@example.com"
        failure={null}
        notConfigured={false}
        offline={false}
        onChangeEmail={noop}
        onProvider={noop}
        onSubmit={noop}
        providers={GOOGLE_OFF}
        providersLoading={false}
        submitting
      />
    ),
  },
  {
    key: 'sign-in-providers-loading',
    label: 'Sign in — checking Google',
    render: () => (
      <SignInView
        busyProvider={null}
        email=""
        failure={null}
        notConfigured={false}
        offline={false}
        onChangeEmail={noop}
        onProvider={noop}
        onSubmit={noop}
        providers={GOOGLE_OFF}
        providersLoading
        submitting={false}
      />
    ),
  },
  {
    key: 'sign-in-bad-email',
    label: 'Sign in — bad email',
    render: () => (
      <SignInView
        busyProvider={null}
        email="sara@example"
        failure={failureOf('email_invalid')}
        notConfigured={false}
        offline={false}
        onChangeEmail={noop}
        onProvider={noop}
        onSubmit={noop}
        providers={GOOGLE_OFF}
        providersLoading={false}
        submitting={false}
      />
    ),
  },
  {
    key: 'sign-in-offline',
    label: 'Sign in — offline',
    render: () => (
      <SignInView
        busyProvider={null}
        email="sara@example.com"
        failure={null}
        notConfigured={false}
        offline
        onChangeEmail={noop}
        onProvider={noop}
        onSubmit={noop}
        providers={GOOGLE_OFF}
        providersLoading={false}
        submitting={false}
      />
    ),
  },
  {
    key: 'sign-in-not-configured',
    label: 'Sign in — not configured',
    render: () => (
      <SignInView
        busyProvider={null}
        email=""
        failure={null}
        notConfigured
        offline={false}
        onChangeEmail={noop}
        onProvider={noop}
        onSubmit={noop}
        providers={GOOGLE_OFF}
        providersLoading={false}
        submitting={false}
      />
    ),
  },
  {
    key: 'verify',
    label: 'Verify — code arriving',
    render: () => (
      <VerifyView
        code=""
        email="sara@example.com"
        failure={null}
        offline={false}
        onChangeCode={noop}
        onChangeEmail={noop}
        onResend={noop}
        onSubmit={noop}
        resendIn={24}
        resending={false}
        verifying={false}
      />
    ),
  },
  {
    key: 'verify-typing',
    label: 'Verify — typing',
    render: () => (
      <VerifyView
        code="418"
        email="sara@example.com"
        failure={null}
        offline={false}
        onChangeCode={noop}
        onChangeEmail={noop}
        onResend={noop}
        onSubmit={noop}
        resendIn={0}
        resending={false}
        verifying={false}
      />
    ),
  },
  {
    key: 'verify-wrong',
    label: 'Verify — wrong code',
    render: () => (
      <VerifyView
        code=""
        email="sara@example.com"
        failure={failureOf('invalid_code')}
        offline={false}
        onChangeCode={noop}
        onChangeEmail={noop}
        onResend={noop}
        onSubmit={noop}
        resendIn={0}
        resending={false}
        verifying={false}
      />
    ),
  },
  {
    key: 'verify-checking',
    label: 'Verify — checking',
    render: () => (
      <VerifyView
        code="418206"
        email="sara@example.com"
        failure={null}
        offline={false}
        onChangeCode={noop}
        onChangeEmail={noop}
        onResend={noop}
        onSubmit={noop}
        resendIn={12}
        resending={false}
        verifying
      />
    ),
  },
  {
    key: 'verify-offline',
    label: 'Verify — offline',
    render: () => (
      <VerifyView
        code="4182"
        email="sara@example.com"
        failure={null}
        offline
        onChangeCode={noop}
        onChangeEmail={noop}
        onResend={noop}
        onSubmit={noop}
        resendIn={0}
        resending={false}
        verifying={false}
      />
    ),
  },
  {
    key: 'verify-rate-limited',
    label: 'Verify — too many tries',
    render: () => (
      <VerifyView
        code=""
        email="sara@example.com"
        failure={failureOf('too_many_attempts')}
        offline={false}
        onChangeCode={noop}
        onChangeEmail={noop}
        onResend={noop}
        onSubmit={noop}
        resendIn={30}
        resending={false}
        verifying={false}
      />
    ),
  },
  {
    key: 'loading',
    label: 'Restoring session',
    render: () => <SessionLoadingView />,
  },
];

function PreviewBody() {
  const theme = useTheme();
  const [scheme, setScheme] = useState<'light' | 'dark'>('light');
  const [selected, setSelected] = useState<string>('sign-in');

  const current = STATES.find((state) => state.key === selected) ?? STATES[0];

  return (
    <View style={{ backgroundColor: theme.colors.bg, flex: 1 }}>
      <View style={{ gap: theme.space.xs, padding: theme.space.sm }}>
        <ScreenHeader
          eyebrow="Hidden"
          subtitle="Every auth state, at 390px, in both schemes. Not linked from anywhere."
          title="Auth states"
        />

        <View style={{ flexDirection: 'row', gap: theme.space.xs }}>
          <Button
            label="Light"
            onPress={() => setScheme('light')}
            size="small"
            variant={scheme === 'light' ? 'primary' : 'secondary'}
          />
          <Button
            label="Dark"
            onPress={() => setScheme('dark')}
            size="small"
            variant={scheme === 'dark' ? 'primary' : 'secondary'}
          />
        </View>

        <ScrollView style={{ maxHeight: 120 }}>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.space['2xs'] }}>
            {STATES.map((state) => (
              <Button
                key={state.key}
                label={state.label}
                onPress={() => setSelected(state.key)}
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
          {/* A nested provider pins the scheme for the phone frame only. */}
          <ThemeProvider initialMode={scheme}>
            <View style={{ flex: 1 }}>{current?.render()}</View>
          </ThemeProvider>
        </View>
      </View>
    </View>
  );
}

export default function AuthPreviewRoute() {
  return <PreviewBody />;
}
