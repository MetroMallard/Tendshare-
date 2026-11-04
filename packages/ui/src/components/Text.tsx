import { Platform, Text as RNText, type TextProps as RNTextProps } from 'react-native';

import { useTheme } from '../ThemeProvider';
import type { TextTone } from '../types';
import type { TypeVariant } from '../tokens/typography';

export interface TextProps extends RNTextProps {
  /** Type scale step. There is no default size — every text names its role. */
  readonly variant?: TypeVariant;
  readonly tone?: TextTone;
  readonly align?: 'left' | 'center' | 'right';
  /** All-caps eyebrow. Applied by the token, not typed in the copy. */
  readonly uppercase?: boolean;
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
        style,
      ]}
    />
  );
}
