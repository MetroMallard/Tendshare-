import { ActivityIndicator, Pressable, View, type ViewStyle } from 'react-native';

import { useTheme } from '../ThemeProvider';
import { useFocusRing, type IconComponent } from '../primitives';
import type { ControlSize } from '../types';
import { Text } from './Text';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'destructive';

export interface ButtonProps {
  /** The visible label, and the accessible name. Never icon-only without this. */
  readonly label: string;
  readonly onPress?: () => void;
  readonly variant?: ButtonVariant;
  readonly size?: ControlSize;
  /** Rendered before the label, in the button's own foreground colour. */
  readonly icon?: IconComponent;
  /** Shows a spinner and blocks presses without moving the layout. */
  readonly loading?: boolean;
  /** Spoken while loading, so a screen reader is not left on a dead button. */
  readonly loadingLabel?: string;
  readonly disabled?: boolean;
  readonly fullWidth?: boolean;
  readonly accessibilityHint?: string;
  readonly testID?: string;
}

/**
 * The product's one action control.
 *
 * Four variants, no more: `primary` is the thing to do next, `secondary` is an
 * alternative, `ghost` is an action inside a row or a header, and `destructive`
 * is the one that loses something. Every variant is at least 48pt tall, keeps a
 * visible focus ring on web, and announces its own state.
 */
export function Button({
  label,
  onPress,
  variant = 'primary',
  size = 'medium',
  icon: Icon,
  loading = false,
  loadingLabel,
  disabled = false,
  fullWidth = false,
  accessibilityHint,
  testID,
}: ButtonProps) {
  const theme = useTheme();
  const { focusHandlers, focusRingStyle } = useFocusRing();

  const inactive = disabled || loading;

  const palette = {
    primary: {
      background: theme.colors.brand,
      pressed: theme.colors.brandPressed,
      border: theme.colors.brand,
      foreground: theme.colors.brandFg,
    },
    secondary: {
      background: theme.colors.surface,
      pressed: theme.colors.brandSoft,
      border: theme.colors.borderStrong,
      foreground: theme.colors.brand,
    },
    ghost: {
      background: 'transparent',
      pressed: theme.colors.brandSoft,
      border: 'transparent',
      foreground: theme.colors.brand,
    },
    destructive: {
      background: theme.colors.danger,
      pressed: theme.colors.dangerPressed,
      border: theme.colors.danger,
      foreground: theme.colors.textInverse,
    },
  }[variant];

  const height = {
    small: theme.layout.controlHeight.small,
    medium: theme.layout.controlHeight.medium,
    large: theme.layout.controlHeight.large,
  }[size];

  const spinnerColor = palette.foreground;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled: inactive, busy: loading }}
      disabled={inactive}
      onPress={onPress}
      testID={testID}
      {...focusHandlers}
      style={({ pressed }): ViewStyle => ({
        alignItems: 'center',
        backgroundColor: pressed ? palette.pressed : palette.background,
        borderColor: palette.border,
        borderRadius: theme.radius.field,
        borderWidth: variant === 'ghost' ? 0 : 1,
        flexDirection: 'row',
        gap: theme.space.xs,
        justifyContent: 'center',
        minHeight: height,
        opacity: inactive ? 0.55 : 1,
        paddingHorizontal: size === 'large' ? theme.space.md : theme.space.sm,
        width: fullWidth ? '100%' : undefined,
        ...focusRingStyle,
      })}
    >
      {loading ? (
        <ActivityIndicator color={spinnerColor} size="small" />
      ) : Icon ? (
        <View accessible={false}>
          <Icon color={palette.foreground} size={20} strokeWidth={2} />
        </View>
      ) : null}

      <Text
        variant="bodyStrong"
        tone="primary"
        numberOfLines={1}
        style={{ color: palette.foreground }}
      >
        {loading && loadingLabel ? loadingLabel : label}
      </Text>
    </Pressable>
  );
}
