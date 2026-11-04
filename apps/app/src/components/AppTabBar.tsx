import { usePathname, useRouter } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { TAB_ICONS } from '../navigation/tabIcons';
import { normalizePathname, TABS } from '../navigation/tabs';
import { useTheme } from '../theme';
import { TabBarIcon } from './TabBarIcon';

/**
 * The tab bar.
 *
 * Written by hand rather than themed from the default one so three things are
 * guaranteed on every platform: the label is always visible under the icon,
 * every target is at least 48pt tall, and on a wide browser window the bar
 * stays aligned with the content column instead of stretching edge to edge.
 */
export function AppTabBar() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const pathname = usePathname();
  const router = useRouter();
  const current = normalizePathname(pathname);

  return (
    <View
      style={[
        styles.bar,
        {
          backgroundColor: theme.colors.surface,
          borderTopColor: theme.colors.border,
          paddingBottom: insets.bottom,
        },
      ]}
    >
      <View style={[styles.row, { maxWidth: theme.layout.maxContentWidth }]}>
        {TABS.map((tab) => {
          const focused = current === tab.path;
          const Icon = TAB_ICONS[tab.name];
          const color = focused ? theme.colors.accent : theme.colors.textMuted;

          return (
            <Pressable
              key={tab.name}
              accessibilityRole="tab"
              accessibilityLabel={tab.accessibilityLabel}
              accessibilityState={{ selected: focused }}
              onPress={() => {
                if (!focused) {
                  router.navigate(tab.path);
                }
              }}
              style={({ pressed }) => [
                styles.item,
                { minHeight: theme.layout.minTapTarget, opacity: pressed ? 0.7 : 1 },
              ]}
            >
              <TabBarIcon icon={Icon} focused={focused} color={color} size={19} />
              <Text style={[styles.label, { color }]} numberOfLines={1}>
                {tab.title}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    borderTopWidth: StyleSheet.hairlineWidth,
    width: '100%',
    alignItems: 'center',
  },
  row: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'stretch',
    paddingHorizontal: 8,
  },
  item: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 2,
    paddingBottom: 2,
  },
  label: {
    fontSize: 11,
    lineHeight: 13,
    fontWeight: '600',
  },
});
