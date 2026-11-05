import { View } from 'react-native';

import { Button, Card, ScreenHeader, Text, TextField, useTheme } from '@tendshare/ui';

import { Screen } from '../../components/Screen';
import { CODE_MAX_LENGTH, isCompleteCode } from '../code';
import type { AuthFailure } from '../errors';
import { AuthNotice } from './AuthNotice';

export interface VerifyViewProps {
  /** The address the code went to, exactly as the person typed it. */
  readonly email: string;
  readonly code: string;
  readonly onChangeCode: (value: string) => void;
  readonly onSubmit: () => void;
  readonly verifying: boolean;
  readonly onResend: () => void;
  readonly resending: boolean;
  /** Whole seconds left on the resend cooldown; 0 means the button is live. */
  readonly resendIn: number;
  readonly onChangeEmail: () => void;
  readonly failure: AuthFailure | null;
  readonly offline: boolean;
}

/**
 * The code screen.
 *
 * "Check your email for the code" — not "OTP dispatched". The address is shown
 * back because the person typed it a second ago and needs to know which inbox to
 * open; it is never *asked about* here, so nothing about who has an account is
 * revealed by this screen.
 */
export function VerifyView({
  email,
  code,
  onChangeCode,
  onSubmit,
  verifying,
  onResend,
  resending,
  resendIn,
  onChangeEmail,
  failure,
  offline,
}: VerifyViewProps) {
  const theme = useTheme();
  const ready = isCompleteCode(code);

  return (
    <Screen>
      <View style={{ gap: theme.space.md, paddingBottom: theme.space.lg }} testID="screen-verify">
        <ScreenHeader
          backLabel="Use a different email"
          eyebrow="One last step"
          onBack={onChangeEmail}
          subtitle={`We sent a code to ${email}.`}
          title="Check your email"
          titleTestID="verify-heading"
        />

        {offline ? (
          <AuthNotice
            message="You can type the code now — we'll check it as soon as you're back online."
            testID="verify-offline"
            title="You're offline"
            tone="warning"
          />
        ) : null}

        {failure ? (
          <AuthNotice
            message={failure.message}
            testID="verify-error"
            title={failure.title}
            tone="danger"
          />
        ) : null}

        <Card padding="md">
          <View style={{ gap: theme.space.sm }}>
            <TextField
              autoComplete="one-time-code"
              autoFocus
              editable={!verifying}
              inputMode="numeric"
              keyboardType="number-pad"
              label="The code from your email"
              maxLength={CODE_MAX_LENGTH}
              onChangeText={onChangeCode}
              onSubmitEditing={onSubmit}
              placeholder="123456"
              returnKeyType="done"
              testID="verify-code"
              textContentType="oneTimeCode"
              value={code}
            />
            <Button
              disabled={!ready || offline}
              fullWidth
              label="Sign in"
              loading={verifying}
              loadingLabel="Checking the code"
              onPress={onSubmit}
              size="large"
              testID="verify-submit"
            />
            <Text tone="secondary" variant="caption">
              It can take a minute to arrive. If it hasn't, look in your spam folder.
            </Text>
          </View>
        </Card>

        <View style={{ gap: theme.space['2xs'] }}>
          <Button
            disabled={resendIn > 0 || resending || offline}
            fullWidth
            label={resendIn > 0 ? `Send a new code in ${resendIn}s` : 'Send a new code'}
            loading={resending}
            loadingLabel="Sending a new code"
            onPress={onResend}
            testID="verify-resend"
            variant="ghost"
          />
          <Button
            fullWidth
            label="Use a different email"
            onPress={onChangeEmail}
            testID="verify-change-email"
            variant="ghost"
          />
        </View>

        <Text align="center" tone="tertiary" variant="caption">
          The code works once, and only for a short while.
        </Text>
      </View>
    </Screen>
  );
}
