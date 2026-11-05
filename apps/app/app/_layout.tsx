import { Stack, useRouter, useSegments, type ErrorBoundaryProps } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { View, useColorScheme } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { Button, Card, Text, ThemeProvider, useTheme } from '@tendshare/ui';

import { SessionLoadingView } from '../src/auth/components/SessionLoadingView';
import { SessionProvider, useSession } from '../src/auth/session';
import { CircleProvider, useCircle } from '../src/circles/CircleProvider';
import { isHiddenRoute, resolveAuthRedirect } from '../src/navigation/authGuard';
import { resolveOnboardingRedirect } from '../src/onboarding/guard';
import { isOnboardingRoute } from '../src/onboarding/steps';

/**
 * The app shell, behind two gates.
 *
 * `resolveAuthRedirect` answers "signed in or not?" and `resolveOnboardingRedirect`
 * answers "has this person set up their circle?" — both pure functions with
 * their own tables of tests, and this component only carries out what they
 * decide. Auth runs first, because a signed-out visitor has no circle to ask
 * about and must never be sent into a flow they cannot finish.
 *
 * It runs on every session and circle change, so signing out on one screen
 * closes the shell everywhere at once, finishing setup lands on Today, and
 * nobody with a circle sees onboarding twice.
 */
function RootNavigator() {
  const theme = useTheme();
  const { status, pendingEmail } = useSession();
  const { state: circleState } = useCircle();
  const segments = useSegments();
  const router = useRouter();

  const redirect =
    resolveAuthRedirect({
      status,
      segments,
      hasPendingEmail: pendingEmail !== null,
    }) ?? resolveOnboardingRedirect({ status, segments, circleState });

  useEffect(() => {
    if (redirect !== null) {
      router.replace(redirect);
    }
  }, [redirect, router]);

  // While the circle lookup is in flight, a signed-in person on the shell is
  // shown the loading screen rather than Today: otherwise a brand-new account
  // sees an empty app for a frame before setup opens.
  const waitingForCircle =
    status === 'signedIn' &&
    circleState === 'loading' &&
    !isOnboardingRoute(segments) &&
    !isHiddenRoute(segments);

  if (status === 'loading' || waitingForCircle) {
    return (
      <>
        <StatusBar style={theme.scheme === 'dark' ? 'light' : 'dark'} />
        <SessionLoadingView />
      </>
    );
  }

  return (
    <>
      <StatusBar style={theme.scheme === 'dark' ? 'light' : 'dark'} />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: theme.colors.bg },
        }}
      >
        <Stack.Screen name="(auth)" />
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="onboarding" options={{ animation: 'fade' }} />
      </Stack>
    </>
  );
}

/** Calm, no stack traces on screen. */
function ErrorFallback({ error, retry }: ErrorBoundaryProps) {
  const theme = useTheme();

  return (
    <View
      style={{
        backgroundColor: theme.colors.bg,
        flex: 1,
        justifyContent: 'center',
        padding: theme.space.md,
      }}
    >
      <Card>
        <Text accessibilityRole="header" variant="title">
          Something went wrong
        </Text>
        <Text tone="secondary">Nothing has been lost. Please try again.</Text>
        {error.message ? (
          <Text tone="tertiary" variant="caption">
            {error.message}
          </Text>
        ) : null}
        <Button
          label="Try again"
          onPress={() => {
            void retry();
          }}
        />
      </Card>
    </View>
  );
}

/**
 * Shown if a screen throws. It sits outside the navigator, so it brings its own
 * theme provider rather than assuming the root one survived.
 */
export function ErrorBoundary({ error, retry }: ErrorBoundaryProps) {
  const scheme = useColorScheme();

  return (
    <ThemeProvider initialMode={scheme === 'dark' ? 'dark' : 'light'}>
      <ErrorFallback error={error} retry={retry} />
    </ThemeProvider>
  );
}

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <SessionProvider>
          <CircleProvider>
            <RootNavigator />
          </CircleProvider>
        </SessionProvider>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}
