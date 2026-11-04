import { Menu } from 'lucide-react-native';

import { PlaceholderScreen } from '../../src/components/PlaceholderScreen';

/** More — circle, documents, plan and settings. */
export default function MoreScreen() {
  return (
    <PlaceholderScreen
      testID="screen-more"
      title="More"
      subtitle="Your circle, documents and settings."
      icon={Menu}
      placeholderTitle="Not set up yet"
      placeholderBody="Your care circle, the document vault, your plan and your settings will all be reachable from here."
    />
  );
}
