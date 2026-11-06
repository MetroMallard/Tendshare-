import type { ReactNode } from 'react';
import { Pressable, View } from 'react-native';

import { useTheme } from '../ThemeProvider';
import { useFocusRing } from '../primitives';
import { Text } from './Text';

export interface ScreenHeaderProps {
  /** Small all-caps line above the title: "Thursday, November 5". */
  readonly eyebrow?: string;
  readonly title: string;
  readonly subtitle?: string;
  /** Shows a 48pt back target with a spoken label. */
  readonly onBack?: () => void;
  readonly backLabel?: string;
  /** A slot for one icon button or a pill, top right. */
  readonly action?: ReactNode;
  /** Applied to the title, so QA and tests can find the screen. */
  readonly titleTestID?: string;
}

/** A chevron pointing back, drawn from the text colour token. */
function BackChevron({ color }: { color: string }) {
  return (
    <View
      style={{
        borderColor: color,
        borderLeftWidth: 2,
        borderTopWidth: 2,
        height: 10,
        transform: [{ rotate: '-45deg' }],
        width: 10,
      }}
    />
  );
}

/**
 * The top of every screen: optional eyebrow, one title, one supporting line.
 *
 * The title is a header for screen readers, so "jump to heading" lands on the
 * name of the screen instead of on a decorative label above it.
 */
export function ScreenHeader({
  eyebrow,
  title,
  subtitle,
  onBack,
  backLabel = 'Back',
  action,
  titleTestID,
}: ScreenHeaderProps) {
  const theme = useTheme();
  const { focusHandlers, focusRingStyle } = useFocusRing();

  return (
    <View style={{ gap: theme.space.xs, marginBottom: theme.space.md }}>
      <View style={{ alignItems: 'flex-start', flexDirection: 'row', gap: theme.space.xs }}>
        <View style={{ flex: 1, gap: theme.space['2xs'] }}>
          {eyebrow ? (
            // One line, always. The eyebrow is context, not content: a long
            // circle name that wraps would push the whole screen down, and on a
            // phone the title is what the eye is looking for.
            <Text numberOfLines={1} tone="secondary" uppercase variant="label">
              {eyebrow}
            </Text>
          ) : null}

          <Text accessibilityRole="header" balance testID={titleTestID} variant="title">
            {title}
          </Text>
        </View>

        {action}

        {onBack ? (
          <Pressable
            accessibilityLabel={backLabel}
            accessibilityRole="button"
            onPress={onBack}
            {...focusHandlers}
            style={({ pressed }) => ({
              alignItems: 'center',
              backgroundColor: pressed ? theme.colors.surfaceSunken : 'transparent',
              borderRadius: theme.radius.pill,
              height: theme.layout.minTapTarget,
              justifyContent: 'center',
              width: theme.layout.minTapTarget,
              ...focusRingStyle,
            })}
          >
            <BackChevron color={theme.colors.textPrimary} />
          </Pressable>
        ) : null}
      </View>

      {subtitle ? (
        <Text tone="secondary" variant="body">
          {subtitle}
        </Text>
      ) : null}
    </View>
  );
}
