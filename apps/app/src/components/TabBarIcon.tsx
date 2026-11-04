import { StyleSheet, View, type ColorValue } from 'react-native';
import type { LucideIcon } from 'lucide-react-native';

import { useTheme } from '../theme';

export interface TabBarIconProps {
  icon: LucideIcon;
  focused: boolean;
  /** Colour supplied by the tab bar — accent when active, muted when not. */
  color: ColorValue;
  size?: number;
}

/**
 * Icon with the active-state pill behind it. The pill is the only visual
 * change on selection: the label below it is always visible and changes
 * colour with it, so the state does not rely on colour alone (the pill shape
 * carries it too).
 */
export function TabBarIcon({ icon: Icon, focused, color, size = 22 }: TabBarIconProps) {
  const theme = useTheme();

  return (
    <View
      style={[
        styles.pill,
        {
          backgroundColor: focused ? theme.colors.accentSoft : 'transparent',
          borderRadius: theme.radius.pill,
        },
      ]}
    >
      <Icon size={size} color={color} strokeWidth={focused ? 2.25 : 2} />
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    minWidth: 52,
    height: 22,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 10,
  },
});
