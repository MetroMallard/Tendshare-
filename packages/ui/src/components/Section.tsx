import type { ReactNode } from 'react';
import { View } from 'react-native';

import { useTheme } from '../ThemeProvider';
import { Text } from './Text';

export interface SectionProps {
  readonly title: string;
  /** One line of explanation under the heading. */
  readonly description?: string;
  readonly children: ReactNode;
  readonly testID?: string;
}

/**
 * A titled block of a screen: heading, optional one-liner, then the content.
 *
 * Sections are what keep a long screen readable — the gallery is built out of
 * them, and so are the profile and settings screens that come later.
 *
 * A Section owns the rhythm *inside* itself and nothing outside it. It used to
 * carry `marginBottom: 32` while the screen around it laid its children out with
 * `gap: 24`, which put 56pt between two sections and 24pt between everything
 * else on the same screen — a screen with one odd gap in it. The parent owns the
 * space between blocks; this owns the space within one.
 */
export function Section({ title, description, children, testID }: SectionProps) {
  const theme = useTheme();

  return (
    <View testID={testID} style={{ gap: theme.space.sm }}>
      <View style={{ gap: theme.space['2xs'] }}>
        <Text accessibilityRole="header" variant="heading">
          {title}
        </Text>
        {description ? (
          <Text tone="secondary" variant="caption">
            {description}
          </Text>
        ) : null}
      </View>
      {children}
    </View>
  );
}
