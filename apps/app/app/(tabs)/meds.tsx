/**
 * The Meds tab, wired to the database.
 *
 * `MedsView` draws; everything in this file is the part that cannot be drawn —
 * the read, the writes, the optimistic row that goes back where it was when a
 * write is refused, and the two sheets.
 *
 * ## Optimistic, and visibly so
 *
 * A tick paints immediately: the row says "You, 8:12 am" and the control turns
 * green before the round trip finishes. If the database says no, the tick is put
 * back **and the reason is said out loud** above the list — a row that quietly
 * reappears is worse than one that never moved, because the person cannot tell
 * whether they did something wrong. When the real check-off comes back, its own
 * `taken_at` and the ticker's name replace the optimistic ones.
 *
 * A save closes the sheet, paints the medicine, and — if it fails — puts the list
 * back, says one calm sentence, and **reopens the sheet with every word still in
 * it**, so nobody retypes an instruction twice.
 *
 * ## Where the audit trail comes from
 *
 * Nowhere in this file. The triggers in `20261107120000_medications.sql` write the
 * trail in the same transaction as the change, with the actor from the session and
 * field names only. The app could write a row of its own here; it must not,
 * because a client that can write the log can write the wrong thing into it.
 *
 * ## The tick is never gated on the plan
 *
 * The owner settled this on 2026-11-06: a circle whose paid plan ends keeps every
 * free feature, med check-offs explicitly included. So `planLapsed` only reaches
 * the refill reminder fields; nothing about ticking consults it, and nothing here
 * would be allowed to.
 */
import { useEffect, useState } from 'react';

import { ConfirmSheet } from '@tendshare/ui';

import { useCircle } from '../../src/circles/CircleProvider';
import { circleDisplayName } from '../../src/circles/activeCircle';
import { useIsOnline } from '../../src/lib/online';
import { getSupabaseClient } from '../../src/lib/supabase';
import { undoCopy } from '../../src/meds/checkoffSentence';
import { MedHistorySheet } from '../../src/meds/components/MedHistorySheet';
import { MedSheet } from '../../src/meds/components/MedSheet';
import { MedsView, type MedsProblem } from '../../src/meds/components/MedsView';
import type { CheckOff, DoseSlot, Medication } from '../../src/meds/doseSlots';
import { doseDateOf } from '../../src/meds/doseSlots';
import type { MedicationHistoryEntry } from '../../src/meds/historySentence';
import {
  archiveMedication,
  loadMedicationHistory,
  medProblemCopy,
  saveMedication,
  tickDose,
  untickDose,
} from '../../src/meds/medActions';
import { canReadMedHistory } from '../../src/meds/medHistoryAccess';
import { EMPTY_MED_VALUES, valuesOf, type MedValues } from '../../src/meds/medValidation';
import {
  medicationFromValues,
  pendingId,
  withCheckOff,
  withMedication,
  withReplacedCheckOff,
  withoutCheckOff,
  withoutMedication,
} from '../../src/meds/optimistic';
import { useMeds } from '../../src/meds/useMeds';

type SheetState =
  | { readonly kind: 'none' }
  | { readonly kind: 'add'; readonly initial: MedValues }
  | {
      readonly kind: 'edit';
      readonly medication: Medication;
      readonly initial: MedValues;
    };

const NO_SHEET: SheetState = { kind: 'none' };

interface HistoryState {
  readonly medication: Medication | null;
}

/**
 * Does the circle's paid plan have to be read-only?
 *
 * Not yet answerable: a circle drops to `free` when its plan ends, and a circle
 * that has never paid is `free` too, so there is nothing in the data that tells
 * the two apart. The flag arrives with subscriptions (Task 13), which is the task
 * that creates the lapsed state. Until then this is `false` for every circle, and
 * the read-only screen is reviewed through `/meds-preview`, where it is a prop.
 */
const PLAN_LAPSED = false;

