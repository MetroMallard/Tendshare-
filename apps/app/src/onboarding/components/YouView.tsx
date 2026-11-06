import { View } from 'react-native';

import { Avatar, Button, Card, Text, TextField, useTheme } from '@tendshare/ui';

import { Screen } from '../../components/Screen';
import type { OnboardingFailure } from '../errors';
import { OnboardingNotice } from './OnboardingNotice';
import { StepHeader } from './StepHeader';

export interface YouViewProps {
  readonly displayName: string;
  readonly onChangeName: (value: string) => void;
  readonly onSubmit: () => void;
  /** Shown under the field; `undefined` while the name is acceptable. */
  readonly nameError?: string;
  readonly offline: boolean;
  readonly submitting: boolean;
  readonly failure: OnboardingFailure | null;
  /** Only offered when there is something to throw away. */
  readonly onStartOver?: () => void;
}

/**
 * Screen 1 — what we should call you.
 *
 * One field, one button, and the initials updating as they type, so the screen
 * answers "is this working?" without a spinner. The name arrives filled in from
 * the identity provider or the email address when we can honestly fill it; the
 * field is always theirs to overwrite.
 */
export function YouView({
  displayName,
  onChangeName,
  onSubmit,
  nameError,
  offline,
  submitting,
  failure,
  onStartOver,
}: YouViewProps) {
  const theme = useTheme();

  return (
    <Screen
      keyboardAware
      footer={
        <Button
          fullWidth
          label="Continue"
          loading={submitting}
          loadingLabel="Saving your name"
          onPress={onSubmit}
          size="large"
          testID="onboarding-you-continue"
        />
      }
    >
      <View style={{ gap: theme.space.md }} testID="screen-onboarding-you">
        <StepHeader
          step="you"
          subtitle="This is the name your family will see next to what you do. You can change it any time."
          title="What should we call you?"
          titleTestID="onboarding-you-title"
        />

        {offline ? (
          <OnboardingNotice
            message="You can keep going — we'll save everything when you're back online."
            testID="onboarding-you-offline"
            title="You're offline"
            tone="warning"
          />
        ) : null}

        {failure ? (
          <OnboardingNotice
            message={failure.message}
            testID="onboarding-you-error"
            title={failure.title}
            tone="danger"
          />
        ) : null}

        <Card>
          <View style={{ alignItems: 'center', gap: theme.space.md }}>
            <Avatar name={displayName} size="large" />

            <TextField
              autoCapitalize="words"
              autoComplete="name"
              autoCorrect={false}
              editable={!submitting}
              error={nameError}
              label="Your name"
              onChangeText={onChangeName}
              onSubmitEditing={onSubmit}
              placeholder="Sara"
              returnKeyType="next"
              testID="onboarding-you-name"
              textContentType="name"
              value={displayName}
            />
          </View>
        </Card>

        <Text align="center" tone="tertiary" variant="caption">
          Only people you invite can see your family&apos;s care.
        </Text>

        {onStartOver ? (
          <Button
            accessibilityHint="Clears the answers you have typed so far and starts from the first screen."
            fullWidth
            label="Start over"
            onPress={onStartOver}
            size="small"
            testID="onboarding-you-start-over"
            variant="ghost"
          />
        ) : null}
      </View>
    </Screen>
  );
}
