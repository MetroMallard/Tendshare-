import type { PropsWithChildren, ReactNode } from 'react';
import { View, type StyleProp, type ViewStyle } from 'react-native';

import { useTheme } from '../ThemeProvider';
import type { SpaceKey } from '../tokens/space';
import type { SurfaceTone } from '../types';
import { Text } from './Text';

export interface CardProps {
  readonly tone?: SurfaceTone;
  readonly padding?: SpaceKey;
  /** A card sits flat in a list, or rests on the page with one soft shadow. */
  readonly elevation?: 'none' | 'card';
  readonly title?: string;
  readonly subtitle?: string;
  /** Actions, a pill or a link at the top right of the card. */
  readonly action?: ReactNode;
  readonly style?: StyleProp<ViewStyle>;
  readonly accessibilityLabel?: string;
  readonly testID?: string;
}

/**
 * The surface everything in Tendshare is made of: white paper, a 16pt corner,
 * a hairline border and (at most) one soft shadow. Cards group one thought —
 * never two.
 */
export function Card({
  children,
  tone = 'surface',
  padding = 'md',
  elevation = 'card',
  title,
  subtitle,
  action,
  style,
  accessibilityLabel,
  testID,
}: PropsWithChildren<CardProps>) {
  const theme = useTheme();

  const background = {
    surface: theme.colors.surface,
    raised: theme.colors.surfaceRaised,
    sunken: theme.colors.surfaceSunken,
    muted: theme.colors.surfaceMuted,
    brandSoft: theme.colors.brandSoft,
    accentSoft: theme.colors.accentSoft,
  }[tone];

  return (
    <View
      accessibilityLabel={accessibilityLabel}
      testID={testID}
      style={[
        {
          backgroundColor: background,
          borderColor: theme.colors.border,
          borderRadius: theme.radius.card,
          borderWidth: 1,
          gap: theme.space.sm,
          padding: theme.space[padding],
        },
        theme.elevation[elevation],
        style,
      ]}
    >
      {title || action ? (
        <View
          style={{
            alignItems: 'flex-start',
            flexDirection: 'row',
            gap: theme.space.xs,
            justifyContent: 'space-between',
          }}
        >
          <View style={{ flexShrink: 1, gap: theme.space['2xs'] }}>
            {title ? (
              <Text variant="subheading" accessibilityRole="header">
                {title}
              </Text>
            ) : null}
            {subtitle ? (
              <Text variant="caption" tone="secondary">
                {subtitle}
              </Text>
            ) : null}
          </View>
          {action}
        </View>
      ) : null}

      {children}
    </View>
  );
}
