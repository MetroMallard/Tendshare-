import { Wallet } from 'lucide-react-native';

import { PlaceholderScreen } from '../../src/components/PlaceholderScreen';

/** Money — costs the family logged, split fairly. We record, we never move money. */
export default function MoneyScreen() {
  return (
    <PlaceholderScreen
      testID="screen-money"
      title="Money"
      subtitle="Costs your family has logged, split fairly."
      icon={Wallet}
      placeholderTitle="Nothing logged yet"
      placeholderBody="Shared costs and a clear settle-up summary will live here. Tendshare records costs; it never moves money."
    />
  );
}
