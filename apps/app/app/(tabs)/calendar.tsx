import { CalendarDays } from 'lucide-react-native';

import { PlaceholderScreen } from '../../src/components/PlaceholderScreen';

/** Calendar — appointments and visits, with who is covering what. */
export default function CalendarScreen() {
  return (
    <PlaceholderScreen
      testID="screen-calendar"
      title="Calendar"
      subtitle="Appointments and visits, and who is covering each one."
      icon={CalendarDays}
      placeholderTitle="Nothing scheduled yet"
      placeholderBody="Appointments, visits and hand-offs will show up here, with a clear answer to who is covering what."
    />
  );
}
