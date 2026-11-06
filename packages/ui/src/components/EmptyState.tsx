import { View } from 'react-native';

import { useTheme } from '../ThemeProvider';
import type { IconComponent } from '../primitives';
import { Button } from './Button';
import { groupAsOneElement } from './grouping';
import { Text } from './Text';

export interface EmptyStateProps {
  /** A calm glyph, not an illustration of a problem. */
  readonly icon: IconComponent;
  readonly headline: string;
  /** One line. If it needs two, it is a paragraph and belongs elsewhere. */
  readonly body: string;
  /** The single next step. Omit only when there is genuinely nothing to do. */
  readonly actionLabel?: string;
  readonly onAction?: () => void;
  readonly testID?: string;
}

/**
 * What a screen shows before there is anything in it.
 *
 * It never scolds and never apologises: a headline, one plain sentence and one
 * obvious next step, centred with plenty of room around it.
 *
 * When there is an action, the block is *not* one accessibility element — a
 * container marked `accessible` hides everything inside it from a screen
 * reader, so "Try again" would be visible, tappable, and unreachable by
 * VoiceOver. The headline and the sentence are read as their own elements
 * instead, and the button keeps its own label.
 */
export function EmptyState({
  icon: Icon,
  headline,
  body,
  actionLabel,
  onAction,
  testID,
}: EmptyStateProps) {
  const theme = useTheme();
  const hasAction = actionLabel !== undefined && onAction !== undefined;
  const groupsAsOne = groupAsOneElement(hasAction);

  return (
    <View
      accessible={groupsAsOne}
      accessibilityLabel={groupsAsOne ? `${headline}. ${body}` : undefined}
      testID={testID}
      style={{
        alignItems: 'center',
        gap: theme.space.sm,
        paddingHorizontal: theme.space.md,
        paddingVertical: theme.space.lg,
      }}
    >
      <View
        accessible={false}
        style={{
          alignItems: 'center',
          backgroundColor: theme.colors.brandSoft,
          borderRadius: theme.radius.pill,
          height: theme.space['2xl'] + theme.space.md,
          justifyContent: 'center',
          width: theme.space['2xl'] + theme.space.md,
        }}
      >
        <Icon color={theme.colors.brand} size={28} strokeWidth={1.8} />
      </View>

      <Text align="center" variant="subheading">
        {headline}
      </Text>

      <Text align="center" tone="secondary" variant="body">
        {body}
      </Text>

      {hasAction ? (
        <View style={{ marginTop: theme.space.xs, minWidth: '60%' }}>
          <Button fullWidth label={actionLabel} onPress={onAction} size="medium" />
        </View>
      ) : null}
    </View>
  );
}
