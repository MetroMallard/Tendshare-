/**
 * The change history, in plain sentences.
 *
 * "Sara changed strength, 6 Nov". "Priya ticked the 1:00 pm dose, 7 Nov". "Tom
 * undid a tick, 7 Nov". Nothing else — because nothing else is what the server
 * sends. `medication_history()` returns field *names*, never values, so this
 * sheet can say what changed and cannot say what it was before or after. It does
 * not try, and it does not apologise for the gap in every row: the sheet's one
 * description line says it once.
 *
 * A visiting helper never opens this: the screen does not offer it, and the
 * database refuses the function for that role outright.
 */
import { History } from 'lucide-react-native';
import { View } from 'react-native';

import { Button, EmptyState, Sheet, Skeleton, Text, useTheme } from '@tendshare/ui';

import { historyEmptyCopy, historySentence, type MedicationHistoryEntry } from '../historySentence';

export interface MedHistorySheetProps {
  readonly visible: boolean;
  /** `null` for the whole circle; a medicine's name when it is about one. */
  readonly medicationName: string | null;
  readonly loadState: 'loading' | 'ready' | 'error';
  readonly entries: readonly MedicationHistoryEntry[];
  readonly onClose: () => void;
  readonly onRetry: () => void;
  readonly testID?: string;
}

export function MedHistorySheet({
  visible,
  medicationName,
  loadState,
  entries,
  onClose,
  onRetry,
  testID = 'med-history-sheet',
}: MedHistorySheetProps) {
  const theme = useTheme();
  const empty = historyEmptyCopy(medicationName);

  return (
    <Sheet
      description="Who changed what, and who ticked which dose. Field names only — the values themselves are never kept here."
      footer={
        <Button
          fullWidth
          label="Close"
          onPress={onClose}
          testID={`${testID}-close`}
          variant="secondary"
        />
      }
      onClose={onClose}
      testID={testID}
      title={medicationName === null ? 'Change history' : `Change history · ${medicationName}`}
      visible={visible}
    >
      {loadState === 'loading' ? (
        <View style={{ gap: theme.space.sm }} testID={`${testID}-loading`}>
          <Skeleton lines={2} />
          <Skeleton lines={2} />
          <Skeleton lines={2} />
        </View>
      ) : loadState === 'error' ? (
        <View testID={`${testID}-error`}>
          <EmptyState
            actionLabel="Try again"
            body="We couldn’t read the change history just now. Nothing has changed."
            headline="We couldn’t load the history"
            icon={History}
            onAction={onRetry}
          />
        </View>
      ) : entries.length === 0 ? (
        <View testID={`${testID}-empty`}>
          <EmptyState body={empty.body} headline={empty.headline} icon={History} />
        </View>
      ) : (
        <View testID={`${testID}-list`}>
          {entries.map((entry, index) => (
            <View
              key={`${entry.occurredAt}-${String(index)}`}
              style={{
                borderColor: theme.colors.border,
                borderTopWidth: index > 0 ? 1 : 0,
                paddingVertical: theme.space.xs,
              }}
              testID={`${testID}-row-${String(index)}`}
            >
              <Text variant="body">{historySentence(entry)}</Text>
            </View>
          ))}
        </View>
      )}
    </Sheet>
  );
}
