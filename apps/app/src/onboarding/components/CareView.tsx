import { View } from 'react-native';

import { Button, Card, Field, OptionList, Text, TextField, useTheme } from '@tendshare/ui';

import { Screen } from '../../components/Screen';
import type { OnboardingFailure } from '../errors';
import { RELATIONSHIPS, type Relationship } from '../validation';
import { OnboardingNotice } from './OnboardingNotice';
import { StepHeader } from './StepHeader';

export interface CareViewProps {
  readonly recipientName: string;
  readonly onChangeName: (value: string) => void;
  readonly relationship: Relationship | null;
  readonly onChangeRelationship: (value: Relationship) => void;
  readonly onSubmit: () => void;
  readonly onBack: () => void;
  readonly nameError?: string;
  readonly relationshipError?: string;
  readonly offline: boolean;
  readonly submitting: boolean;
  readonly failure: OnboardingFailure | null;
}

const RELATIONSHIP_OPTIONS = RELATIONSHIPS.map((value) => ({ value, label: value }));

/**
 * Screen 2 — who you're caring for.
 *
 * A first name and a relationship, and nothing else. The note in the middle of
 * the screen does the job the brief is strict about: this is not a medical
 * record, it is not a diagnosis, and the app will not tell anyone what to do
 * about any of it. Saying that here — before a single health question could be
 * imagined — is what keeps the rest of the product honest.
 */
export function CareView({
  recipientName,
  onChangeName,
  relationship,
  onChangeRelationship,
  onSubmit,
  onBack,
  nameError,
  relationshipError,
  offline,
  submitting,
  failure,
}: CareViewProps) {
  const theme = useTheme();

  return (
    <Screen
      keyboardAware
      footer={
        <Button
          fullWidth
          label="Continue"
          loading={submitting}
          loadingLabel="Saving"
          onPress={onSubmit}
          size="large"
          testID="onboarding-care-continue"
        />
      }
    >
      <View style={{ gap: theme.space.md }} testID="screen-onboarding-care">
        <StepHeader
          onBack={onBack}
          step="care"
          subtitle="Their first name is enough for now — you can add the rest later."
          title="Who are you caring for?"
          titleTestID="onboarding-care-title"
        />

        {offline ? (
          <OnboardingNotice
            message="You can keep going — we'll save everything when you're back online."
            testID="onboarding-care-offline"
            title="You're offline"
            tone="warning"
          />
        ) : null}

        {failure ? (
          <OnboardingNotice
            message={failure.message}
            testID="onboarding-care-error"
            title={failure.title}
            tone="danger"
          />
        ) : null}

        <Card>
          <View style={{ gap: theme.space.md }}>
            <TextField
              autoCapitalize="words"
              autoCorrect={false}
              editable={!submitting}
              error={nameError}
              label="Their first name"
              onChangeText={onChangeName}
              placeholder="Margaret"
              returnKeyType="done"
              testID="onboarding-care-name"
              value={recipientName}
            />

            <Field
              error={relationshipError}
              hint="Pick the one that fits best."
              label="How are they related to you?"
            >
              <OptionList
                accessibilityLabel="How are they related to you?"
                onChange={onChangeRelationship}
                options={RELATIONSHIP_OPTIONS}
                testID="onboarding-care-relationship"
                value={relationship}
              />
            </Field>
          </View>
        </Card>

        <OnboardingNotice
          message="We only help your family stay organised. We don't give medical advice, and you won't be asked for health details here."
          testID="onboarding-care-not-medical"
          title="This isn't medical information"
        />

        <Text align="center" tone="tertiary" variant="caption">
          You can add photos, doctors and insurance cards later, when you&apos;re ready.
        </Text>
      </View>
    </Screen>
  );
}
