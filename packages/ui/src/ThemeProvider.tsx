import { createContext, useContext, useMemo, useState, type PropsWithChildren } from 'react';
import { useColorScheme } from 'react-native';

import type { ColorScheme } from './tokens/colors';
import { getTheme, type Theme } from './tokens/theme';

/**
 * `system` follows the phone's light/dark setting — the default, because that is
 * what people expect. `light` and `dark` pin the app, which is what the hidden
 * gallery uses to show both schemes side by side.
 */
export type ThemeMode = 'system' | ColorScheme;

export interface ThemeContextValue {
  readonly theme: Theme;
  readonly mode: ThemeMode;
  /** The scheme actually in use after resolving `system`. */
  readonly scheme: ColorScheme;
  readonly setMode: (mode: ThemeMode) => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

export interface ThemeProviderProps {
  /** Start in a fixed scheme. Used by the gallery; the app leaves it `system`. */
  initialMode?: ThemeMode;
}

export function ThemeProvider({
  children,
  initialMode = 'system',
}: PropsWithChildren<ThemeProviderProps>) {
  const systemScheme = useColorScheme();
  const [mode, setMode] = useState<ThemeMode>(initialMode);

  const scheme: ColorScheme =
    mode === 'system' ? (systemScheme === 'dark' ? 'dark' : 'light') : mode;

  const value = useMemo<ThemeContextValue>(
    () => ({ theme: getTheme(scheme), mode, scheme, setMode }),
    [scheme, mode],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

function useThemeContext(): ThemeContextValue {
  const value = useContext(ThemeContext);

  if (value === null) {
    throw new Error(
      'Tendshare components must be rendered inside <ThemeProvider> from @tendshare/ui.',
    );
  }

  return value;
}

/** The active theme — every component reads its colours, space and type here. */
export function useTheme(): Theme {
  return useThemeContext().theme;
}

/** Mode switching, for the gallery and (later) a settings screen. */
export function useThemeMode(): ThemeContextValue {
  return useThemeContext();
}
