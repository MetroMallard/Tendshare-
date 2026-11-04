import { Tabs } from 'expo-router';

import { AppTabBar } from '../../src/components/AppTabBar';
import { TABS } from '../../src/navigation/tabs';

/**
 * The five-tab shell. Order and labels come from `TABS`, icons from
 * `TAB_ICONS`, and the bar itself is `AppTabBar`.
 */
export default function TabsLayout() {
  return (
    <Tabs
      tabBar={() => <AppTabBar />}
      screenOptions={{
        headerShown: false,
      }}
    >
      {TABS.map((tab) => (
        <Tabs.Screen
          key={tab.name}
          name={tab.name}
          options={{
            title: tab.title,
          }}
        />
      ))}
    </Tabs>
  );
}
