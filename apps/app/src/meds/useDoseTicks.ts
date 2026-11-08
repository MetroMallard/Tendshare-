/**
 * The two writes a dose has: the tick, and the undo.
 *
 * Both the Meds tab and the Today card offer the same control, so both go
 * through this hook — one copy of the optimistic paint, one copy of the rollback,
 * one copy of the sentence a refusal produces. A second copy would eventually
 * disagree with the first about whether a tick is allowed offline.
 *
 * The undo is a *delete*, because a check-off has no update path at all: undoing
 * a mistake and re-ticking writes two facts to the change history instead of one
 * silently rewriting the other. It is asked for with a ConfirmSheet, which is why
 * the slot being undone is held here rather than in a screen.
 */
import { useCallback, useState } from 'react';

import { getSupabaseClient } from '../lib/supabase';
import { undoCopy, type UndoCopy } from './checkoffSentence';
import type { DoseSlot } from './doseSlots';
import type { MedsProblem } from './components/MedsView';
import { medProblemCopy, tickDose, untickDose } from './medActions';
import type { MedsSnapshot } from './medData';
import {
  pendingId,
  withCheckOff,
  withReplacedCheckOff,
  withoutCheckOff,
} from './optimistic';

export interface DoseTicks {
  readonly problem: MedsProblem | null;
  readonly setProblem: (problem: MedsProblem | null) => void;
  readonly tick: (slot: DoseSlot) => void;
  /** Ask before undoing: opens the confirm sheet with this slot. */
  readonly requestUndo: (slot: DoseSlot) => void;
  readonly undoSlot: DoseSlot | null;
  readonly undoCopy: UndoCopy | null;
  readonly cancelUndo: () => void;
  readonly confirmUndo: () => void;
}

export interface UseDoseTicksInput {
  readonly circleId: string | null;
  readonly online: boolean;
  readonly apply: (update: (snapshot: MedsSnapshot) => MedsSnapshot) => void;
  readonly reload: () => void;
}

export function useDoseTicks({ circleId, online, apply, reload }: UseDoseTicksInput): DoseTicks {
  const client = getSupabaseClient();
  const [problem, setProblem] = useState<MedsProblem | null>(null);
  const [undoSlot, setUndoSlot] = useState<DoseSlot | null>(null);

  const tick = useCallback(
    (slot: DoseSlot) => {
      if (client === null || circleId === null) {
        return;
      }

      if (!online) {
        setProblem(medProblemCopy('offline'));
        return;
      }

      // The optimistic row says "You", because the person tapping knows who they
      // are and a name they cannot verify is worse than none. The database's own
      // timestamp and the ticker's name replace it the moment the insert lands.
      const tempId = pendingId('tick');
      const optimistic = {
        id: tempId,
        medicationId: slot.medicationId,
        doseDate: slot.doseDate,
        doseTime: slot.doseTime,
        takenByName: 'You',
        takenAt: new Date().toISOString(),
      };

      setProblem(null);
      apply((current) => withCheckOff(current, optimistic));

      void tickDose(client, {
        circleId,
        medicationId: slot.medicationId,
        doseDate: slot.doseDate,
        doseTime: slot.doseTime,
      })
        .then((result) => {
          if (!result.ok) {
            apply((current) => withoutCheckOff(current, tempId));
            setProblem(medProblemCopy(result.problem));

            if (result.problem === 'already_ticked') {
              reload();
            }

            return;
          }

          apply((current) =>
            withReplacedCheckOff(current, tempId, {
              ...optimistic,
              id: result.checkOffId,
              takenAt: result.takenAt,
            }),
          );
        })
        .catch(() => {
          apply((current) => withoutCheckOff(current, tempId));
          setProblem(medProblemCopy('unknown'));
        });
    },
    [apply, circleId, client, online, reload],
  );

  const requestUndo = useCallback((slot: DoseSlot) => {
    if (slot.checkOff === null) {
      return;
    }

    setUndoSlot(slot);
  }, []);

  const cancelUndo = useCallback(() => {
    setUndoSlot(null);
  }, []);

  const confirmUndo = useCallback(() => {
    const slot = undoSlot;
    setUndoSlot(null);

    if (client === null || slot === null || slot.checkOff === null) {
      return;
    }

    const checkOff = slot.checkOff;
    setProblem(null);
    apply((current) => withoutCheckOff(current, checkOff.id));

    void untickDose(client, checkOff.id)
      .then((result) => {
        if (!result.ok) {
          apply((current) => withCheckOff(current, checkOff));
          setProblem(medProblemCopy(result.problem));
        }
      })
      .catch(() => {
        apply((current) => withCheckOff(current, checkOff));
        setProblem(medProblemCopy('unknown'));
      });
  }, [apply, client, undoSlot]);

  return {
    problem,
    setProblem,
    tick,
    requestUndo,
    undoSlot,
    undoCopy:
      undoSlot === null || undoSlot.checkOff === null
        ? null
        : undoCopy({
            medicationName: undoSlot.medicationName,
            doseTime: undoSlot.doseTime,
            checkOff: undoSlot.checkOff,
          }),
    cancelUndo,
    confirmUndo,
  };
}
