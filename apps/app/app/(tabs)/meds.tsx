import { Pill } from 'lucide-react-native';

import { PlaceholderScreen } from '../../src/components/PlaceholderScreen';

/** Meds — the family's own list, never a suggestion from us. */
export default function MedsScreen() {
  return (
    <PlaceholderScreen
      testID="screen-meds"
      title="Meds"
      subtitle="The list exactly as your family writes it."
      icon={Pill}
      placeholderTitle="No list yet"
      placeholderBody="Your family adds each entry itself, word for word. Tendshare never suggests doses and never gives advice."
    />
  );
}
