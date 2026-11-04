import type { PropsWithChildren } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Screen as DesignSystemScreen } from '@tendshare/ui';

/**
 * The screen frame, with the device's real safe-area insets.
 *
 * `Screen` in the design system takes insets as a prop instead of importing a
 * safe-area library, so the app hands them in here — one adapter, and every
 * screen gets the notch and home-indicator spacing for free.
 */
export function Screen({ children }: PropsWithChildren) {
  const insets = useSafeAreaInsets();

  return <DesignSystemScreen insets={insets}>{children}</DesignSystemScreen>;
}
