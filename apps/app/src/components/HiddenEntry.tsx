import { useRouter } from 'expo-router';
import { useRef } from 'react';
import { Pressable, View } from 'react-native';

import { brand, Text, useTheme } from '@tendshare/ui';

const APP_VERSION = '0.1.0';

/**
 * The hidden way into the component gallery.
 *
 * Five quick taps on the version line under the More tab opens `/gallery`. It is
 * deliberately not linked, not labelled as a button and not mentioned anywhere a
 * family member would read, so nobody can stumble into the design system: a
 * double tap (or an accidental tap while scrolling) does nothing at all.
 *
 * The route also answers to `/gallery` directly, which is how QA and the owner
 * open it on a phone or in a browser.
 */
export function HiddenEntry() {
  const theme = useTheme();
  const router = useRouter();
  const taps = useRef<number[]>([]);

  return (
    <Pressable
      accessibilityLabel={`${brand.name} version ${APP_VERSION}`}
      accessibilityRole="text"
      onPress={() => {
        const now = Date.now();
        taps.current = [...taps.current.filter((time) => now - time < 3000), now];

        if (taps.current.length >= 5) {
          taps.current = [];
          router.push('/gallery');
        }
      }}
      style={{
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: theme.layout.minTapTarget,
        paddingVertical: theme.space.sm,
      }}
      testID="version-entry"
    >
      <View style={{ alignItems: 'center' }}>
        <Text align="center" tone="tertiary" variant="caption">
          {brand.name} {APP_VERSION}
        </Text>
        <Text align="center" tone="tertiary" variant="caption">
          Made with care for families.
        </Text>
      </View>
    </Pressable>
  );
}
