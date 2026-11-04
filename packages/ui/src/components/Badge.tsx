import { View } from 'react-native';

import { useTheme } from '../ThemeProvider';
import { statusColors, type StatusTone } from '../tokens/colors';
import type { IconComponent } from '../primitives';
import { Text } from './Text';

/**
 * A glyph per status tone, drawn from characters rather than an icon font so the
 * design system stays dependency-free and the glyph always inherits the tone.
 *
 * The glyph is decoration on purpose: the visible label is what carries the
 * meaning, so a colour-blind reader loses nothing.
 */
const GLYPH: Readonly<Record<Exclude<StatusTone, 'neutral' | 'brand' | 'accent'>, string>> = {
  success: '\u2713',
  warning: '!',
  danger: '\u00D7',
};

const DOT_TONES: ReadonlyArray<StatusTone> = ['neutral', 'brand', 'accent'];

function StatusGlyph({ tone, color }: { tone: StatusTone; color: string }) {
  const isDot = DOT_TONES.includes(tone);

  return (
    <View
      accessible={false}
      style={{
        alignItems: 'center',
        backgroundColor: isDot ? color : 'transparent',
        borderColor: color,
        borderRadius: 8,
        borderWidth: isDot ? 0 : 1.5,
        height: isDot ? 8 : 16,
        justifyContent: 'center',
        width: isDot ? 8 : 16,
      }}
    >
      {isDot ? null : (
        <Text
          style={{
            color,
            fontSize: 11,
            fontWeight: '700',
            lineHeight: 14,
          }}
        >
          {GLYPH[tone as keyof typeof GLYPH]}
        </Text>
      )}
    </View>
  );
}

export interface BadgeProps {
  readonly label: string;
  readonly tone?: StatusTone;
  /** Override the built-in glyph with a real icon. */
  readonly icon?: IconComponent;
  readonly testID?: string;
}

/**
 * A small soft-toned label: "Given", "2 to claim", "Family plan".
 * Text first, tint second — a badge always reads as words.
 */
export function Badge({ label, tone = 'neutral', icon: Icon, testID }: BadgeProps) {
  const theme = useTheme();
  const { bg, fg } = statusColors(theme.colors, tone);

  return (
    <View
      accessible
      accessibilityLabel={label}
      testID={testID}
      style={{
        alignItems: 'center',
        alignSelf: 'flex-start',
        backgroundColor: bg,
        borderRadius: theme.radius.pill,
        flexDirection: 'row',
        gap: theme.space['2xs'],
        paddingHorizontal: theme.space.xs,
        paddingVertical: theme.space['2xs'],
      }}
    >
      {Icon ? (
        <View accessible={false}>
          <Icon color={fg} size={14} strokeWidth={2.5} />
        </View>
      ) : null}
      <Text variant="label" style={{ color: fg }}>
        {label}
      </Text>
    </View>
  );
}

export interface StatusPillProps {
  /** The status itself. Picks the tint and the glyph. */
  readonly status: Exclude<StatusTone, 'brand' | 'accent'>;
  /** Always visible. Status is never conveyed by colour alone. */
  readonly label: string;
  readonly testID?: string;
}

/**
 * A status, stated three ways: a glyph, a tint and a word. The word is
 * required, so "missed" can never be a red dot with no explanation.
 */
export function StatusPill({ status, label, testID }: StatusPillProps) {
  const theme = useTheme();
  const { bg, fg } = statusColors(theme.colors, status);

  return (
    <View
      accessible
      accessibilityLabel={label}
      testID={testID}
      style={{
        alignItems: 'center',
        alignSelf: 'flex-start',
        backgroundColor: bg,
        borderRadius: theme.radius.pill,
        flexDirection: 'row',
        gap: theme.space['2xs'],
        paddingHorizontal: theme.space.xs,
        paddingVertical: theme.space['2xs'],
      }}
    >
      <StatusGlyph color={fg} tone={status} />
      <Text variant="label" style={{ color: fg }}>
        {label}
      </Text>
    </View>
  );
}
