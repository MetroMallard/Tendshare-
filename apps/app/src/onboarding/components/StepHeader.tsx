import type { ReactNode } from 'react';
import { View } from 'react-native';

import { ScreenHeader, Text, brand, useTheme } from '@tendshare/ui';

import { stepLabel, type OnboardingStep } from '../steps';

export interface StepHeaderProps {
  readonly step: OnboardingStep;
  readonly title: string;
  readonly subtitle?: string;
  readonly onBack?: () => void;
  /** A small slot on the right of the progress line, e.g. "Start over". */
  readonly action?: ReactNode;
  readonly titleTestID?: string;
}

/**
 * The top of an onboarding screen: the product's name, a quiet step count, then
 * one question.
 *
 * "Step 1 of 3" sits in the top corner at caption size, not in a stepper with
 * dots and bars. Three screens do not need a progress bar; they need the person
 * to know the end is close. The step count is also the only place a screen says
 * where it is, so the copy below never has to.
 */
export function StepHeader({
  step,
  title,
  subtitle,
  onBack,
  action,
  titleTestID,
}: StepHeaderProps) {
  const theme = useTheme();

  return (
    <View>
      <View
        style={{
          alignItems: 'center',
          flexDirection: 'row',
          gap: theme.space.xs,
          justifyContent: 'space-between',
        }}
      >
        <Text tone="brand" uppercase variant="label">
          {brand.name}
        </Text>
        <Text testID="onboarding-step-label" tone="tertiary" variant="caption">
          {stepLabel(step)}
        </Text>
      </View>

      <View style={{ marginTop: theme.space.md }}>
        <ScreenHeader
          action={action}
          onBack={onBack}
          subtitle={subtitle}
          title={title}
          titleTestID={titleTestID}
        />
      </View>
    </View>
  );
}
