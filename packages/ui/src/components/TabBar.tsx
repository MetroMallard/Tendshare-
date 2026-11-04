import { Pressable, View } from 'react-native';

import { useTheme } from '../ThemeProvider';
import { useFocusRing, type IconComponent } from '../primitives';
import { Text } from './Text';

export interface TabBarItem {
  /** Route key, chosen by the app. */
  readonly key: string;
  readonly label: string;
  /** Spoken label, when the visible one is short: "Meds" -> "Medications". */
  readonly accessibilityLabel: string;
  readonly icon: IconComponent;
}

export interface TabBarProps {
  readonly items: readonly TabBarItem[];
  /** The key of the active tab. */
  readonly value: string;
  readonly onSelect: (key: string) => void;
  readonly insetBottom?: number;
  readonly testID?: string;
}

function TabItem({
  item,
  focused,
  onSelect,
}: {
  readonly item: TabBarItem;
  readonly focused: boolean;
  readonly onSelect: () => void;
}) {
  const theme = useTheme();
  const { focusHandlers, focusRingStyle } = useFocusRing();
  const Icon = item.icon;
  const color = focused ? theme.colors.brand : theme.colors.textSecondary;

  return (
    <Pressable
      accessibilityLabel={item.accessibilityLabel}
      accessibilityRole="tab"
      accessibilityState={{ selected: focused }}
      onPress={onSelect}
      {...focusHandlers}
      style={({ pressed }) => ({
        alignItems: 'center',
        flex: 1,
        gap: theme.space['2xs'],
        justifyContent: 'center',
        minHeight: theme.layout.minTapTarget,
        opacity: pressed ? 0.7 : 1,
        paddingVertical: theme.space['2xs'],
        ...focusRingStyle,
      })}
    >
      <View
        accessible={false}
        style={{
          alignItems: 'center',
          backgroundColor: focused ? theme.colors.brandSoft : 'transparent',
          borderRadius: theme.radius.pill,
          justifyContent: 'center',
          paddingHorizontal: theme.space.sm,
          paddingVertical: theme.space['2xs'],
        }}
      >
        <Icon color={color} size={22} strokeWidth={focused ? 2.4 : 2} />
      </View>
      <Text numberOfLines={1} style={{ color }} variant={focused ? 'label' : 'caption'}>
        {item.label}
      </Text>
    </Pressable>
  );
}

/**
 * The bar at the bottom of the app: five tabs, always labelled, always 48pt.
 *
 * Presentational on purpose — it knows nothing about routing. The app maps each
 * tab to a route and tells this component which one is active.
 */
export function TabBar({ items, value, onSelect, insetBottom = 0, testID }: TabBarProps) {
  const theme = useTheme();

  return (
    <View
      testID={testID}
      style={[
        {
          alignItems: 'center',
          backgroundColor: theme.colors.surface,
          borderTopColor: theme.colors.border,
          borderTopWidth: 1,
          paddingBottom: insetBottom,
          width: '100%',
        },
        theme.elevation.bar,
      ]}
    >
      <View
        style={{
          flexDirection: 'row',
          maxWidth: theme.layout.maxContentWidth,
          paddingHorizontal: theme.space.xs,
          paddingTop: theme.space['2xs'],
          width: '100%',
        }}
      >
        {items.map((item) => (
          <TabItem
            focused={item.key === value}
            item={item}
            key={item.key}
            onSelect={() => {
              onSelect(item.key);
            }}
          />
        ))}
      </View>
    </View>
  );
}
