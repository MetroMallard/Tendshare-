import { usePathname, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { TabBar, type TabBarItem } from '@tendshare/ui';

import { TAB_ICONS } from '../navigation/tabIcons';
import { normalizePathname, TABS } from '../navigation/tabs';

/**
 * The tab bar, wired to the router.
 *
 * The bar itself — spacing, active pill, 48pt targets, safe area — is
 * `TabBar` from `@tendshare/ui`. This file only maps the five routes in
 * `TABS` onto it, so the visual design never lives in the app shell.
 */
export function AppTabBar() {
  const insets = useSafeAreaInsets();
  const pathname = usePathname();
  const router = useRouter();
  const current = normalizePathname(pathname);

  const items: readonly TabBarItem[] = TABS.map((tab) => ({
    key: tab.path,
    label: tab.title,
    accessibilityLabel: tab.accessibilityLabel,
    icon: TAB_ICONS[tab.name],
  }));

  const active = TABS.find((tab) => tab.path === current)?.path ?? TABS[0]?.path ?? '/';

  return (
    <TabBar
      insetBottom={insets.bottom}
      items={items}
      onSelect={(key) => {
        if (key !== active) {
          router.navigate(key as (typeof TABS)[number]['path']);
        }
      }}
      testID="app-tab-bar"
      value={active}
    />
  );
}
