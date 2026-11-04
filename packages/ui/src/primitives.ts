import { useEffect, useState, type ReactNode } from 'react';
import { AccessibilityInfo, Platform, type ViewStyle } from 'react-native';

import { useTheme } from './ThemeProvider';

/**
 * An icon component, typed structurally rather than by importing an icon
 * library.
 *
 * The design system ships no icon set of its own: a screen passes a Lucide icon
 * (or anything else with this shape) and the component renders it in the right
 * colour and size. That keeps this package free of a run-time icon dependency
 * while still letting every icon inherit the tokens.
 */
export type IconComponent = (props: {
  readonly size?: number;
  readonly color?: string;
  readonly strokeWidth?: number;
}) => ReactNode;

/**
 * A focus ring, for keyboard users on web.
 *
 * Native phones have no focus-visible concept, so this is a no-op there — but on
 * web it is never removed, because "where am I" is the one thing a keyboard user
 * cannot guess. Components call this and spread the result onto their style.
 */
export function useFocusRing(): {
  readonly focused: boolean;
  readonly focusHandlers: { readonly onFocus: () => void; readonly onBlur: () => void };
  readonly focusRingStyle: ViewStyle;
} {
  const theme = useTheme();
  const [focused, setFocused] = useState(false);

  const focusRingStyle: ViewStyle =
    focused && Platform.OS === 'web'
      ? {
          outlineColor: theme.colors.focus,
          outlineOffset: 2,
          outlineStyle: 'solid',
          outlineWidth: 2,
        }
      : {};

  return {
    focused,
    focusHandlers: {
      onFocus: () => {
        setFocused(true);
      },
      onBlur: () => {
        setFocused(false);
      },
    },
    focusRingStyle,
  };
}

/**
 * Respect the system "reduce motion" setting. Anything that moves asks this
 * first and falls back to a still frame.
 */
export function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    let active = true;

    void AccessibilityInfo.isReduceMotionEnabled().then((value) => {
      if (active) {
        setReduced(value);
      }
    });

    const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', (value) => {
      setReduced(value);
    });

    return () => {
      active = false;
      subscription.remove();
    };
  }, []);

  return reduced;
}

/**
 * Safe-area insets, passed in rather than read from a provider.
 *
 * The design system deliberately takes no dependency on a safe-area library: the
 * app reads the real insets once and hands them to `Screen` and `TabBar`. That
 * keeps this package to two peer dependencies (react and react-native) and means
 * nothing here can disagree with the app's own provider.
 */
export interface EdgeInsets {
  readonly top: number;
  readonly right: number;
  readonly bottom: number;
  readonly left: number;
}
