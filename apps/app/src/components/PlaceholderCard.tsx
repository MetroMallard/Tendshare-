import { StyleSheet, Text, View } from 'react-native';
import type { LucideIcon } from 'lucide-react-native';

import { useTheme } from '../theme';

export interface PlaceholderCardProps {
  icon: LucideIcon;
  title: string;
  body: string;
  /** Small footnote under the body, e.g. what this tab will hold. */
  note?: string;
  testID?: string;
}

/**
 * The one card every app-shell screen shows until its feature lands. It is
 * deliberately plain: no promises, no sample data, nothing that reads like
 * advice.
 */
export function PlaceholderCard({ icon: Icon, title, body, note, testID }: PlaceholderCardProps) {
  const theme = useTheme();

  return (
    <View
      testID={testID}
      style={[
        styles.card,
        {
          backgroundColor: theme.colors.surface,
          borderColor: theme.colors.border,
          borderRadius: theme.radius.md,
          padding: theme.spacing.xl,
          gap: theme.spacing.lg,
        },
      ]}
    >
      <View
        style={[
          styles.iconWell,
          { backgroundColor: theme.colors.accentSoft, borderRadius: theme.radius.pill },
        ]}
        accessible={false}
      >
        <Icon size={26} color={theme.colors.accent} strokeWidth={2} />
      </View>

      <View style={{ gap: theme.spacing.sm }}>
        <Text
          style={[
            theme.typography.bodyStrong,
            { color: theme.colors.text, fontSize: 20, lineHeight: 27 },
          ]}
          accessibilityRole="header"
        >
          {title}
        </Text>
        <Text style={[theme.typography.body, { color: theme.colors.textMuted }]}>{body}</Text>
      </View>

      {note ? (
        <Text
          style={[
            theme.typography.caption,
            { color: theme.colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.6 },
          ]}
        >
          {note}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: StyleSheet.hairlineWidth,
  },
  iconWell: {
    width: 52,
    height: 52,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
