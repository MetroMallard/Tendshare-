import { Image, View } from 'react-native';

import { useTheme } from '../ThemeProvider';
import { initialsOf } from './initials';
import { Text } from './Text';

export type AvatarSize = 'small' | 'medium' | 'large';

const DIAMETER: Readonly<Record<AvatarSize, number>> = {
  small: 44,
  medium: 56,
  large: 72,
};

/**
 * Pick one of the soft tints from the name, so the same person is the same
 * colour on every screen without anybody choosing a colour.
 *
 * Amber used to be one of them. In a health app an amber circle reads as an
 * attention state — "something is wrong with this person" — which is not
 * something an identity colour may ever mean. No status colour is in the list.
 */
function toneIndex(name: string): number {
  let hash = 0;

  for (let index = 0; index < name.length; index += 1) {
    hash = (hash + name.charCodeAt(index) * (index + 1)) % 9973;
  }

  return hash % 4;
}

export interface AvatarProps {
  /** Used for the initials and the tint. Nothing is fetched. */
  readonly name: string;
  readonly size?: AvatarSize;
  /**
   * A photo to show instead of the initials.
   *
   * A **signed URL with a short expiry** — never a public link, never a stored
   * URL. The component fetches nothing and knows nothing about buckets: when the
   * URL is missing or stale the initials are the fallback, so a photo that
   * cannot load leaves a person on screen rather than a broken image.
   */
  readonly uri?: string | null;
  /** Overrides the spoken name when the row already says it. */
  readonly accessibilityLabel?: string;
  readonly testID?: string;
}

/** A person: their photo when there is one, initials on a soft tint when not. */
export function Avatar({ name, size = 'medium', uri, accessibilityLabel, testID }: AvatarProps) {
  const theme = useTheme();

  const tints = [
    { bg: theme.colors.brandSoft, fg: theme.colors.brandSoftFg },
    { bg: theme.colors.accentSoft, fg: theme.colors.accentSoftFg },
    { bg: theme.colors.successSoft, fg: theme.colors.successSoftFg },
    { bg: theme.colors.surfaceSunken, fg: theme.colors.textSecondary },
  ];

  const tint = tints[toneIndex(name)] ?? tints[0];
  const diameter = DIAMETER[size];
  const initials = initialsOf(name);

  if (typeof uri === 'string' && uri.length > 0) {
    return (
      <Image
        accessibilityLabel={accessibilityLabel ?? name}
        accessible
        source={{ uri }}
        testID={testID}
        style={{
          backgroundColor: theme.colors.surfaceSunken,
          borderColor: theme.colors.border,
          borderRadius: theme.radius.pill,
          borderWidth: 1,
          height: diameter,
          width: diameter,
        }}
      />
    );
  }

  return (
    <View
      accessible
      accessibilityLabel={accessibilityLabel ?? (initials.length > 0 ? name : 'No name yet')}
      testID={testID}
      style={{
        alignItems: 'center',
        backgroundColor: initials.length > 0 ? tint?.bg : theme.colors.surfaceSunken,
        borderRadius: theme.radius.pill,
        height: diameter,
        justifyContent: 'center',
        width: diameter,
      }}
    >
      {initials.length > 0 ? (
        <Text
          variant={size === 'large' ? 'heading' : size === 'medium' ? 'subheading' : 'bodyStrong'}
          style={{ color: tint?.fg }}
        >
          {initials}
        </Text>
      ) : (
        /*
          A person glyph, not a question mark. Somebody who has not typed their
          name yet gets a calm silhouette on a neutral well; a "?" in a 72pt
          circle reads as a broken screen.
        */
        <View accessible={false} style={{ alignItems: 'center', justifyContent: 'center' }}>
          <View
            style={{
              backgroundColor: theme.colors.textTertiary,
              borderRadius: theme.radius.pill,
              height: Math.round(diameter * 0.26),
              width: Math.round(diameter * 0.26),
            }}
          />
          <View
            style={{
              backgroundColor: theme.colors.textTertiary,
              borderTopLeftRadius: theme.radius.pill,
              borderTopRightRadius: theme.radius.pill,
              height: Math.round(diameter * 0.22),
              marginTop: Math.round(diameter * 0.04),
              width: Math.round(diameter * 0.48),
            }}
          />
        </View>
      )}
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
