import { View } from 'react-native';

import { Text, useTheme } from '@tendshare/ui';

export type NoticeTone = 'info' | 'warning' | 'danger' | 'success';

export interface OnboardingNoticeProps {
  readonly title: string;
  readonly message: string;
  readonly tone?: NoticeTone;
  readonly testID?: string;
}

/**
 * One calm sentence block: what is going on, and what to do about it.
 *
 * Built from the theme's soft background / strong foreground pairs so it reads
 * in both schemes, and marked by a leading word as well as a tint — colour is
 * never the only signal. The whole block is one accessibility element, so a
 * screen reader says the title and the sentence together instead of stopping on
 * a decorative heading.
 */
export function OnboardingNotice({ title, message, tone = 'info', testID }: OnboardingNoticeProps) {
  const theme = useTheme();

  const palette = {
    // The info border used to be full-strength `brand`, which in dark mode made
    // a quiet explanatory note louder than the primary button beside it. A
    // hairline is the right weight for "here is how it works".
    info: { bg: theme.colors.brandSoft, fg: theme.colors.brandSoftFg, border: theme.colors.border },
    warning: {
      bg: theme.colors.warningSoft,
      fg: theme.colors.warningSoftFg,
      border: theme.colors.warning,
    },
    danger: {
      bg: theme.colors.dangerSoft,
      fg: theme.colors.dangerSoftFg,
      border: theme.colors.danger,
    },
    success: {
      bg: theme.colors.successSoft,
      fg: theme.colors.successSoftFg,
      border: theme.colors.success,
    },
  }[tone];

  return (
    <View
      accessible
      accessibilityLabel={`${title}. ${message}`}
      testID={testID}
      style={{
        backgroundColor: palette.bg,
        borderColor: palette.border,
        borderRadius: theme.radius.field,
        borderWidth: 1,
        gap: theme.space['2xs'],
        padding: theme.space.sm,
      }}
    >
      <Text style={{ color: palette.fg }} variant="bodyStrong">
        {title}
      </Text>
      {/*
        The body is the sentence you actually read, so it is body text at 17px
        and coloured from the notice's own tone. It used to be a 15px caption in
        the page's grey, which put grey-green copy under a red title.
      */}
      <Text style={{ color: palette.fg }} variant="body">
        {message}
      </Text>
    </View>
  );
}
