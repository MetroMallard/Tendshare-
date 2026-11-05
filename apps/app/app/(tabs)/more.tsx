import { LogOut, Menu } from 'lucide-react-native';
import { useState } from 'react';
import { View } from 'react-native';

import {
  Avatar,
  brand,
  Card,
  ConfirmSheet,
  EmptyState,
  ListRow,
  ScreenHeader,
  Text,
  useTheme,
} from '@tendshare/ui';

import { useSession } from '../../src/auth/session';
import { HiddenEntry } from '../../src/components/HiddenEntry';
import { Screen } from '../../src/components/Screen';

/** The name to greet someone by, without ever showing an empty row. */
function nameFrom(displayName: string | null, email: string | null): string {
  if (displayName && displayName.trim().length > 0) {
    return displayName;
  }

  const local = email?.split('@')[0];
  return local && local.length > 0 ? local : 'You';
}

/** More — who is signed in, the circle, documents, plan and settings. */
export default function MoreScreen() {
  const theme = useTheme();
  const { user, displayName, signOut, isOffline } = useSession();
  const [confirming, setConfirming] = useState(false);
  const [signingOut, setSigningOut] = useState(false);

  const email = user?.email ?? null;
  const name = nameFrom(displayName, email);

  async function confirmSignOut() {
    setSigningOut(true);
    // The session provider clears this device first and revokes the account's
    // refresh tokens second, so this resolves even with no connection. The
    // route guard takes over from here and closes the shell.
    await signOut();
    setSigningOut(false);
    setConfirming(false);
  }

  return (
    <Screen>
      <ScreenHeader
        eyebrow={brand.name}
        subtitle="Your circle, documents and settings."
        title="More"
        titleTestID="screen-more-heading"
      />

      <Card accessibilityLabel={`Signed in as ${name}`} padding="md">
        <View style={{ alignItems: 'center', flexDirection: 'row', gap: theme.space.sm }}>
          <Avatar name={name} size="large" />
          <View style={{ flex: 1, gap: theme.space['2xs'] }}>
            <Text variant="subheading">{name}</Text>
            {email ? (
              <Text tone="secondary" variant="caption">
                {email}
              </Text>
            ) : null}
          </View>
        </View>
      </Card>

      <Card padding="sm">
        <EmptyState
          body="Your care circle, the document vault, your plan and your settings will all be reachable from here."
          headline="Not set up yet"
          icon={Menu}
          testID="screen-more-placeholder"
        />
      </Card>

      <Card padding="none">
        <ListRow
          accessibilityHint="Asks you to confirm, then signs you out on this device."
          icon={LogOut}
          onPress={() => setConfirming(true)}
          showChevron={false}
          subtitle="You'll need your email code to get back in."
          testID="more-sign-out"
          title="Sign out"
        />
      </Card>

      {isOffline ? (
        <Text tone="tertiary" variant="caption">
          You're offline. Signing out still clears this device now; your other devices catch up when
          you're back online.
        </Text>
      ) : null}

      <HiddenEntry />

      <ConfirmSheet
        cancelLabel="Stay signed in"
        confirmLabel="Sign out"
        destructive
        loading={signingOut}
        message="Nothing in your circle is deleted. You'll need a fresh code from your email to sign back in."
        onClose={() => setConfirming(false)}
        onConfirm={() => {
          void confirmSignOut();
        }}
        testID="more-sign-out-confirm"
        title="Sign out?"
        visible={confirming}
      />
    </Screen>
  );
}
