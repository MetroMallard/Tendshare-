import { View } from 'react-native';

import { Skeleton, useTheme } from '@tendshare/ui';

import { Screen } from '../../components/Screen';

/**
 * What the person sees for the moment it takes to read the stored draft back.
 *
 * A skeleton in the shape of the screen, not a spinner: the frame is already the
 * right size, so when the real field appears nothing jumps. The block is one
 * accessibility element — "Loading your setup" — rather than a pile of
 * decorative rectangles for a screen reader to walk through.
 */
export function OnboardingLoadingView() {
  const theme = useTheme();

  return (
    <Screen>
      <View
        accessible
        accessibilityLabel="Loading your setup"
        style={{ gap: theme.space.md }}
        testID="onboarding-loading"
      >
        <Skeleton lines={2} shape="text" />
        <Skeleton shape="card" />
        <Skeleton lines={2} shape="row" />
        <Skeleton shape="card" />
      </View>
    </Screen>
  );
}
