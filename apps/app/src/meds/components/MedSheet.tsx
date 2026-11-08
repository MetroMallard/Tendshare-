/**
 * Adding and changing a medicine.
 *
 * One sheet, two modes, because a medicine is the same six answers whether it is
 * new or old: what it is called, what it says on the box, what the family wants
 * written down, when it is taken, and when it starts, ends and needs a refill.
 *
 * What this sheet will never do:
 *
 *   * **advise.** Every field is a notebook entry. The strength and form hints
 *     say "as it is on the box" and nothing else; there is no list to pick from,
 *     no "usual" value, no check against anything;
 *   * **delete.** Archiving sets `archived_at`, so the row, its times, its ticks
 *     and its whole change history stay exactly where they are. The sheet says so
 *     under the button, because a family deciding whether to archive a parent's
 *     medicine deserves to know what they keep;
 *   * **guess.** Errors sit under the field they belong to, and a save that fails
 *     keeps every word that was typed.
 *
 * The parent remounts the sheet with a new `key` each time it opens, so the text
 * in here is always the medicine as it was when the sheet opened.
 */
import { useState } from 'react';
import { View } from 'react-native';

import { Button, Field, Sheet, Text, TextField, useTheme } from '@tendshare/ui';

import {
  EMPTY_MED_VALUES,
  MAX_TIMES,
  hasErrors,
  validateMedication,
  type FieldErrors,
  type MedField,
  type MedValues,
} from '../medValidation';

export interface MedSheetProps {
  readonly visible: boolean;
  readonly busy: boolean;
  readonly mode: 'add' | 'edit';
  readonly initial: MedValues;
  /** A circle whose plan ended: refill reminders are the paid extra, so read-only. */
  readonly planLapsed: boolean;
  readonly onClose: () => void;
  readonly onSave: (values: MedValues) => void;
  /** Opens the confirm sheet in the parent. Never archives on the spot. */
  readonly onArchive: () => void;
  readonly testID?: string;
}

