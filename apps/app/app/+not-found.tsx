import { Link, Stack } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';

import { Screen } from '../src/components/Screen';
import { useTheme } from '../src/theme';

/** Fallback for an unknown route. */
export default function NotFoundScreen() {
  const theme = useTheme();

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <Screen>
        <View style={{ gap: theme.spacing.md }}>
          <Text
            accessibilityRole="header"
            style={[theme.typography.display, { color: theme.colors.text }]}
          >
            We couldn't find that page
          </Text>
          <Text style={[theme.typography.body, { color: theme.colors.textMuted }]}>
            The link may be out of date. Everything else still works.
          </Text>
          <Link
            href="/"
            style={[theme.typography.bodyStrong, styles.link, { color: theme.colors.accent }]}
          >
            Go to Today
          </Link>
        </View>
      </Screen>
    </>
  );
}

const styles = StyleSheet.create({
  link: {
    minHeight: 48,
    textAlignVertical: 'center',
  },
});
