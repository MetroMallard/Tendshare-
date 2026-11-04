import { Stack, type ErrorBoundaryProps } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Pressable, StyleSheet, Text, View, useColorScheme } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { getTheme } from '../src/theme/tokens';
import { ThemeProvider, useTheme } from '../src/theme';

function RootNavigator() {
  const theme = useTheme();

  return (
    <>
      <StatusBar style={theme.scheme === 'dark' ? 'light' : 'dark'} />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: theme.colors.background },
        }}
      >
        <Stack.Screen name="(tabs)" />
      </Stack>
    </>
  );
}

/** Shown if a screen throws. Calm copy, no stack traces on screen. */
export function ErrorBoundary({ error, retry }: ErrorBoundaryProps) {
  const theme = getTheme(useColorScheme());

  return (
    <View
      style={[
        styles.errorRoot,
        { backgroundColor: theme.colors.background, padding: theme.spacing.xl },
      ]}
    >
      <View
        style={[
          styles.errorCard,
          {
            backgroundColor: theme.colors.surface,
            borderColor: theme.colors.border,
            borderRadius: theme.radius.md,
            padding: theme.spacing.xl,
            gap: theme.spacing.md,
          },
        ]}
      >
        <Text
          accessibilityRole="header"
          style={[theme.typography.title, { color: theme.colors.text }]}
        >
          Something went wrong
        </Text>
        <Text style={[theme.typography.body, { color: theme.colors.textMuted }]}>
          Nothing has been lost. Please try again.
        </Text>
        {error.message ? (
          <Text style={[theme.typography.caption, { color: theme.colors.textMuted }]}>
            {error.message}
          </Text>
        ) : null}
        <Pressable
          accessibilityRole="button"
          onPress={() => {
            void retry();
          }}
          style={({ pressed }) => [
            styles.retry,
            {
              backgroundColor: theme.colors.accent,
              borderRadius: theme.radius.pill,
              paddingVertical: theme.spacing.md,
              paddingHorizontal: theme.spacing.xl,
              opacity: pressed ? 0.85 : 1,
            },
          ]}
        >
          <Text
            style={[
              theme.typography.bodyStrong,
              { color: theme.colors.onAccent, textAlign: 'center' },
            ]}
          >
            Try again
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <RootNavigator />
      </ThemeProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  errorRoot: {
    flex: 1,
    justifyContent: 'center',
  },
  errorCard: {
    borderWidth: StyleSheet.hairlineWidth,
  },
  retry: {
    alignSelf: 'flex-start',
    minHeight: 48,
    justifyContent: 'center',
  },
});
