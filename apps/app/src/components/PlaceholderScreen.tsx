import type { ReactNode } from 'react';

import { brand, Card, EmptyState, ScreenHeader, type IconComponent } from '@tendshare/ui';

import { useCircle } from '../circles/CircleProvider';
import { circleDisplayName } from '../circles/activeCircle';
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
  /**
   * Real content for a tab that is no longer only a placeholder, drawn between
   * the header and the empty state. Today uses it for the person the family is
   * caring for; the rest of the tab arrives in a later task.
   */
  children?: ReactNode;
}

/**
 * What a tab shows before its feature exists.
 *
 * Built entirely from design-system pieces — a header and one empty state in a
 * card — so the shell already looks like the product rather than like scaffolding.
 *
 * The eyebrow is the active circle's name. That is the one piece of context a
 * family needs on every tab: with two parents and two circles, "which one am I
 * looking at?" has to be answerable without going back to More. With no circle
 * yet it falls back to the product name, exactly as before.
 */
export function PlaceholderScreen({
  title,
  subtitle,
  icon,
  placeholderTitle,
  placeholderBody,
  testID,
  children,
}: PlaceholderScreenProps) {
  const { active } = useCircle();
  const eyebrow = active === null ? brand.name : circleDisplayName(active);

  return (
    <Screen>
      <ScreenHeader
        eyebrow={eyebrow}
        subtitle={subtitle}
        title={title}
        titleTestID={`${testID}-heading`}
      />
      {children}
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
