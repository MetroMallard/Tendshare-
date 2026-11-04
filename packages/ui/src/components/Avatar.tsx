import { View } from 'react-native';

import { useTheme } from '../ThemeProvider';
import { Text } from './Text';

export type AvatarSize = 'small' | 'medium' | 'large';

const DIAMETER: Readonly<Record<AvatarSize, number>> = {
  small: 44,
  medium: 56,
  large: 72,
};

/** First letter of the first and last word: "Margaret Chen" -> "MC". */
export function initialsOf(name: string): string {
  const words = name
    .trim()
    .split(/\s+/)
    .filter((word) => word.length > 0);

  const first = words[0]?.[0] ?? '?';
  const last = words.length > 1 ? (words[words.length - 1]?.[0] ?? '') : '';

  return `${first}${last}`.toUpperCase();
}

/**
 * Pick one of the five soft tints from the name, so the same person is the same
 * colour on every screen without anybody choosing a colour.
 */
function toneIndex(name: string): number {
  let hash = 0;

  for (let index = 0; index < name.length; index += 1) {
    hash = (hash + name.charCodeAt(index) * (index + 1)) % 9973;
  }

  return hash % 5;
}

export interface AvatarProps {
  /** Used for the initials and the tint. Nothing is fetched. */
  readonly name: string;
  readonly size?: AvatarSize;
  readonly testID?: string;
}

/** A person, as initials on a soft tint. No photos to upload, no image calls. */
export function Avatar({ name, size = 'medium', testID }: AvatarProps) {
  const theme = useTheme();

  const tints = [
    { bg: theme.colors.brandSoft, fg: theme.colors.brandSoftFg },
    { bg: theme.colors.accentSoft, fg: theme.colors.accentSoftFg },
    { bg: theme.colors.successSoft, fg: theme.colors.successSoftFg },
    { bg: theme.colors.warningSoft, fg: theme.colors.warningSoftFg },
    { bg: theme.colors.surfaceSunken, fg: theme.colors.textSecondary },
  ];

  const tint = tints[toneIndex(name)] ?? tints[0];

  return (
    <View
      accessible
      accessibilityLabel={name}
      testID={testID}
      style={{
        alignItems: 'center',
        backgroundColor: tint?.bg,
        borderRadius: theme.radius.pill,
        height: DIAMETER[size],
        justifyContent: 'center',
        width: DIAMETER[size],
      }}
    >
      <Text
        variant={size === 'large' ? 'heading' : size === 'medium' ? 'subheading' : 'bodyStrong'}
        style={{ color: tint?.fg }}
      >
        {initialsOf(name)}
      </Text>
    </View>
  );
}

export interface AvatarStackProps {
  readonly names: readonly string[];
  /** Beyond this, the overflow becomes a "+3" chip. */
  readonly max?: number;
  readonly size?: AvatarSize;
  readonly testID?: string;
}

/** Who is in this circle, at a glance. Overlaps to a maximum of five. */
export function AvatarStack({ names, max = 4, size = 'small', testID }: AvatarStackProps) {
  const theme = useTheme();
  const visible = names.slice(0, max);
  const overflow = names.length - visible.length;
  const diameter = DIAMETER[size];

  return (
    <View
      accessible
      accessibilityLabel={names.join(', ')}
      testID={testID}
      style={{ flexDirection: 'row', paddingLeft: theme.space['2xs'] }}
    >
      {visible.map((name, index) => (
        <View
          key={`${name}-${String(index)}`}
          style={{
            borderColor: theme.colors.surface,
            borderRadius: theme.radius.pill,
            borderWidth: 2,
            marginLeft: -theme.space.xs,
          }}
        >
          <Avatar name={name} size={size} />
        </View>
      ))}

      {overflow > 0 ? (
        <View
          style={{
            alignItems: 'center',
            backgroundColor: theme.colors.surfaceSunken,
            borderColor: theme.colors.surface,
            borderRadius: theme.radius.pill,
            borderWidth: 2,
            height: diameter,
            justifyContent: 'center',
            marginLeft: -theme.space.xs,
            width: diameter,
          }}
        >
          <Text variant="label" tone="secondary">
            +{overflow}
          </Text>
        </View>
      ) : null}
    </View>
  );
}
