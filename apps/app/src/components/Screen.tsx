import type { ReactNode } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Screen as DesignSystemScreen } from '@tendshare/ui';

export interface ScreenProps {
  readonly children: ReactNode;
  /** Pinned below the content: the one primary action of the screen. */
  readonly footer?: ReactNode;
  /** On for every screen with a text input. */
  readonly keyboardAware?: boolean;
}

/**
 * The screen frame, with the device's real safe-area insets.
 *
 * `Screen` in the design system takes insets as a prop instead of importing a
 * safe-area library, so the app hands them in here — one adapter, and every
 * screen gets the notch and home-indicator spacing for free.
 */
export function Screen({ children, footer, keyboardAware }: ScreenProps) {
  const insets = useSafeAreaInsets();

  return (
    <DesignSystemScreen footer={footer} insets={insets} keyboardAware={keyboardAware}>
      {children}
    </DesignSystemScreen>
  );
}
