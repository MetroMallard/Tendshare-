/**
 * The four sheets that edit a person's profile.
 *
 * One sheet per kind of row, because they are four different forms with four
 * different rules — a doctor needs a name, a card needs a plan name, an allergy
 * needs the family's own words — and a single clever form for all of them would
 * be a worse screen for every one of them.
 *
 * What they share is the shape: a form that validates before it saves, says which
 * field is wrong under that field, and keeps its own text while the write is in
 * flight. The parent owns the write, the optimistic row and the rollback; the
 * sheet owns nothing but what was typed.
 *
 * The parent remounts a sheet with a new `key` each time it opens, so the text in
 * here is always the row as it was when the sheet opened — never a stale draft
 * from the last time somebody edited something else.
 */
import { useState } from 'react';
import { View } from 'react-native';

import { Badge, Button, Sheet, Switch, Text, TextField, useTheme } from '@tendshare/ui';

import type {
  CareContact,
  CareCondition,
  ContactKind,
  ConditionKind,
  InsuranceCard,
} from '../profileData';
import { CONTACT_KIND_LABELS, CONDITION_KIND_LABELS } from '../profileData';
import {
  ADDRESS_MAX_LENGTH,
  BASICS_NOTES_MAX_LENGTH,
  hasErrors,
  MEMBER_ID_MAX_LENGTH,
  NAME_MAX_LENGTH,
  NOTES_MAX_LENGTH,
  PHONE_MAX_LENGTH,
  PLAN_MAX_LENGTH,
  validateBasics,
  validateCondition,
  validateContact,
  validateInsurance,
  type BasicsField,
  type BasicsValues,
  type ConditionField,
  type ContactField,
  type ContactValues,
  type FieldErrors,
  type InsuranceField,
  type InsuranceValues,
} from '../validation';

/** What a sheet's footer does while a write is in flight. */
export interface SheetActionsProps {
  readonly busy: boolean;
  readonly onClose: () => void;
  readonly onSave: () => void;
  readonly onDelete?: () => void;
  readonly saveLabel?: string;
  readonly deleteLabel?: string;
  readonly testID?: string;
}

/**
 * Save, cancel, and — when the row already exists — delete.
 *
 * Delete is at the bottom, in the destructive variant, and it opens a confirm
 * sheet rather than deleting: three destructive buttons in a column is how people
 * lose a doctor by accident.
 */
export function SheetActions({
  busy,
  onClose,
  onSave,
  onDelete,
  saveLabel = 'Save',
  deleteLabel = 'Delete',
  testID = 'sheet-actions',
}: SheetActionsProps) {
  const theme = useTheme();

  return (
    <View style={{ gap: theme.space.xs }} testID={testID}>
      <Button
        fullWidth
        label={saveLabel}
        loading={busy}
        loadingLabel="Saving"
        onPress={onSave}
        testID={`${testID}-save`}
      />
      <Button
        fullWidth
        label="Cancel"
        onPress={onClose}
        testID={`${testID}-cancel`}
        variant="secondary"
      />
      {onDelete === undefined ? null : (
        <Button
          fullWidth
          label={deleteLabel}
          onPress={onDelete}
          testID={`${testID}-delete`}
          variant="destructive"
        />
      )}
    </View>
  );
}

// ---------------------------------------------------------------------------
// The basics
// ---------------------------------------------------------------------------

export interface BasicsSheetProps {
  readonly visible: boolean;
  readonly busy: boolean;
  readonly initial: BasicsValues;
  readonly onClose: () => void;
  readonly onSave: (values: BasicsValues) => void;
  readonly testID?: string;
}

