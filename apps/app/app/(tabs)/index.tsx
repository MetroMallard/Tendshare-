import { House } from 'lucide-react-native';

import { PlaceholderScreen } from '../../src/components/PlaceholderScreen';
import { CareRecipientCard } from '../../src/profile/components/CareRecipientCard';

/**
 * Today — the family's day at a glance.
 *
 * The day's plan arrives in a later task. What is here now is the one thing a
 * family needs before anything else: who they are caring for, and a tap through
 * to their profile.
 */
export default function TodayScreen() {
  return (
    <PlaceholderScreen
      testID="screen-today"
      title="Today"
      subtitle="Your family's day, all in one place."
      icon={House}
      placeholderTitle="Today is quiet"
      placeholderBody="Once your circle is set up, this is where the day's plan appears: what is happening, who is covering it, and what still needs a hand."
    >
      <CareRecipientCard />
    </PlaceholderScreen>
  );
}
