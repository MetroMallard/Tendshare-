import { createContext, useContext, useMemo, type PropsWithChildren } from 'react';
import { useColorScheme } from 'react-native';

import { getTheme, type Theme } from './tokens';

/**
 * The active theme, following the device setting. Tokens themselves are
 * temporary — see the TODO in `tokens.ts`.
 */
const ThemeContext = createContext<Theme | null>(null);

export function ThemeProvider({ children }: PropsWithChildren) {
  const scheme = useColorScheme();
  const theme = useMemo(() => getTheme(scheme), [scheme]);

  return <ThemeContext.Provider value={theme}>{children}</ThemeContext.Provider>;
}

/** Read the active theme. Throws if used outside `ThemeProvider`. */
export function useTheme(): Theme {
  const theme = useContext(ThemeContext);

  if (theme === null) {
    throw new Error('useTheme must be used inside a ThemeProvider.');
  }

  return theme;
}