export function BasicsSheet({
  visible,
  busy,
  initial,
  onClose,
  onSave,
  testID = 'profile-basics-sheet',
}: BasicsSheetProps) {
  const [values, setValues] = useState<BasicsValues>(initial);
  const [errors, setErrors] = useState<FieldErrors<BasicsField>>({});

  const update = (field: BasicsField) => (text: string) => {
    setValues((current) => ({ ...current, [field]: text }));
    setErrors((current) => ({ ...current, [field]: undefined }));
  };

  const submit = () => {
    const found = validateBasics(values);

    if (hasErrors(found)) {
      setErrors(found);
      return;
    }

    onSave(values);
  };

  return (
    <Sheet
      description="Whatever you know. Anything you leave blank just stays blank."
      footer={
        <SheetActions busy={busy} onClose={onClose} onSave={submit} testID="profile-basics" />
      }
      onClose={onClose}
      testID={testID}
      title="The basics"
      visible={visible}
    >
      <TextField
        autoCapitalize="words"
        error={errors.fullName}
        label="Full name"
        maxLength={NAME_MAX_LENGTH}
        onChangeText={update('fullName')}
        returnKeyType="next"
        testID="profile-basics-full-name"
        value={values.fullName}
      />
      <TextField
        autoCapitalize="words"
        error={errors.preferredName}
        hint="What the family actually calls them."
        label="Preferred name"
        maxLength={80}
        onChangeText={update('preferredName')}
        optional
        placeholder="Mum"
        testID="profile-basics-preferred-name"
        value={values.preferredName}
      />
      <TextField
        autoCapitalize="words"
        error={errors.relationship}
        hint="Mother, father, aunt, a friend."
        label="Relationship"
        maxLength={60}
        onChangeText={update('relationship')}
        optional
        placeholder="Mother"
        testID="profile-basics-relationship"
        value={values.relationship}
      />
      <TextField
        autoCapitalize="none"
        autoCorrect={false}
        error={errors.dateOfBirth}
        hint="Year, month and day — 1942-03-12."
        inputMode="numeric"
        label="Date of birth"
        maxLength={10}
        onChangeText={update('dateOfBirth')}
        optional
        placeholder="1942-03-12"
        testID="profile-basics-dob"
        value={values.dateOfBirth}
      />
      <TextField
        autoCapitalize="none"
        error={errors.phone}
        hint="The number you would hand a doctor."
        keyboardType="phone-pad"
        label="Phone"
        maxLength={PHONE_MAX_LENGTH}
        onChangeText={update('phone')}
        optional
        placeholder="+44 7700 900123"
        testID="profile-basics-phone"
        value={values.phone}
      />
      <TextField
        error={errors.notes}
        hint="Anything the family wants written down. Not medical advice — just your words."
        label="A note from the family"
        maxLength={BASICS_NOTES_MAX_LENGTH}
        multiline
        numberOfLines={4}
        onChangeText={update('notes')}
        optional
        testID="profile-basics-notes"
        value={values.notes}
      />
    </Sheet>
  );
}

// ---------------------------------------------------------------------------
// Doctors and pharmacies
// ---------------------------------------------------------------------------

export interface ContactSheetProps {
  readonly visible: boolean;
  readonly busy: boolean;
  readonly kind: ContactKind;
  /** `null` when adding. */
  readonly contact: CareContact | null;
  readonly onClose: () => void;
  readonly onSave: (values: ContactValues, isPrimary: boolean) => void;
  readonly onDelete?: () => void;
  readonly testID?: string;
}

/** What each kind of contact is called on screen. */
const CONTACT_TITLES: Readonly<Record<ContactKind, { add: string; edit: string; name: string }>> = {
  doctor: { add: 'Add a doctor', edit: 'Edit this doctor', name: 'Doctor’s name' },
  pharmacy: { add: 'Add a pharmacy', edit: 'Edit this pharmacy', name: 'Pharmacy’s name' },
  other: { add: 'Add a contact', edit: 'Edit this contact', name: 'Name' },
};

