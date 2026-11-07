import { View } from 'react-native';

import { brand, Button, Card, Skeleton, Text, TextField, useTheme } from '@tendshare/ui';

import { Screen } from '../../components/Screen';
import type { AuthFailure } from '../errors';
import type { AuthProviderId, ProviderView } from '../providers';
import { AuthNotice } from './AuthNotice';

export interface SignInViewProps {
  readonly email: string;
  readonly onChangeEmail: (value: string) => void;
  readonly onSubmit: () => void;
  readonly submitting: boolean;
  readonly failure: AuthFailure | null;
  readonly offline: boolean;
  readonly providers: readonly ProviderView[];
  readonly providersLoading: boolean;
  readonly onProvider: (id: AuthProviderId) => void;
  readonly busyProvider: AuthProviderId | null;
  /** No Supabase configuration in this build: explain, do not pretend. */
  readonly notConfigured: boolean;
}

/** A hairline with a word in the middle: "or". */
function OrDivider() {
  const theme = useTheme();

  return (
    <View style={{ alignItems: 'center', flexDirection: 'row', gap: theme.space.xs }}>
      <View style={{ backgroundColor: theme.colors.border, flex: 1, height: 1 }} />
      <Text tone="tertiary" variant="caption">
        or
      </Text>
      <View style={{ backgroundColor: theme.colors.border, flex: 1, height: 1 }} />
    </View>
  );
}

/**
 * One provider button, or one honest sentence.
 *
 * When the Supabase project has not enabled a provider, this is *not* a greyed
 * out button — a dead control tells a tired person to keep tapping it. It is a
 * block that says what is true and what to do instead.
 */
function ProviderSlot({
  provider,
  onPress,
  busy,
  offline,
}: {
  readonly provider: ProviderView;
  readonly onPress: (id: AuthProviderId) => void;
  readonly busy: boolean;
  readonly offline: boolean;
}) {
  if (provider.status === 'enabled') {
    return (
      <Button
        fullWidth
        disabled={offline}
        label={provider.label}
        loading={busy}
        loadingLabel={`Opening ${provider.name}`}
        onPress={() => onPress(provider.id)}
        size="large"
        testID={`provider-${provider.id}`}
        variant="secondary"
      />
    );
  }

  return (
    <AuthNotice
      message={`Use your email for now — it works exactly the same. We'll turn ${provider.name} on as soon as it's ready.`}
      testID={`provider-${provider.id}-unavailable`}
      title={`${provider.name} sign-in isn't switched on yet`}
      tone="info"
    />
  );
}

/**
 * The sign-in screen: one field, one action, and whatever else is honestly
 * available.
 *
 * Pure presentation — every value and callback comes from the route, so the
 * hidden auth preview can render every state of it without a network or a
 * session.
 */
export function SignInView({
  email,
  onChangeEmail,
  onSubmit,
  submitting,
  failure,
  offline,
  providers,
  providersLoading,
  onProvider,
  busyProvider,
  notConfigured,
}: SignInViewProps) {
  const theme = useTheme();

  return (
    <Screen>
      <View style={{ gap: theme.space.md, paddingBottom: theme.space.lg }} testID="screen-sign-in">
        <View style={{ gap: theme.space['2xs'] }}>
          <Text tone="brand" uppercase variant="label">
            {brand.name}
          </Text>
          <Text accessibilityRole="header" testID="sign-in-heading" variant="title">
            Sign in
          </Text>
          <Text balance tone="secondary">
            {brand.tagline}
          </Text>
        </View>

        {notConfigured ? (
          <AuthNotice
            message="This version of the app was built without its sign-in settings, so we can't send you a code. Nothing is wrong with your account."
            testID="sign-in-not-configured"
            title="Sign-in isn't set up on this copy"
            tone="warning"
          />
        ) : null}

        {offline ? (
          <AuthNotice
            message="We'll be ready the moment you're back. Nothing you've typed is lost."
            testID="sign-in-offline"
            title="You're offline"
            tone="warning"
          />
        ) : null}

        {failure ? (
          <AuthNotice
            message={failure.message}
            testID="sign-in-error"
            title={failure.title}
            tone="danger"
          />
        ) : null}

        {notConfigured ? null : (
          <>
            <Card accessibilityLabel="Sign in with your email" padding="md">
              <View style={{ gap: theme.space.sm }}>
                <Text variant="subheading">Use your email</Text>
                <Text tone="secondary" variant="caption">
                  We'll email you a code. There's no password to remember.
                </Text>
                <TextField
                  autoCapitalize="none"
                  autoComplete="email"
                  autoCorrect={false}
                  editable={!submitting}
                  error={
                    failure?.kind === 'email_invalid'
                      ? "That address doesn't look right."
                      : undefined
                  }
                  inputMode="email"
                  keyboardType="email-address"
                  label="Email address"
                  onChangeText={onChangeEmail}
                  onSubmitEditing={onSubmit}
                  placeholder="you@example.com"
                  returnKeyType="send"
                  testID="sign-in-email"
                  textContentType="emailAddress"
                  value={email}
                />
                <Button
                  disabled={offline}
                  fullWidth
                  label="Email me a code"
                  loading={submitting}
                  loadingLabel="Sending the code"
                  onPress={onSubmit}
                  size="large"
                  testID="sign-in-submit"
                />
              </View>
            </Card>

            <OrDivider />

            {providersLoading
              ? providers.map((provider) => (
                  <Skeleton key={provider.id} shape="row" testID="sign-in-provider-loading" />
                ))
              : providers.map((provider) => (
                  <ProviderSlot
                    busy={busyProvider === provider.id}
                    key={provider.id}
                    offline={offline}
                    onPress={onProvider}
                    provider={provider}
                  />
                ))}

            <Text align="center" tone="tertiary" variant="caption">
              Only people you invite can see your family's care.
            </Text>
          </>
        )}
      </View>
    </Screen>
  );
}
