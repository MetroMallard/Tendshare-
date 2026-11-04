import { Card, EmptyState, ScreenHeader, type IconComponent } from '@tendshare/ui';

import { Screen } from './Screen';

export interface PlaceholderScreenProps {
  /** Screen heading, matching the tab label. */
  title: string;
  /** One calm sentence about what this tab will hold. */
  subtitle: string;
  icon: IconComponent;
  /** Empty-state headline. */
  placeholderTitle: string;
  /** Empty-state body: one line, plain. */
  placeholderBody: string;
  testID: string;
}

/**
 * What a tab shows before its feature exists.
 *
 * Built entirely from design-system pieces — a header and one empty state in a
 * card — so the shell already looks like the product rather than like scaffolding.
 */
export function PlaceholderScreen({
  title,
  subtitle,
  icon,
  placeholderTitle,
  placeholderBody,
  testID,
}: PlaceholderScreenProps) {
  return (
    <Screen>
      <ScreenHeader
        eyebrow="Tendshare"
        subtitle={subtitle}
        title={title}
        titleTestID={`${testID}-heading`}
      />
      <Card padding="sm">
        <EmptyState
          body={placeholderBody}
          headline={placeholderTitle}
          icon={icon}
          testID={`${testID}-placeholder`}
        />
      </Card>
    </Screen>
  );
}