export function ContactSheet({
  visible,
  busy,
  kind,
  contact,
  onClose,
  onSave,
  onDelete,
  testID = 'profile-contact-sheet',
}: ContactSheetProps) {
  const [values, setValues] = useState<ContactValues>({
    name: contact?.name ?? '',
    organisation: contact?.organisation ?? '',
    phone: contact?.phone ?? '',
    address: contact?.address ?? '',
    notes: contact?.notes ?? '',
  });
  const [isPrimary, setIsPrimary] = useState(contact?.isPrimary ?? false);
  const [errors, setErrors] = useState<FieldErrors<ContactField>>({});

  const update = (field: ContactField) => (text: string) => {
    setValues((current) => ({ ...current, [field]: text }));
    setErrors((current) => ({ ...current, [field]: undefined }));
  };

  const submit = () => {
    const found = validateContact(values);

    if (hasErrors(found)) {
      setErrors(found);
      return;
    }

    onSave(values, isPrimary);
  };

  const titles = CONTACT_TITLES[kind];

  return (
    <Sheet
      description={`${CONTACT_KIND_LABELS[kind]} — only what your family knows.`}
      footer={
        <SheetActions
          busy={busy}
          deleteLabel="Remove this contact"
          onClose={onClose}
          onDelete={contact === null ? undefined : onDelete}
          onSave={submit}
          saveLabel={contact === null ? 'Add' : 'Save'}
          testID="profile-contact"
        />
      }
      onClose={onClose}
      testID={testID}
      title={contact === null ? titles.add : titles.edit}
      visible={visible}
    >
      <TextField
        autoCapitalize="words"
        error={errors.name}
        label={titles.name}
        maxLength={NAME_MAX_LENGTH}
        onChangeText={update('name')}
        placeholder="Dr Patel"
        testID="profile-contact-name"
        value={values.name}
      />
      <TextField
        autoCapitalize="words"
        error={errors.organisation}
        hint="The practice, the hospital, the shop."
        label="Organisation"
        maxLength={NAME_MAX_LENGTH}
        onChangeText={update('organisation')}
        optional
        testID="profile-contact-organisation"
        value={values.organisation}
      />
      <TextField
        autoCapitalize="none"
        error={errors.phone}
        keyboardType="phone-pad"
        label="Phone"
        maxLength={PHONE_MAX_LENGTH}
        onChangeText={update('phone')}
        optional
        testID="profile-contact-phone"
        value={values.phone}
      />
      <TextField
        autoCapitalize="words"
        error={errors.address}
        label="Address"
        maxLength={ADDRESS_MAX_LENGTH}
        multiline
        numberOfLines={3}
        onChangeText={update('address')}
        optional
        testID="profile-contact-address"
        value={values.address}
      />
      <TextField
        error={errors.notes}
        hint="Opening hours, a receptionist’s name, which entrance to use."
        label="Note"
        maxLength={NOTES_MAX_LENGTH}
        multiline
        numberOfLines={3}
        onChangeText={update('notes')}
        optional
        testID="profile-contact-notes"
        value={values.notes}
      />
      {kind === 'other' ? null : (
        <Switch
          description={`Shown first in the ${CONTACT_KIND_LABELS[kind].toLowerCase()} list.`}
          label="This is the main one"
          onValueChange={setIsPrimary}
          testID="profile-contact-primary"
          value={isPrimary}
        />
      )}
    </Sheet>
  );
}

// ---------------------------------------------------------------------------
// Allergies and conditions
// ---------------------------------------------------------------------------

export interface ConditionSheetProps {
  readonly visible: boolean;
  readonly busy: boolean;
  readonly kind: ConditionKind;
  /** `null` when adding. */
  readonly condition: CareCondition | null;
  readonly onClose: () => void;
  readonly onSave: (values: { label: string; notes: string }) => void;
  readonly onDelete?: () => void;
  readonly testID?: string;
}

const CONDITION_TITLES: Readonly<
  Record<ConditionKind, { add: string; edit: string; label: string; hint: string }>
> = {
  allergy: {
    add: 'Add an allergy',
    edit: 'Edit this allergy',
    label: 'What are they allergic to?',
    hint: 'As your family says it — “penicillin”, “shellfish”, “the plaster they use”.',
  },
  condition: {
    add: 'Add a condition',
    edit: 'Edit this condition',
    label: 'What do they live with?',
    hint: 'As your family says it. Nothing here is checked or interpreted.',
  },
};

export function ConditionSheet({
  visible,
  busy,
  kind,
  condition,
  onClose,
  onSave,
  onDelete,
  testID = 'profile-condition-sheet',
}: ConditionSheetProps) {
  const [label, setLabel] = useState(condition?.label ?? '');
  const [notes, setNotes] = useState(condition?.notes ?? '');
  const [errors, setErrors] = useState<FieldErrors<ConditionField>>({});

  const submit = () => {
    const found = validateCondition({ label, notes });

    if (hasErrors(found)) {
      setErrors(found);
      return;
    }

    onSave({ label, notes });
  };

  const titles = CONDITION_TITLES[kind];

  return (
    <Sheet
      description={`${CONDITION_KIND_LABELS[kind]} — your family’s own words. This is a notebook, not a medical record.`}
      footer={
        <SheetActions
          busy={busy}
          deleteLabel="Remove this"
          onClose={onClose}
          onDelete={condition === null ? undefined : onDelete}
          onSave={submit}
          saveLabel={condition === null ? 'Add' : 'Save'}
          testID="profile-condition"
        />
      }
      onClose={onClose}
      testID={testID}
      title={condition === null ? titles.add : titles.edit}
      visible={visible}
    >
      <TextField
        error={errors.label}
        hint={titles.hint}
        label={titles.label}
        maxLength={NAME_MAX_LENGTH}
        onChangeText={(text) => {
          setLabel(text);
          setErrors((current) => ({ ...current, label: undefined }));
        }}
        testID="profile-condition-label"
        value={label}
      />
      <TextField
        error={errors.notes}
        hint="Anything else worth knowing. Optional."
        label="Note"
        maxLength={NOTES_MAX_LENGTH}
        multiline
        numberOfLines={3}
        onChangeText={(text) => {
          setNotes(text);
          setErrors((current) => ({ ...current, notes: undefined }));
        }}
        optional
        testID="profile-condition-notes"
        value={notes}
      />
    </Sheet>
  );
}

