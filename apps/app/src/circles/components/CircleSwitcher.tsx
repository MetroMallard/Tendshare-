import { Users } from 'lucide-react-native';
import { useState } from 'react';

import { Badge, ListRow, OptionList, Sheet, Text, useTheme } from '@tendshare/ui';

import { circleDisplayName, shouldShowSwitcher, type CircleSummary } from '../activeCircle';
import { roleLabel, roleWithCount } from '../roles';

export interface CircleSwitcherProps {
  readonly circles: readonly CircleSummary[];
  readonly active: CircleSummary | null;
  readonly onSwitch: (circleId: string) => void;
  /** Switching needs the list to be current; offline, the row says so instead. */
  readonly offline?: boolean;
  readonly testID?: string;
}

/**
 * Which circle these tabs are about, and the one tap that changes it.
 *
 * One circle means no switcher: a picker with a single option is clutter for the
 * people this app is for, so the row becomes a plain summary (name, your role,
 * how many people) with nothing to press. Two or more and the same row opens a
 * sheet — the row is the affordance, so there is no separate "switch" button to
 * find.
 *
 * The name is one line, truncated with an ellipsis: a long circle name must
 * never wrap a header, because a header that grows by a line pushes the whole
 * screen down on every tab.
 */
export function CircleSwitcher({
  circles,
  active,
  onSwitch,
  offline = false,
  testID,
}: CircleSwitcherProps) {
  const theme = useTheme();
  const [open, setOpen] = useState(false);

  if (active === null) {
    return null;
  }

  const name = circleDisplayName(active);
  const switchable = shouldShowSwitcher(circles);
  const canPress = switchable && !offline;

  const subtitle = offline
    ? `${roleWithCount(active.role, active.memberCount)} · offline`
    : roleWithCount(active.role, active.memberCount);

  return (
    <>
      <ListRow
        /*
          The visible "Switch" pill has to be in the spoken label: it is the one
          word on the row that says this row *does* something. Offline the pill
          reads "Offline", and the label says that instead.
        */
        accessibilityLabel={
          switchable ? `${name}. ${subtitle}. ${canPress ? 'Switch circle' : 'Offline'}` : undefined
        }
        accessibilityHint={
          canPress
            ? 'Opens a list of your circles. Every tab follows the one you choose.'
            : undefined
        }
        avatarName={active.recipientName ?? undefined}
        icon={active.recipientName === null ? Users : undefined}
        onPress={
          canPress
            ? () => {
                setOpen(true);
              }
            : undefined
        }
        showChevron={canPress}
        subtitle={subtitle}
        testID={testID ?? 'circle-switcher'}
        title={name}
        trailing={
          switchable ? (
            <Badge
              label={canPress ? 'Switch' : 'Offline'}
              tone={canPress ? 'brand' : 'neutral'}
              testID="circle-switcher-badge"
            />
          ) : undefined
        }
      />

      <Sheet
        description="Every tab shows the circle you pick. You can switch back any time."
        onClose={() => {
          setOpen(false);
        }}
        testID="circle-switcher-sheet"
        title="Your circles"
        visible={open}
      >
        <OptionList
          accessibilityLabel="Which circle to show"
          onChange={(circleId) => {
            setOpen(false);
            onSwitch(circleId);
          }}
          options={circles.map((circle) => ({
            value: circle.circleId,
            label: circleDisplayName(circle),
            description: roleWithCount(circle.role, circle.memberCount),
          }))}
          testID="circle-switcher-option"
          value={active.circleId}
        />

        <Text tone="tertiary" variant="caption">
          {`You are ${roleLabel(active.role).toLowerCase()} of ${name}.`}
        </Text>
      </Sheet>

      {offline && switchable ? (
        <Text tone="tertiary" variant="caption" style={{ paddingHorizontal: theme.space.xs }}>
          You’re offline, so switching is paused until you’re back.
        </Text>
      ) : null}
    </>
  );
}
