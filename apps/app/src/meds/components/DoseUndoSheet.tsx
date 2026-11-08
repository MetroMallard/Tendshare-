/**
 * The question asked before a tick is taken back.
 *
 * It exists because the undo is a **delete**: a check-off has no update path, so
 * undoing a mistake removes the row and puts the dose back to "not taken". The
 * message names the dose and who ticked it, and says the change history keeps
 * both facts — because a family that undoes a tick is usually settling an
 * argument, and the record is the thing that settles it.
 */
import { ConfirmSheet } from '@tendshare/ui';

import type { DoseTicks } from '../useDoseTicks';

export function DoseUndoSheet({ ticks }: { readonly ticks: DoseTicks }) {
  return (
    <ConfirmSheet
      confirmLabel={ticks.undoCopy?.confirmLabel ?? 'Undo the tick'}
      destructive
      message={ticks.undoCopy?.message ?? ''}
      onClose={ticks.cancelUndo}
      onConfirm={ticks.confirmUndo}
      testID="meds-undo-confirm"
      title={ticks.undoCopy?.title ?? 'Undo this tick?'}
      visible={ticks.undoSlot !== null}
    />
  );
}
