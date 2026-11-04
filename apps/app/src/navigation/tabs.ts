/**
 * The five tabs of the app shell, in order.
 *
 * This file is plain data on purpose: it is the contract the tab bar, the
 * screens and the smoke test all read from, and it stays importable without
 * React Native so it can be tested in Node.
 */
export const TAB_ROUTE_NAMES = ['index', 'calendar', 'meds', 'money', 'more'] as const;

export type TabRouteName = (typeof TAB_ROUTE_NAMES)[number];

export interface TabDefinition {
  /** Expo Router file name inside `app/(tabs)`. */
  readonly name: TabRouteName;
  /** Always-visible tab label. */
  readonly title: string;
  /** Route the tab navigates to. */
  readonly path: '/' | '/calendar' | '/meds' | '/money' | '/more';
  /** Spoken label for screen readers, when the short label is ambiguous. */
  readonly accessibilityLabel: string;
}

export const TABS: readonly TabDefinition[] = [
  {
    name: 'index',
    title: 'Today',
    path: '/',
    accessibilityLabel: 'Today',
  },
  {
    name: 'calendar',
    title: 'Calendar',
    path: '/calendar',
    accessibilityLabel: 'Calendar',
  },
  {
    name: 'meds',
    title: 'Meds',
    path: '/meds',
    accessibilityLabel: 'Meds',
  },
  {
    name: 'money',
    title: 'Money',
    path: '/money',
    accessibilityLabel: 'Money',
  },
  {
    name: 'more',
    title: 'More',
    path: '/more',
    accessibilityLabel: 'More',
  },
];

/** Normalise a pathname so `/` and `/calendar/` compare predictably. */
export function normalizePathname(pathname: string): string {
  if (pathname.length === 0) {
    return '/';
  }

  return pathname.length > 1 && pathname.endsWith('/') ? pathname.slice(0, -1) : pathname;
}
