import { Menu } from 'lucide-react-native';

import { Card, EmptyState, ScreenHeader } from '@tendshare/ui';

import { HiddenEntry } from '../../src/components/HiddenEntry';
import { Screen } from '../../src/components/Screen';

/** More — circle, documents, plan and settings. */
export default function MoreScreen() {
  return (
    <Screen>
      <ScreenHeader
        eyebrow="Tendshare"
        subtitle="Your circle, documents and settings."
        title="More"
        titleTestID="screen-more-heading"
      />
      <Card padding="sm">
        <EmptyState
          body="Your care circle, the document vault, your plan and your settings will all be reachable from here."
          headline="Not set up yet"
          icon={Menu}
          testID="screen-more-placeholder"
        />
      </Card>
      <HiddenEntry />
    </Screen>
  );
}
