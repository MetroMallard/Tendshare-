import { HeartHandshake } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { View } from 'react-native';

import { Card, EmptyState, ListRow, Section, Skeleton, useTheme } from '@tendshare/ui';

import { useCircle } from '../../circles/CircleProvider';
import { loadCareRecipient, type CareRecipientSummary } from '../../circles/loadCircles';
import { getSupabaseClient } from '../../lib/supabase';

/**
 * "Who you're caring for", at the top of Today.
 *
 * Today is the tab a family opens most, so the person being cared for has to be
 * one tap from it — the same card the members screen shows, and the same
 * destination: `/profile`.
 *
 * It loads its own summary rather than taking one as a prop because Today has
 * nothing else to read yet, and a card that shows a skeleton for one request is
 * cheaper than a screen that blocks on two. The four states are the same four
 * every other screen has: loading, a name, "nobody added yet", and a retry that
 * says nothing has changed.
 */
export function CareRecipientCard() {
  const theme = useTheme();
  const router = useRouter();
  const client = getSupabaseClient();
  const { active, circlesState } = useCircle();

  const [recipient, setRecipient] = useState<CareRecipientSummary | null>(null);
  const [loadState, setLoadState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [request, setRequest] = useState(0);

  const circleId = active?.circleId ?? null;

  useEffect(() => {
    if (client === null || circleId === null) {
      setLoadState(circlesState === 'error' ? 'error' : 'loading');
      return;
    }

    let cancelled = false;
    setLoadState('loading');

    void loadCareRecipient(client, circleId).then((person) => {
      if (cancelled) {
        return;
      }

      // `null` is "this circle has nobody in it yet" as well as "we could not
      // ask", exactly as the members screen reads it: the empty state is the
      // honest one for both, and the retry below covers the second.
      setRecipient(person);
      setLoadState('ready');
    });

    return () => {
      cancelled = true;
    };
  }, [client, circleId, circlesState, request]);

  // No circle yet: the onboarding guard is about to send them somewhere else, and
  // a card about nobody is noise in the frame before it does.
  if (active === null) {
    return null;
  }

  return (
    <Section title="Who you’re caring for">
      <Card padding="none">
        {loadState === 'loading' ? (
          <View style={{ padding: theme.space.sm }}>
            <Skeleton lines={2} testID="today-recipient-loading" />
          </View>
        ) : loadState === 'error' ? (
          <EmptyState
            actionLabel="Try again"
            body="We couldn’t read their name just now. Nothing has changed."
            headline="We couldn’t load them"
            icon={HeartHandshake}
            onAction={() => {
              setRequest((count) => count + 1);
            }}
            testID="today-recipient-error"
          />
        ) : recipient === null ? (
          <EmptyState
            body="Nobody has been added to this circle yet."
            headline="No one added yet"
            icon={HeartHandshake}
            testID="today-recipient-empty"
          />
        ) : (
          <ListRow
            accessibilityHint="Opens their profile: the basics, doctors, allergies and insurance cards."
            avatarName={recipient.fullName}
            onPress={() => {
              router.push('/profile');
            }}
            showChevron
            subtitle={recipient.relationship ?? 'Relationship not added'}
            testID="today-recipient"
            title={recipient.fullName}
          />
        )}
      </Card>
    </Section>
  );
}
