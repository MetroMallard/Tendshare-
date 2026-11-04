import { Text, View } from 'react-native';
import type { LucideIcon } from 'lucide-react-native';

import { useTheme } from '../theme';
import { PlaceholderCard } from './PlaceholderCard';
import { Screen } from './Screen';

export interface PlaceholderScreenProps {
  /** Screen heading, matching the tab label. */
  title: string;
  /** One calm sentence about what this tab will hold. */
  subtitle: string;
  icon: LucideIcon;
  /** Card heading. */
  placeholderTitle: string;
  /** Card body copy. */
  placeholderBody: string;
  testID: string;
}

/**
 * Stand-in body for a tab whose feature has not been built yet. Every tab in
 * the shell renders exactly one of these — no feature logic lives here.
 */
export function PlaceholderScreen({
  title,
  subtitle,
  icon,
  placeholderTitle,
  placeholderBody,
  testID,
}: PlaceholderScreenProps) {
  const theme = useTheme();

  return (
    <Screen>
      <View style={{ gap: theme.spacing.sm, marginBottom: theme.spacing.xl }}>
        <Text
          style={[
            theme.typography.caption,
            { color: theme.colors.textMuted, textTransform: 'uppercase', letterSpacing: 1.1 },
          ]}
        >
          Tendshare
        </Text>
        <Text
          style={[theme.typography.display, { color: theme.colors.text }]}
          accessibilityRole="header"
          testID={`${testID}-heading`}
        >
          {title}
        </Text>
        <Text style={[theme.typography.body, { color: theme.colors.textMuted }]}>{subtitle}</Text>
      </View>

      <PlaceholderCard
        icon={icon}
        title={placeholderTitle}
        body={placeholderBody}
        note="App shell · Phase 1"
        testID={`${testID}-placeholder`}
      />
    </Screen>
  );
}
