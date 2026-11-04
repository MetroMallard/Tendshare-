import type { PropsWithChildren } from 'react';
import {
  ScrollView,
  StyleSheet,
  View,
  useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useTheme } from '../theme';

/**
 * The responsive shell every screen sits in.
 *
 * Phone: full width with 20pt gutters. Tablet and desktop browser: the content
 * stays in a centred column (`layout.maxContentWidth`) so long lines never
 * sprawl across a wide window. Safe-area insets keep content clear of the
 * notch and the home indicator on iOS and Android.
 */
export function Screen({ children }: PropsWithChildren) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();

  const gutter =
    width >= theme.layout.breakpoints.desktop
      ? theme.layout.gutter.desktop
      : width >= theme.layout.breakpoints.tablet
        ? theme.layout.gutter.tablet
        : theme.layout.gutter.phone;

  return (
    <View style={[styles.root, { backgroundColor: theme.colors.background }]}>
      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          {
            paddingTop: insets.top + theme.spacing.xl,
            paddingBottom: insets.bottom + theme.spacing.xxl,
            paddingHorizontal: gutter,
          },
        ]}
        keyboardShouldPersistTaps="handled"
      >
        <View style={[styles.column, { maxWidth: theme.layout.maxContentWidth }]}>{children}</View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    alignItems: 'center',
  },
  column: {
    width: '100%',
  },
});
