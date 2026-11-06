import { useRouter } from 'expo-router';
import { LogOut, Users } from 'lucide-react-native';
import { useState } from 'react';
import { View } from 'react-native';

import {
  Avatar,
  brand,
  Card,
  ConfirmSheet,
  ListRow,
  ScreenHeader,
  Text,
  useTheme,
} from '@tendshare/ui';

import { useSession } from '../../src/auth/session';
import { HiddenEntry } from '../../src/components/HiddenEntry';
import { Screen } from '../../src/components/Screen';
import { useCircle } from '../../src/circles/CircleProvider';
import { circleDisplayName } from '../../src/circles/activeCircle';
import { CircleSwitcher } from '../../src/circles/components/CircleSwitcher';

/** The name to greet someone by, without ever showing an empty row. */
function nameFrom(displayName: string | null, email: string | null): string {
  if (displayName && displayName.trim().length > 0) {
    return displayName;
  }

  const local = email?.split('@')[0];
  return local && local.length > 0 ? local : 'You';
}

/**
 * More — who is signed in, which circle these tabs are about, and the settings
 * that belong to a person rather than to a family.
 *
 * The circle's name is the eyebrow, so every visit to More answers "whose care
 * am I looking at?" before anything else. Under the profile card sits the
 * switcher: one row with the circle's name, your role and how many people are
 * in it, and — when there is more than one circle — one tap to change it. With
 * a single circle the same row is a plain summary with nothing to press.
 */
export default function MoreScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { user, displayName, signOut, isOffline } = useSession();
  const { circles, active, circlesState, switchTo, reloadCircles } = useCircle();
  const circleName = active === null ? null : circleDisplayName(active);
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
        eyebrow={circleName ?? brand.name}
        subtitle="Your circle, the people in it, and your settings."
        title="More"
        titleTestID="screen-more-heading"
      />

      {/*
        The label belongs on the group that *is* the thing, not on the card.
        A `Card accessibilityLabel` was a no-op on both native and web — the
        card is a layout view, so a screen reader walked past it and read the
        name and the address as two unrelated lines.
      */}
      <Card padding="md">
        <View
          accessible
          accessibilityLabel={`Signed in as ${name}`}
          style={{ alignItems: 'center', flexDirection: 'row', gap: theme.space.sm }}
        >
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

      <Card padding="none">
        <CircleSwitcher
          active={active}
          circles={circles}
          offline={isOffline}
          onSwitch={switchTo}
          testID="more-circle-switcher"
        />
        <ListRow
          accessibilityHint="Opens everyone in this circle, and what each role can do."
          divider
          icon={Users}
          onPress={() => {
            router.push('/members');
          }}
          subtitle="Everyone in it, and what each of them can do."
          testID="more-members"
          title="People in this circle"
        />
        {circlesState === 'error' ? (
          <ListRow
            accessibilityHint="Asks the server again for your circles."
            divider
            onPress={reloadCircles}
            subtitle="We couldn’t read your circles just now. Nothing has changed."
            testID="more-circles-error"
            title="Try again"
          />
        ) : null}
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
