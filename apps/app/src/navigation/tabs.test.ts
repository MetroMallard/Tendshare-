import { readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { TABS, TAB_ROUTE_NAMES } from './tabs';

describe('app shell tabs', () => {
  it('shows exactly the five tabs, in the agreed order', () => {
    expect(TABS.map((tab) => tab.title)).toEqual(['Today', 'Calendar', 'Meds', 'Money', 'More']);
  });

  it('gives every tab a route name that matches a screen file', () => {
    const routesDir = fileURLToPath(new URL('../../app/(tabs)', import.meta.url));
    const screens = new Set(
      readdirSync(routesDir)
        .filter((file) => file.endsWith('.tsx') && !file.startsWith('_'))
        .map((file) => file.replace(/\.tsx$/, '')),
    );

    expect(TABS.map((tab) => tab.name)).toEqual([...TAB_ROUTE_NAMES]);
    expect(new Set(TABS.map((tab) => tab.name)).size).toBe(TABS.length);

    for (const tab of TABS) {
      expect(screens.has(tab.name), `${tab.name} tab has no screen file`).toBe(true);
    }
  });

  it('always has a visible label and a spoken label for every tab', () => {
    for (const tab of TABS) {
      expect(tab.title.trim(), `${tab.name} has no visible label`).not.toBe('');
      expect(tab.accessibilityLabel.trim(), `${tab.name} has no accessibility label`).not.toBe('');
    }
  });
});