// ---------------------------------------------------------------------------
// Insurance cards
// ---------------------------------------------------------------------------

export interface InsuranceSheetProps {
  readonly visible: boolean;
  readonly busy: boolean;
  /** `null` when adding. */
  readonly card: InsuranceCard | null;
  /** A card photo already on the row, or one just chosen. */
  readonly hasPhoto: boolean;
  /** True when the photo is not saved yet — the sentence says so. */
  readonly photoPending: boolean;
  readonly photoError: string | null;
  readonly onClose: () => void;
  readonly onSave: (values: InsuranceValues) => void;
  readonly onDelete?: () => void;
  readonly onPickPhoto: () => void;
  readonly onRemovePhoto: () => void;
  readonly testID?: string;
}

export function InsuranceSheet({
  visible,
  busy,
  card,
  hasPhoto,
  photoPending,
  photoError,
  onClose,
  onSave,
  onDelete,
  onPickPhoto,
  onRemovePhoto,
  testID = 'profile-insurance-sheet',
}: InsuranceSheetProps) {
  const theme = useTheme();
  const [values, setValues] = useState<InsuranceValues>({
    planName: card?.planName ?? '',
    memberId: card?.memberId ?? '',
    groupNumber: card?.groupNumber ?? '',
  });
  const [errors, setErrors] = useState<FieldErrors<InsuranceField>>({});

  const update = (field: InsuranceField) => (text: string) => {
    setValues((current) => ({ ...current, [field]: text }));
    setErrors((current) => ({ ...current, [field]: undefined }));
  };

  const submit = () => {
    const found = validateInsurance(values);

    if (hasErrors(found)) {
      setErrors(found);
      return;
    }

    onSave(values);
  };

  return (
    <Sheet
      description="Only the card’s own details, and a photo nobody outside this circle can open."
      footer={
        <SheetActions
          busy={busy}
          deleteLabel="Remove this card"
          onClose={onClose}
          onDelete={card === null ? undefined : onDelete}
          onSave={submit}
          saveLabel={card === null ? 'Add' : 'Save'}
          testID="profile-insurance"
        />
      }
      onClose={onClose}
      testID={testID}
      title={card === null ? 'Add a card' : 'Edit this card'}
      visible={visible}
    >
      <TextField
        autoCapitalize="words"
        error={errors.planName}
        label="Plan name"
        maxLength={PLAN_MAX_LENGTH}
        onChangeText={update('planName')}
        placeholder="Blue Cross PPO"
        testID="profile-insurance-plan"
        value={values.planName}
      />
      <TextField
        autoCapitalize="characters"
        autoCorrect={false}
        error={errors.memberId}
        label="Member ID"
        maxLength={MEMBER_ID_MAX_LENGTH}
        onChangeText={update('memberId')}
        optional
        testID="profile-insurance-member"
        value={values.memberId}
      />
      <TextField
        autoCapitalize="characters"
        autoCorrect={false}
        error={errors.groupNumber}
        label="Group number"
        maxLength={MEMBER_ID_MAX_LENGTH}
        onChangeText={update('groupNumber')}
        optional
        testID="profile-insurance-group"
        value={values.groupNumber}
      />

      <View style={{ gap: theme.space.xs }} testID="profile-insurance-photo">
        <View style={{ alignItems: 'center', flexDirection: 'row', gap: theme.space['2xs'] }}>
          <Text variant="label">A photo of the card</Text>
          {hasPhoto ? (
            <Badge
              label={photoPending ? 'Ready to save' : 'Attached'}
              tone={photoPending ? 'brand' : 'success'}
            />
          ) : null}
        </View>
        <Text tone="secondary" variant="caption">
          {hasPhoto
            ? 'Private to this circle. Opened through a link that expires in five minutes.'
            : 'Straight from your camera roll. Private to this circle.'}
        </Text>
        <Button
          fullWidth
          label={hasPhoto ? 'Choose a different photo' : 'Choose a photo'}
          onPress={onPickPhoto}
          testID="profile-insurance-pick"
          variant="secondary"
        />
        {hasPhoto ? (
          <Button
            fullWidth
            label="Remove the photo"
            onPress={onRemovePhoto}
            testID="profile-insurance-photo-remove"
            variant="ghost"
          />
        ) : null}
        {photoError === null ? null : (
          <Text tone="danger" variant="caption">
            {photoError}
          </Text>
        )}
      </View>
    </Sheet>
  );
}