export function MedSheet({
  visible,
  busy,
  mode,
  initial,
  planLapsed,
  onClose,
  onSave,
  onArchive,
  testID = 'med-sheet',
}: MedSheetProps) {
  const theme = useTheme();
  const [values, setValues] = useState<MedValues>(initial);
  const [errors, setErrors] = useState<FieldErrors<MedField>>({});

  const update = (field: MedField) => (text: string) => {
    setValues((current) => ({ ...current, [field]: text }));
    setErrors((current) => ({ ...current, [field]: undefined }));
  };

  const updateTime = (index: number) => (text: string) => {
    setValues((current) => ({
      ...current,
      times: current.times.map((time, position) => (position === index ? text : time)),
    }));
    setErrors((current) => ({ ...current, times: undefined }));
  };

  const addTime = () => {
    setValues((current) => ({ ...current, times: [...current.times, ''] }));
  };

  const removeTime = (index: number) => {
    setValues((current) => ({
      ...current,
      // Never leave the editor with no rows: an empty row is how a family is
      // asked for a time, and removing the last one would leave nothing to type in.
      times: current.times.length === 1 ? [''] : current.times.filter((_, i) => i !== index),
    }));
  };

  const submit = () => {
    const found = validateMedication(values);

    if (hasErrors(found)) {
      setErrors(found);
      return;
    }

    onSave(values);
  };

  const editing = mode === 'edit';

  return (
    <Sheet
      description={
        editing
          ? 'Change what is written here. Nothing is checked against anything else.'
          : 'Write each answer the way it appears on the box. Nothing here is checked against anything else.'
      }
      footer={
        <View style={{ gap: theme.space.xs }}>
          <Button
            fullWidth
            label={editing ? 'Save changes' : 'Add medicine'}
            loading={busy}
            loadingLabel="Saving"
            onPress={submit}
            testID={`${testID}-save`}
          />
          <Button
            disabled={busy}
            fullWidth
            label="Cancel"
            onPress={onClose}
            testID={`${testID}-cancel`}
            variant="secondary"
          />
          {editing ? (
            <>
              <Button
                accessibilityHint="Opens a question before archiving this medicine."
                disabled={busy}
                fullWidth
                label="Archive this medicine"
                onPress={onArchive}
                testID={`${testID}-archive`}
                variant="destructive"
              />
              <Text align="center" tone="tertiary" variant="caption">
                Archiving takes it off the list and keeps everything else — its times, its
                ticks and its whole change history stay.
              </Text>
            </>
          ) : null}
        </View>
      }
      onClose={onClose}
      testID={testID}
      title={editing ? 'Edit medicine' : 'Add a medicine'}
      visible={visible}
    >
      <View style={{ gap: theme.space.sm }}>
        <TextField
          autoCapitalize="words"
          autoCorrect={false}
          editable={!busy}
          error={errors.name}
          hint="Exactly as it is on the box."
          label="Name"
          maxLength={120}
          onChangeText={update('name')}
          testID={`${testID}-name`}
          value={values.name}
        />

        <TextField
          autoCapitalize="none"
          autoCorrect={false}
          editable={!busy}
          error={errors.strength}
          hint="As it is written on the box — 500 mg."
          label="Strength"
          maxLength={60}
          onChangeText={update('strength')}
          optional
          testID={`${testID}-strength`}
          value={values.strength}
        />

        <TextField
          autoCapitalize="none"
          autoCorrect={false}
          editable={!busy}
          error={errors.form}
          hint="Tablet, capsule, liquid — whatever your family calls it."
          label="Form"
          maxLength={60}
          onChangeText={update('form')}
          optional
          testID={`${testID}-form`}
          value={values.form}
        />

        <TextField
          autoCapitalize="sentences"
          editable={!busy}
          error={errors.instructions}
          hint="Anything the family wants written down. Not medical advice — just your words."
          label="Instructions"
          maxLength={1000}
          multiline
          numberOfLines={3}
          onChangeText={update('instructions')}
          optional
          testID={`${testID}-instructions`}
          textAlignVertical="top"
          value={values.instructions}
        />

        <Field
          error={errors.times}
          hint="One row per time of day — 8:00, or 8:00 am."
          label="Times"
          testID={`${testID}-times`}
        >
          <View style={{ gap: theme.space.xs }}>
            {values.times.map((time, index) => (
              <View
                key={`time-${String(index)}`}
                style={{ alignItems: 'flex-end', flexDirection: 'row', gap: theme.space.xs }}
              >
                <View style={{ flex: 1 }}>
                  <TextField
                    autoCapitalize="none"
                    autoCorrect={false}
                    editable={!busy}
                    inputMode="numeric"
                    label={`Time ${String(index + 1)}`}
                    maxLength={8}
                    onChangeText={updateTime(index)}
                    placeholder="8:00"
                    testID={`${testID}-time-${String(index)}`}
                    value={time}
                  />
                </View>
                {values.times.length > 1 ? (
                  <Button
                    accessibilityHint={`Removes time ${String(index + 1)}.`}
                    disabled={busy}
                    label="Remove"
                    onPress={() => {
                      removeTime(index);
                    }}
                    size="small"
                    testID={`${testID}-time-${String(index)}-remove`}
                    variant="ghost"
                  />
                ) : null}
              </View>
            ))}

            {values.times.length < MAX_TIMES ? (
              <Button
                disabled={busy}
                fullWidth
                label="Add another time"
                onPress={addTime}
                testID={`${testID}-add-time`}
                variant="secondary"
              />
            ) : null}
          </View>
        </Field>

        <TextField
          autoCapitalize="none"
          autoCorrect={false}
          editable={!busy}
          error={errors.startsOn}
          hint="Year, month and day — 2026-03-12."
          inputMode="numeric"
          label="Start date"
          maxLength={10}
          onChangeText={update('startsOn')}
          optional
          placeholder="2026-03-12"
          testID={`${testID}-starts-on`}
          value={values.startsOn}
        />

        <TextField
          autoCapitalize="none"
          autoCorrect={false}
          editable={!busy}
          error={errors.endsOn}
          hint="Leave it blank if it is open-ended."
          inputMode="numeric"
          label="End date"
          maxLength={10}
          onChangeText={update('endsOn')}
          optional
          placeholder="2026-06-12"
          testID={`${testID}-ends-on`}
          value={values.endsOn}
        />

        <TextField
          autoCapitalize="none"
          autoCorrect={false}
          editable={!busy && !planLapsed}
          error={errors.refillDueOn}
          hint={
            planLapsed
              ? 'Refill reminders are part of the Family plan. The date is kept exactly as it is.'
              : 'The day the family would collect a refill.'
          }
          inputMode="numeric"
          label="Refill date"
          maxLength={10}
          onChangeText={update('refillDueOn')}
          optional
          placeholder="2026-04-02"
          testID={`${testID}-refill-due`}
          value={values.refillDueOn}
        />

        <TextField
          autoCapitalize="none"
          autoCorrect={false}
          editable={!busy && !planLapsed}
          error={errors.refillReminderDays}
          hint={
            planLapsed
              ? 'Read-only while the plan has ended.'
              : 'How many days before the refill date to show it on the list. 0 for no reminder.'
          }
          inputMode="numeric"
          label="Remind me before"
          maxLength={2}
          onChangeText={update('refillReminderDays')}
          optional
          testID={`${testID}-refill-days`}
          value={values.refillReminderDays}
        />
      </View>
    </Sheet>
  );
}

/** The values a brand-new sheet opens with. Exported so the screen and the preview agree. */
export const NEW_MED_VALUES = EMPTY_MED_VALUES;
