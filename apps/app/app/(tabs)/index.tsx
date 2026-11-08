import { House } from 'lucide-react-native';

import { PlaceholderScreen } from '../../src/components/PlaceholderScreen';
import { TodayMedsSection } from '../../src/meds/components/TodayMedsSection';
import { CareRecipientCard } from '../../src/profile/components/CareRecipientCard';

/**
 * Today — the family's day at a glance.
 *
 * Two things a family opens the app for: who they are caring for, and what is
 * due. The person card comes first because it is the one that works before
 * anything else exists; the medicines card sits under it with the next few doses
 * and the same tick the Meds tab uses.
 *
 * The rest of the day — appointments, who is covering what — arrives with the
 * calendar and updates tasks.
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
      <TodayMedsSection />
    </PlaceholderScreen>
  );
}
