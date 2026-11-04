import { Pressable, View } from 'react-native';

import { useTheme } from '../ThemeProvider';
import type { IconComponent } from '../primitives';
import { Text } from './Text';

export interface SegmentedOption<T extends string> {
  readonly value: T;
  readonly label: string;
  readonly icon?: IconComponent;
}

export interface SegmentedControlProps<T extends string> {
  /** Two to four options. Beyond four, use a list of rows instead. */
  readonly options: ReadonlyArray<SegmentedOption<T>>;
  readonly value: T;
  readonly onChange: (value: T) => void;
  /** Spoken name for the group, e.g. "Which circle". */
  readonly accessibilityLabel: string;
  readonly testID?: string;
}

/**
 * A small set of mutually exclusive choices: this week / this month, or which
 * circle you are looking at.
 *
 * Every segment is 48pt tall and 44 wide, the selected one is a raised card on a
 * sunken track, and each segment announces itself as a radio button — so the
 * choice is clear without seeing the tint.
 */
export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  accessibilityLabel,
  testID,
}: SegmentedControlProps<T>) {
  const theme = useTheme();

  return (
    <View
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="radiogroup"
      testID={testID}
      style={{
        backgroundColor: theme.colors.surfaceSunken,
        borderRadius: theme.radius.field,
        flexDirection: 'row',
        gap: theme.space['2xs'],
        padding: theme.space['2xs'],
      }}
    >
      {options.map((option) => {
        const selected = option.value === value;
        const Icon = option.icon;

        return (
          <Pressable
            key={option.value}
            accessibilityLabel={option.label}
            accessibilityRole="radio"
            accessibilityState={{ checked: selected }}
            onPress={() => {
              if (!selected) {
                onChange(option.value);
              }
            }}
            style={({ pressed }) => ({
              alignItems: 'center',
              backgroundColor: selected ? theme.colors.surface : 'transparent',
              borderRadius: theme.radius.field,
              flex: 1,
              flexDirection: 'row',
              gap: theme.space['2xs'],
              justifyContent: 'center',
              minHeight: theme.layout.minTapTarget,
              opacity: pressed && !selected ? 0.75 : 1,
              paddingHorizontal: theme.space.xs,
            })}
          >
            {Icon ? (
              <View accessible={false}>
                <Icon
                  color={selected ? theme.colors.brand : theme.colors.textSecondary}
                  size={18}
                  strokeWidth={2}
                />
              </View>
            ) : null}
            <Text
              numberOfLines={1}
              tone={selected ? 'brand' : 'secondary'}
              variant={selected ? 'bodyStrong' : 'body'}
            >
              {option.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
