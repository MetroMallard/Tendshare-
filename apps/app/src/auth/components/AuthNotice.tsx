import type { ReactNode } from 'react';
import { View } from 'react-native';

import { Text, useTheme } from '@tendshare/ui';

export type NoticeTone = 'info' | 'warning' | 'danger';

export interface AuthNoticeProps {
  readonly tone?: NoticeTone;
  readonly title: string;
  readonly message: string;
  readonly testID?: string;
  /** An action that belongs with the notice, e.g. "Try again". */
  readonly action?: ReactNode;
}

/**
 * One calm block for anything the person needs to read: a failed code, a
 * provider that is not switched on, a lost connection.
 *
 * It is announced by a screen reader when it appears (`role="alert"`), it never
 * contains an error code or a stack trace, and its heading is a sentence, not a
 * label — "That code didn't work", not "Error".
 */
export function AuthNotice({ tone = 'info', title, message, testID, action }: AuthNoticeProps) {
  const theme = useTheme();

  const palette = {
    info: { background: theme.colors.brandSoft, foreground: theme.colors.brandSoftFg },
    warning: { background: theme.colors.warningSoft, foreground: theme.colors.warningSoftFg },
    danger: { background: theme.colors.dangerSoft, foreground: theme.colors.dangerSoftFg },
  }[tone];

  return (
    <View
      accessibilityLiveRegion="polite"
      accessible
      accessibilityLabel={`${title}. ${message}`}
      testID={testID}
      style={{
        backgroundColor: palette.background,
        borderRadius: theme.radius.card,
        gap: theme.space['2xs'],
        padding: theme.space.sm,
      }}
    >
      <Text style={{ color: palette.foreground }} variant="bodyStrong">
        {title}
      </Text>
      <Text style={{ color: palette.foreground }} variant="caption">
        {message}
      </Text>
      {action}
    </View>
  );
}
