/**
 * The tick control — the one thing a family touches most.
 *
 * It is deliberately not a small checkbox. The people using this app are 40–65,
 * often reading in a corridor with one hand, and a dose that is not ticked is a
 * phone call at nine at night. So it is a full-width-ish target at the 48pt
 * floor, it says what it will do in words as well as colour, and when a dose is
 * ticked it never becomes a bare checkmark: the row beneath it says who ticked it
 * and when, and the screen reader says the same thing.
 *
 * Built from `@tendshare/ui`'s theme tokens and `Text` — no hex, no font size and
 * no magic padding lives here.
 */
import { Pressable, View } from 'react-native';

import { Text, useTheme } from '@tendshare/ui';

export interface TickButtonProps {
  /** Ticked, open, or the whole control is unavailable (offline, read-only). */
  readonly state: 'open' | 'ticked';
  readonly disabled: boolean;
  /** The whole fact, from `tickAccessibilityLabel()`. */
  readonly accessibilityLabel: string;
  readonly accessibilityHint: string;
  readonly onPress: () => void;
  readonly testID?: string;
}

/** A dependency-free tick, drawn from the theme's colours. */
function Tick({ color, size }: { readonly color: string; readonly size: number }) {
  return (
    <View
      style={{
        borderBottomWidth: Math.max(2, Math.round(size / 6)),
        borderColor: color,
        borderRightWidth: Math.max(2, Math.round(size / 6)),
        height: size * 0.5,
        marginBottom: size * 0.15,
        transform: [{ rotate: '45deg' }],
        width: size * 0.28,
      }}
    />
  );
}

/**
 * The tick, with its state spoken and its state written.
 *
 * A ticked dose is tinted with the success pair and labelled "Ticked"; an open
 * one is a brand outline labelled "Tick". Both are words, so the difference
 * survives a greyscale screen, a colour-blind eye and a screen reader.
 */
export function TickButton({
  state,
  disabled,
  accessibilityLabel,
  accessibilityHint,
  onPress,
  testID,
}: TickButtonProps) {
  const theme = useTheme();
  const ticked = state === 'ticked';

  const fg = disabled
    ? theme.colors.textTertiary
    : ticked
      ? theme.colors.successSoftFg
      : theme.colors.brand;

  return (
    <Pressable
      accessibilityHint={accessibilityHint}
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="button"
      accessibilityState={{ checked: ticked, disabled }}
      disabled={disabled}
      onPress={onPress}
      style={{
        alignItems: 'center',
        backgroundColor: ticked ? theme.colors.successSoft : theme.colors.surface,
        borderColor: disabled
          ? theme.colors.border
          : ticked
            ? theme.colors.successSoftFg
            : theme.colors.borderStrong,
        borderRadius: theme.radius.field,
        borderWidth: 1.5,
        flexDirection: 'row',
        gap: theme.space['2xs'],
        justifyContent: 'center',
        minHeight: theme.layout.minTapTarget,
        minWidth: theme.layout.minTapTarget * 1.6,
        opacity: disabled ? 0.6 : 1,
        paddingHorizontal: theme.space.xs,
        paddingVertical: theme.space['2xs'],
      }}
      testID={testID}
    >
      {ticked ? <Tick color={fg} size={18} /> : null}
      <Text style={{ color: fg }} variant="bodyStrong">
        {ticked ? 'Ticked' : 'Tick'}
      </Text>
    </Pressable>
  );
}