export default function MedsScreen() {
  const { active, capabilities } = useCircle();
  const online = useIsOnline();
  const client = getSupabaseClient();
  const circleId = active?.circleId ?? null;
  const today = doseDateOf(new Date());

  const { status, snapshot, reload, apply } = useMeds(circleId, today);

  const [sheet, setSheet] = useState<SheetState>(NO_SHEET);
  const [history, setHistory] = useState<HistoryState | null>(null);
  const [historyStatus, setHistoryStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [historyEntries, setHistoryEntries] = useState<readonly MedicationHistoryEntry[]>([]);
  const [historyRequest, setHistoryRequest] = useState(0);
  const [undoSlot, setUndoSlot] = useState<DoseSlot | null>(null);
  const [archiveTarget, setArchiveTarget] = useState<Medication | null>(null);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<MedsProblem | null>(null);

  const medications = snapshot?.medications ?? [];
  const checkOffs = snapshot?.checkOffs ?? [];

  useEffect(() => {
    if (history === null || client === null || circleId === null) {
      return;
    }

    let cancelled = false;
    setHistoryStatus('loading');

    void loadMedicationHistory(client, circleId, history.medication?.id ?? null)
      .then((entries) => {
        if (cancelled) {
          return;
        }

        if (entries === null) {
          setHistoryStatus('error');
          return;
        }

        setHistoryEntries(entries);
        setHistoryStatus('ready');
      })
      .catch(() => {
        if (!cancelled) {
          setHistoryStatus('error');
        }
      });

    return () => {
      cancelled = true;
    };
  }, [client, circleId, history, historyRequest]);

  const tick = (slot: DoseSlot) => {
    if (client === null || circleId === null) {
      return;
    }

    if (!online) {
      setProblem(medProblemCopy('offline'));
      return;
    }

    // The optimistic row says "You", because the person tapping knows who they
    // are and a name they cannot verify is worse than none. The real name and the
    // database's own timestamp replace it the moment the insert comes back.
    const tempId = pendingId('tick');
    const optimistic: CheckOff = {
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
  };

  const undo = (slot: DoseSlot) => {
    if (client === null || slot.checkOff === null) {
      return;
    }

    const checkOff = slot.checkOff;
    setUndoSlot(null);
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
  };

  const save = (values: MedValues) => {
    if (client === null || circleId === null || snapshot === null) {
      return;
    }

    const careRecipientId = snapshot.careRecipientId;

    if (careRecipientId === null) {
      setSheet(NO_SHEET);
      setProblem({
        title: 'Nobody to add it to',
        message:
          'This circle doesn’t have the person you’re caring for yet. Add them on the profile, then come back to the medicine list.',
      });
      return;
    }

    const editing = sheet.kind === 'edit' ? sheet.medication : null;
    const before = snapshot;
    const painted = medicationFromValues(values, {
      id: editing?.id ?? pendingId('med'),
      circleId,
      careRecipientId,
      previous: editing,
    });

    setProblem(null);
    apply((current) => withMedication(current, painted));
    setSheet(NO_SHEET);
    setBusy(true);

    void saveMedication(client, {
      circleId,
      careRecipientId,
      medicationId: editing?.id ?? null,
      values,
    })
      .then((result) => {
        setBusy(false);

        if (!result.ok) {
          // Put the list back, say one calm sentence, and hand the sheet its words
          // again so nothing has to be retyped.
          apply(() => before);
          setProblem(medProblemCopy(result.problem));
          setSheet(
            editing === null
              ? { kind: 'add', initial: values }
              : { kind: 'edit', medication: editing, initial: values },
          );
          return;
        }

        reload();
      })
      .catch(() => {
        setBusy(false);
        apply(() => before);
        setProblem(medProblemCopy('unknown'));
        setSheet(
          editing === null
            ? { kind: 'add', initial: values }
            : { kind: 'edit', medication: editing, initial: values },
        );
      });
  };

  const archive = (medication: Medication) => {
    if (client === null) {
      return;
    }

    setArchiveTarget(null);
    setProblem(null);
    apply((current) => withoutMedication(current, medication.id));

    void archiveMedication(client, medication.id)
      .then((result) => {
        if (!result.ok) {
          apply((current) => withMedication(current, medication));
          setProblem(medProblemCopy(result.problem));
        }
      })
      .catch(() => {
        apply((current) => withMedication(current, medication));
        setProblem(medProblemCopy('unknown'));
      });
  };

  // One copy object for the undo question, computed once: the sheet, its title
  // and its message must never disagree about which dose is being undone.
  const undoMessage =
    undoSlot === null || undoSlot.checkOff === null
      ? null
      : undoCopy({
          medicationName: undoSlot.medicationName,
          doseTime: undoSlot.doseTime,
          checkOff: undoSlot.checkOff,
        });

  return (
    <>
      <MedsView
        canReadHistory={canReadMedHistory(capabilities)}
        capabilities={capabilities}
        checkOffs={checkOffs}
        circleName={active === null ? 'Your circle' : circleDisplayName(active)}
        loadState={status}
        medications={medications}
        offline={!online}
        onAdd={() => {
          setSheet({ kind: 'add', initial: EMPTY_MED_VALUES });
        }}
        onEdit={(medication) => {
          setSheet({ kind: 'edit', medication, initial: valuesOf(medication) });
        }}
        onOpenHistory={(medication) => {
          setHistory({ medication });
          setHistoryRequest((current) => current + 1);
        }}
        onRetry={reload}
        onTick={tick}
        onUndo={(slot) => {
          setUndoSlot(slot);
        }}
        planLapsed={PLAN_LAPSED}
        problem={problem}
        today={today}
      />

      {sheet.kind === 'none' ? null : (
        <MedSheet
          busy={busy}
          initial={sheet.initial}
          key={sheet.kind === 'edit' ? `edit-${sheet.medication.id}` : 'add'}
          mode={sheet.kind === 'edit' ? 'edit' : 'add'}
          onArchive={() => {
            if (sheet.kind === 'edit') {
              setSheet(NO_SHEET);
              setArchiveTarget(sheet.medication);
            }
          }}
          onClose={() => {
            setSheet(NO_SHEET);
          }}
          onSave={save}
          planLapsed={PLAN_LAPSED}
          visible
        />
      )}

      <MedHistorySheet
        entries={historyEntries}
        loadState={historyStatus}
        medicationName={history?.medication?.name ?? null}
        onClose={() => {
          setHistory(null);
        }}
        onRetry={() => {
          setHistoryRequest((current) => current + 1);
        }}
        visible={history !== null}
      />

      <ConfirmSheet
        confirmLabel={undoMessage?.confirmLabel ?? 'Undo the tick'}
        destructive
        message={undoMessage?.message ?? ''}
        onClose={() => {
          setUndoSlot(null);
        }}
        onConfirm={() => {
          if (undoSlot !== null) {
            undo(undoSlot);
          }
        }}
        testID="meds-undo-confirm"
        title={undoMessage?.title ?? 'Undo this tick?'}
        visible={undoSlot !== null}
      />

      <ConfirmSheet
        confirmLabel="Archive it"
        destructive
        message={
          archiveTarget === null
            ? ''
            : `${archiveTarget.name} comes off the list. Its times, its ticks and its whole change history stay exactly where they are, and it can be brought back.`
        }
        onClose={() => {
          setArchiveTarget(null);
        }}
        onConfirm={() => {
          if (archiveTarget !== null) {
            archive(archiveTarget);
          }
        }}
        testID="meds-archive-confirm"
        title="Archive this medicine?"
        visible={archiveTarget !== null}
      />
    </>
  );
}
