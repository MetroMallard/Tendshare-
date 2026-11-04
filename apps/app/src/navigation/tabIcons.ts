import { CalendarDays, House, Menu, Pill, Wallet, type LucideIcon } from 'lucide-react-native';

import type { TabRouteName } from './tabs';

/**
 * One icon per tab, from a single consistent set (Lucide). Keeping the mapping
 * out of `tabs.ts` keeps that file free of React Native imports so it can be
 * tested in plain Node.
 */
export const TAB_ICONS: Readonly<Record<TabRouteName, LucideIcon>> = {
  index: House,
  calendar: CalendarDays,
  meds: Pill,
  money: Wallet,
  more: Menu,
};
