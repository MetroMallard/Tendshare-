import { Link, Stack } from 'expo-router';

import { Button, Card, ScreenHeader, Text } from '@tendshare/ui';

import { Screen } from '../src/components/Screen';

/** Fallback for an unknown route. */
export default function NotFoundScreen() {
  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <Screen>
        <ScreenHeader
          subtitle="The link may be out of date. Everything else still works."
          title="We couldn't find that page"
        />
        <Card>
          <Text tone="secondary">Head back to Today and carry on from there.</Text>
          <Link asChild href="/">
            <Button label="Go to Today" variant="primary" />
          </Link>
        </Card>
      </Screen>
    </>
  );
}
