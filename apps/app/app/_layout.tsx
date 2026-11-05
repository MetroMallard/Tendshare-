import { Stack, useRouter, useSegments, type ErrorBoundaryProps } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { View, useColorScheme } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { Button, Card, Text, ThemeProvider, useTheme } from '@tendshare/ui';

import { SessionLoadingView } from '../src/auth/components/SessionLoadingView';
import { SessionProvider, useSession } from '../src/auth/session';
import { resolveAuthRedirect } from '../src/navigation/authGuard';

/**
 * The app shell, behind one gate.
 *
 * `resolveAuthRedirect` decides in one pure function whether this person belongs
 * on the sign-in screen or in the tabs; this component only carries it out. It
 * runs on every session change, so signing out on one screen closes the shell
 * everywhere at once, and signing in stops the sign-in form being reachable.
 */
function RootNavigator() {
  const theme = useTheme();
  const { status, pendingEmail } = useSession();
  const segments = useSegments();
  const router = useRouter();

  const redirect = resolveAuthRedirect({
    status,
    segments,
    hasPendingEmail: pendingEmail !== null,
  });

  useEffect(() => {
    if (redirect !== null) {
      router.replace(redirect);
    }
  }, [redirect, router]);

  if (status === 'loading') {
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
          <RootNavigator />
        </SessionProvider>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}
