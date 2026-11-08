/**
 * Today's medicines, on the Today tab.
 *
 * A glance, not the list: the next few doses with the same tick control the meds
 * screen uses, "Sara ticked this at 8:12 am" once one is done, and a way through
 * to the whole list. It sits beside the person card because those are the two
 * things a family opens the app for — who am I caring for, and what is due.
 *
 * It carries the same rules as the meds screen, from the same capability map:
 * the tick is offered only when `canCheckOffMeds` and the connection allows it,
 * the undo only when `canUndoCheckOff`, and the link to the list only when the
 * role may see the list at all.
 */
import { ArrowRight, Pill } from 'lucide-react-native';
import { View } from 'react-native';

import { Button, Card, Skeleton, Text, useTheme } from '@tendshare/ui';

import { tickAccessibilityHint, tickAccessibilityLabel, tickedSentence } from '../checkoffSentence';
import { buildDoseSlots, nextDoses, type CheckOff, type DoseSlot, type Medication } from '../doseSlots';
import { TickButton } from './TickButton';

export interface TodayMedsCardProps {
  readonly loadState: 'loading' | 'ready' | 'error';
  readonly offline: boolean;
  /** `YYYY-MM-DD`, passed in so the card is deterministic in a preview. */
  readonly today: string;
  readonly medications: readonly Medication[];
  readonly checkOffs: readonly CheckOff[];
  readonly canSeeMeds: boolean;
  readonly canTick: boolean;
  readonly canUndo: boolean;
  readonly onTick: (slot: DoseSlot) => void;
  readonly onUndo: (slot: DoseSlot) => void;
  readonly onOpenMeds: () => void;
  readonly onRetry: () => void;
  readonly testID?: string;
}

export function TodayMedsCard({
  loadState,
  offline,
  today,
  medications,
  checkOffs,
  canSeeMeds,
  canTick,
  canUndo,
  onTick,
  onUndo,
  onOpenMeds,
  onRetry,
  testID = 'today-meds',
}: TodayMedsCardProps) {
  const theme = useTheme();

  if (!canSeeMeds) {
    return null;
  }

  const slots = buildDoseSlots(medications, checkOffs, today);
  const shown = nextDoses(slots, 3);
  const open = slots.filter((slot) => slot.checkOff === null).length;

  const subtitle =
    loadState !== 'ready'
      ? undefined
      : slots.length === 0
        ? 'Nothing is scheduled for today.'
        : open === 0
          ? 'Every dose today is ticked.'
          : `${String(open)} still to tick today.`;

  return (
    <Card
      action={
        <Button
          accessibilityHint="Opens the medicine list."
          icon={ArrowRight}
          label="All meds"
          onPress={onOpenMeds}
          size="small"
          testID={`${testID}-open`}
          variant="ghost"
        />
      }
      subtitle={subtitle}
      testID={testID}
      title="Today’s medicines"
    >
      {loadState === 'loading' ? (
        <View style={{ gap: theme.space.sm }} testID={`${testID}-loading`}>
          <Skeleton shape="row" />
          <Skeleton shape="row" />
        </View>
      ) : loadState === 'error' ? (
        <View style={{ gap: theme.space.xs }} testID={`${testID}-error`}>
          <Text tone="secondary" variant="caption">
            We couldn’t read the medicine list just now. Nothing has changed.
          </Text>
          <Button
            label="Try again"
            onPress={onRetry}
            size="small"
            testID={`${testID}-retry`}
            variant="secondary"
          />
        </View>
      ) : shown.length === 0 ? (
        <View style={{ alignItems: 'center', flexDirection: 'row', gap: theme.space.xs }}>
          <Pill color={theme.colors.textTertiary} size={20} />
          <Text style={{ flexShrink: 1 }} tone="secondary" variant="caption">
            No doses today. Add a medicine and its times and they appear here.
          </Text>
        </View>
      ) : (
        <View style={{ gap: theme.space.xs }} testID={`${testID}-list`}>
          {shown.map((slot) => {
            const ticked = slot.checkOff !== null;
            const interactive = ticked ? canUndo : canTick;

            return (
              <View
                key={slot.key}
                style={{
                  alignItems: 'center',
                  flexDirection: 'row',
                  gap: theme.space.sm,
                  minHeight: theme.layout.minTapTarget,
                }}
                testID={`${testID}-dose-${slot.key}`}
              >
                <View style={{ flex: 1, gap: theme.space['2xs'] }}>
                  <Text variant="bodyStrong">
                    {slot.medicationName} · {slot.clock}
                  </Text>
                  {slot.checkOff !== null ? (
                    <Text tone="success" variant="caption">
                      {tickedSentence(slot.checkOff)}
                    </Text>
                  ) : (
                    <Text tone="secondary" variant="caption">
                      Not ticked yet
                    </Text>
                  )}
                </View>

                <TickButton
                  accessibilityHint={tickAccessibilityHint(slot.checkOff)}
                  accessibilityLabel={tickAccessibilityLabel({
                    medicationName: slot.medicationName,
                    doseTime: slot.doseTime,
                    checkOff: slot.checkOff,
                  })}
                  disabled={!interactive}
                  onPress={ticked ? () => onUndo(slot) : () => onTick(slot)}
                  state={ticked ? 'ticked' : 'open'}
                  testID={`${testID}-tick-${slot.key}`}
                />
              </View>
            );
          })}

          {offline ? (
            <Text tone="tertiary" variant="caption">
              You’re offline, so ticking is paused. The list is the last one we read.
            </Text>
          ) : null}
        </View>
      )}
    </Card>
  );
}
