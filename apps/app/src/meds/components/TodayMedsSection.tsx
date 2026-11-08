/**
 * Today's medicines on the Today tab, wired.
 *
 * The card is drawn by `TodayMedsCard`; this is the part that reads the day and
 * offers the tick. It shares `useMeds` and `useDoseTicks` with the Meds tab, so
 * the two screens cannot disagree about what a tick does or when one is allowed.
 */
import { useRouter } from 'expo-router';

import { useCircle } from '../../circles/CircleProvider';
import { useIsOnline } from '../../lib/online';
import { doseDateOf } from '../doseSlots';
import { useDoseTicks } from '../useDoseTicks';
import { useMeds } from '../useMeds';
import { DoseUndoSheet } from './DoseUndoSheet';
import { TodayMedsCard } from './TodayMedsCard';

export function TodayMedsSection() {
  const router = useRouter();
  const { active, capabilities } = useCircle();
  const online = useIsOnline();
  const today = doseDateOf(new Date());

  const circleId = active?.circleId ?? null;
  const { status, snapshot, reload, apply } = useMeds(circleId, today);
  const ticks = useDoseTicks({ circleId, online, apply, reload });

  return (
    <>
      <TodayMedsCard
        canSeeMeds={capabilities.canSeeMeds}
        canTick={capabilities.canCheckOffMeds && online}
        canUndo={capabilities.canUndoCheckOff && online}
        checkOffs={snapshot?.checkOffs ?? []}
        loadState={status}
        medications={snapshot?.medications ?? []}
        offline={!online}
        onOpenMeds={() => {
          router.push('/meds');
        }}
        onRetry={reload}
        onTick={ticks.tick}
        onUndo={ticks.requestUndo}
        today={today}
      />
      <DoseUndoSheet ticks={ticks} />
    </>
  );
}
