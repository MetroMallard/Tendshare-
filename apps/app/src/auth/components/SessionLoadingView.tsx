import { View } from 'react-native';

import { brand, Skeleton, Text, useTheme } from '@tendshare/ui';

import { Screen } from '../../components/Screen';

/**
 * The first second of the app: reading the session out of the keychain.
 *
 * A skeleton rather than a spinner, and never the sign-in form — someone who is
 * already signed in must not be shown a login screen while the answer arrives.
 */
export function SessionLoadingView() {
  const theme = useTheme();

  return (
    <Screen>
      <View
        accessibilityLabel="Getting things ready"
        accessibilityRole="progressbar"
        style={{ gap: theme.space.md, paddingTop: theme.space.lg }}
        testID="session-loading"
      >
        <Text tone="brand" uppercase variant="label">
          {brand.name}
        </Text>
        <Text accessibilityRole="header" variant="title">
          Getting things ready
        </Text>
        <Skeleton lines={2} />
        <Skeleton shape="card" />
        <Text tone="secondary" variant="caption">
          Just a moment.
        </Text>
      </View>
    </Screen>
  );
}
