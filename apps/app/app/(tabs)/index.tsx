import { House } from 'lucide-react-native';

import { PlaceholderScreen } from '../../src/components/PlaceholderScreen';

/** Today — the family's day at a glance. Feature arrives in a later phase. */
export default function TodayScreen() {
  return (
    <PlaceholderScreen
      testID="screen-today"
      title="Today"
      subtitle="Your family's day, all in one place."
      icon={House}
      placeholderTitle="Today is quiet"
      placeholderBody="Once your circle is set up, this is where the day's plan appears: what is happening, who is covering it, and what still needs a hand."
    />
  );
}
