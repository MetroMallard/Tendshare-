import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';

import { useTheme } from '@tendshare/ui';

import { OnboardingProvider } from '../../src/onboarding/OnboardingProvider';

/**
 * The onboarding stack: three screens, one draft.
 *
 * The provider sits above the stack so a screen can be unmounted (back, a reload
 * on the web, the app being killed) without losing an answer. Each screen is a
 * real route, so the phone's back gesture and the browser's back button do the
 * obvious thing.
 */
export default function OnboardingLayout() {
  const theme = useTheme();

  return (
    <OnboardingProvider>
      <StatusBar style={theme.scheme === 'dark' ? 'light' : 'dark'} />
      <Stack
        screenOptions={{
          animation: 'slide_from_right',
          contentStyle: { backgroundColor: theme.colors.bg },
          headerShown: false,
        }}
      >
        <Stack.Screen name="index" />
        <Stack.Screen name="you" />
        <Stack.Screen name="care" />
        <Stack.Screen name="invite" />
      </Stack>
    </OnboardingProvider>
  );
}
