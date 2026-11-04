import type { ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { useTheme } from '../ThemeProvider';
import { useFocusRing, type IconComponent } from '../primitives';
import { Avatar } from './Avatar';
import { Text } from './Text';

export interface ListRowProps {
  readonly title: string;
  readonly subtitle?: string;
  /** Leading glyph, shown in a tinted well. */
  readonly icon?: IconComponent;
  /** Leading initials, used when there is no `icon`. */
  readonly avatarName?: string;
  /** Right-hand slot: a pill, a time, a value, a small action. */
  readonly trailing?: ReactNode;
  readonly onPress?: () => void;
  /** Spoken hint about what pressing does. Required reading for ambiguity. */
  readonly accessibilityHint?: string;
  /** Shown when a row leads somewhere. Defaults on when the row is pressable. */
  readonly showChevron?: boolean;
  /** Hairline above the row, for grouping rows into one card. */
  readonly divider?: boolean;
  readonly testID?: string;
}

/** A dependency-free chevron, drawn from the border colour token. */
function Chevron({ color }: { color: string }) {
  return (
    <View
      style={{
        borderColor: color,
        borderRightWidth: 2,
        borderTopWidth: 2,
        height: 9,
        transform: [{ rotate: '45deg' }],
        width: 9,
      }}
    />
  );
}

/**
 * The workhorse row: icon or avatar, a title, an optional second line and a
 * trailing slot.
 *
 * Rows are 60pt tall minimum, so a list of five is still easy to hit with a
 * thumb. A pressable row is one accessibility element — a screen reader says
 * the title and the subtitle together, not two fragments.
 */
export function ListRow({
  title,
  subtitle,
  icon: Icon,
  avatarName,
  trailing,
  onPress,
  accessibilityHint,
  showChevron,
  divider = false,
  testID,
}: ListRowProps) {
  const theme = useTheme();
  const { focusHandlers, focusRingStyle } = useFocusRing();

  const pressable = typeof onPress === 'function';
  const chevron = showChevron ?? pressable;

  const body = (
    <>
      {Icon ? (
        <View
          accessible={false}
          style={{
            alignItems: 'center',
            backgroundColor: theme.colors.brandSoft,
            borderRadius: theme.radius.field,
            height: theme.layout.controlHeight.small,
            justifyContent: 'center',
            width: theme.layout.controlHeight.small,
          }}
        >
          <Icon color={theme.colors.brand} size={22} strokeWidth={2} />
        </View>
      ) : avatarName ? (
        <Avatar name={avatarName} size="small" />
      ) : null}

      <View style={{ flex: 1, gap: theme.space['2xs'] }}>
        <Text variant="bodyStrong" numberOfLines={2}>
          {title}
        </Text>
        {subtitle ? (
          <Text variant="caption" tone="secondary" numberOfLines={2}>
            {subtitle}
          </Text>
        ) : null}
      </View>

      {trailing ? <View style={{ alignItems: 'flex-end' }}>{trailing}</View> : null}
      {chevron && !trailing ? <Chevron color={theme.colors.textTertiary} /> : null}
    </>
  );

  const rowStyle = [
    styles.row,
    {
      borderTopColor: theme.colors.border,
      borderTopWidth: divider ? StyleSheet.hairlineWidth : 0,
      gap: theme.space.sm,
      minHeight: theme.layout.controlHeight.large,
      paddingVertical: theme.space.xs,
      paddingHorizontal: theme.space.xs,
    },
  ];

  if (!pressable) {
    return (
      <View
        accessible
        accessibilityLabel={subtitle ? `${title}. ${subtitle}` : title}
        style={rowStyle}
        testID={testID}
      >
        {body}
      </View>
    );
  }

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={subtitle ? `${title}. ${subtitle}` : title}
      accessibilityHint={accessibilityHint}
      onPress={onPress}
      testID={testID}
      {...focusHandlers}
      style={({ pressed }) => [
        ...rowStyle,
        {
          backgroundColor: pressed ? theme.colors.surfaceSunken : 'transparent',
          borderRadius: theme.radius.field,
          opacity: pressed ? 0.9 : 1,
        },
        focusRingStyle,
      ]}
    >
      {body}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    alignItems: 'center',
    flexDirection: 'row',
  },
});
