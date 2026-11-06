import { Pressable, View } from 'react-native';

import { useTheme } from '../ThemeProvider';
import { useFocusRing } from '../primitives';
import { listRowAccessibilityLabel } from './listRowLabel';
import { Text } from './Text';

export interface OptionListOption<T extends string> {
  readonly value: T;
  readonly label: string;
  /** One line under the label, when the choice needs explaining. */
  readonly description?: string;
}

export interface OptionListProps<T extends string> {
  /** Two or more options. Beyond four or five, this is the control to use. */
  readonly options: ReadonlyArray<OptionListOption<T>>;
  readonly value: T | null;
  readonly onChange: (value: T) => void;
  /** Spoken name for the group, e.g. "How are they related to you?". */
  readonly accessibilityLabel: string;
  readonly testID?: string;
}

/**
 * A short list of mutually exclusive choices, one per row.
 *
 * `SegmentedControl` is right for two to four short words. This is the same
 * question when the words are longer or there are five of them — "Mother,
 * Father, Partner, Grandparent, Other" does not fit across a 390px phone, and
 * truncating "Grandparent" to "Grand…" is how a calm screen becomes a puzzle.
 *
 * Each row is a radio button: 60pt tall, announced as checked or not, and marked
 * by a filled ring as well as a tint, so the choice is legible without seeing
 * the colour.
 */
export function OptionList<T extends string>({
  options,
  value,
  onChange,
  accessibilityLabel,
  testID,
}: OptionListProps<T>) {
  return (
    <View accessibilityLabel={accessibilityLabel} accessibilityRole="radiogroup" testID={testID}>
      {options.map((option, index) => (
        <OptionRow
          key={option.value}
          description={option.description}
          divider={index > 0}
          label={option.label}
          onPress={() => {
            onChange(option.value);
          }}
          selected={option.value === value}
          testID={testID ? `${testID}-${option.value}` : undefined}
          value={option.value}
        />
      ))}
    </View>
  );
}

interface OptionRowProps {
  readonly value: string;
  readonly label: string;
  readonly description?: string;
  readonly selected: boolean;
  readonly divider: boolean;
  readonly onPress: () => void;
  readonly testID?: string;
}

function OptionRow({
  value,
  label,
  description,
  selected,
  divider,
  onPress,
  testID,
}: OptionRowProps) {
  const theme = useTheme();
  const { focusHandlers, focusRingStyle } = useFocusRing();

  return (
    <Pressable
      /*
        The description is visible, so it has to be spoken. "Takes part in
        care: medications…" is the part that tells you what you are choosing —
        a radio announced only as "Family member" makes the person guess.
      */
      accessibilityLabel={listRowAccessibilityLabel({ title: label, subtitle: description })}
      accessibilityRole="radio"
      accessibilityState={{ checked: selected }}
      onPress={onPress}
      testID={testID ?? `option-${value}`}
      {...focusHandlers}
      style={({ pressed }) => ({
        alignItems: 'center',
        backgroundColor: selected
          ? theme.colors.brandSoft
          : pressed
            ? theme.colors.surfaceSunken
            : theme.colors.surface,
        borderColor: selected ? theme.colors.brand : theme.colors.border,
        borderRadius: theme.radius.field,
        borderWidth: 1,
        flexDirection: 'row',
        gap: theme.space.sm,
        marginTop: divider ? theme.space['2xs'] : 0,
        minHeight: theme.layout.controlHeight.medium,
        paddingHorizontal: theme.space.sm,
        paddingVertical: theme.space.xs,
        ...focusRingStyle,
      })}
    >
      <View
        accessible={false}
        style={{
          alignItems: 'center',
          /*
            The ring is the only thing marking "not chosen", so it is a non-text
            signal and owes WCAG 3:1. `borderStrong` was 1.7:1 in light and
            1.9:1 in dark — an empty circle you had to squint at. Tertiary text
            is 4.6:1 or better in both schemes.
          */
          borderColor: selected ? theme.colors.brand : theme.colors.textTertiary,
          borderRadius: theme.radius.pill,
          borderWidth: 2,
          height: 22,
          justifyContent: 'center',
          width: 22,
        }}
      >
        {selected ? (
          <View
            style={{
              backgroundColor: theme.colors.brand,
              borderRadius: theme.radius.pill,
              height: 10,
              width: 10,
            }}
          />
        ) : null}
      </View>

      <View style={{ flex: 1, gap: theme.space['2xs'] }}>
        <Text tone={selected ? 'brand' : 'primary'} variant={selected ? 'bodyStrong' : 'body'}>
          {label}
        </Text>
        {description ? (
          <Text tone="secondary" variant="caption">
            {description}
          </Text>
        ) : null}
      </View>
    </Pressable>
  );
}
