import { Pressable, View } from 'react-native';

import { useTheme } from '../ThemeProvider';
import { useFocusRing } from '../primitives';
import { Text } from './Text';

export interface SwitchProps {
  readonly label: string;
  readonly description?: string;
  readonly value: boolean;
  readonly onValueChange: (value: boolean) => void;
  readonly disabled?: boolean;
  readonly testID?: string;
}

/**
 * An on/off setting.
 *
 * Built rather than borrowed: the platform switch is 30pt tall, tinted by the OS
 * and announced differently on every platform. This one is a 52pt row with the
 * whole row tappable, a token-coloured track and an explicit on/off state for
 * screen readers.
 */
export function Switch({
  label,
  description,
  value,
  onValueChange,
  disabled = false,
  testID,
}: SwitchProps) {
  const theme = useTheme();
  const { focusHandlers, focusRingStyle } = useFocusRing();

  const trackWidth = theme.space.xl + theme.space.xs;
  const thumbSize = theme.space.md + theme.space.xs;

  return (
    <Pressable
      accessibilityLabel={label}
      accessibilityHint={description}
      accessibilityRole="switch"
      accessibilityState={{ checked: value, disabled }}
      disabled={disabled}
      onPress={() => {
        onValueChange(!value);
      }}
      testID={testID}
      {...focusHandlers}
      style={({ pressed }) => ({
        alignItems: 'center',
        borderRadius: theme.radius.field,
        flexDirection: 'row',
        gap: theme.space.sm,
        justifyContent: 'space-between',
        minHeight: theme.layout.controlHeight.large,
        // A disabled switch is a state, not a ghost: it stays at full opacity
        // (0.55 put the label near 3:1) and its track and text say "not now".
        opacity: disabled ? 1 : pressed ? 0.85 : 1,
        paddingVertical: theme.space.xs,
        ...focusRingStyle,
      })}
    >
      <View style={{ flex: 1, gap: theme.space['2xs'] }}>
        <Text variant="bodyStrong">{label}</Text>
        {description ? (
          <Text tone="secondary" variant="caption">
            {description}
          </Text>
        ) : null}
        {/* The state in words, not just a colour: on, or off. */}
        <Text tone={value ? 'success' : 'tertiary'} variant="label">
          {value ? 'On' : 'Off'}
        </Text>
      </View>

      <View
        accessible={false}
        style={{
          alignItems: 'center',
          backgroundColor: value ? theme.colors.brand : theme.colors.surfaceSunken,
          borderColor: value ? theme.colors.brand : theme.colors.borderStrong,
          borderRadius: theme.radius.pill,
          borderWidth: 1,
          flexDirection: 'row',
          height: thumbSize + theme.space.xs,
          justifyContent: value ? 'flex-end' : 'flex-start',
          // 4pt, not 2pt: the one padding in the product that was off the grid.
          padding: theme.space['2xs'],
          width: trackWidth,
        }}
      >
        <View
          style={{
            backgroundColor: value ? theme.colors.brandFg : theme.colors.surface,
            borderRadius: theme.radius.pill,
            height: thumbSize,
            width: thumbSize,
          }}
        />
      </View>
    </Pressable>
  );
}
