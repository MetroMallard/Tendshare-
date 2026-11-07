import {
  Platform,
  Text as RNText,
  type TextProps as RNTextProps,
  type TextStyle,
} from 'react-native';

import { useTheme } from '../ThemeProvider';
import type { TextTone } from '../types';
import type { TypeVariant } from '../tokens/typography';

/**
 * `text-wrap: balance` — a CSS property React Native's types do not know about
 * yet, and one that native text layout has no equivalent for. Applied on web
 * only, where a title that wraps to "Who are you caring / for?" is a real thing
 * an owner sees; on native the platform already balances a heading.
 */
const WEB_BALANCE = { textWrap: 'balance' } as unknown as TextStyle;

export interface TextProps extends RNTextProps {
  /** Type scale step. There is no default size — every text names its role. */
  readonly variant?: TypeVariant;
  readonly tone?: TextTone;
  readonly align?: 'left' | 'center' | 'right';
  /** All-caps eyebrow. Applied by the token, not typed in the copy. */
  readonly uppercase?: boolean;
  /**
   * Even out the line lengths instead of filling each line to the last word.
   *
   * For a title or a one-sentence line that would otherwise end on an orphaned
   * word ("…caring / for?", "…for a short / while."), which reads as a mistake.
   */
  readonly balance?: boolean;
}

/**
 * The only text primitive in the product.
 *
 * Everything renderable as words goes through it, so the type scale is applied
 * in one place and no screen can invent a size, a colour or a font family.
 */
export function Text({
  variant = 'body',
  tone = 'primary',
  align,
  uppercase = false,
  balance = false,
  style,
  ...rest
}: TextProps) {
  const theme = useTheme();

  const color = {
    primary: theme.colors.textPrimary,
    secondary: theme.colors.textSecondary,
    tertiary: theme.colors.textTertiary,
    inverse: theme.colors.textInverse,
    brand: theme.colors.brand,
    accent: theme.colors.accent,
    success: theme.colors.success,
    warning: theme.colors.warning,
    danger: theme.colors.danger,
  }[tone];

  return (
    <RNText
      {...rest}
      style={[
        theme.typography[variant],
        Platform.OS === 'web' ? { fontFamily: theme.fontFamily.web } : null,
        { color },
        align ? { textAlign: align } : null,
        uppercase ? { textTransform: 'uppercase' } : null,
        balance && Platform.OS === 'web' ? WEB_BALANCE : null,
        style,
      ]}
    />
  );
}
