import { useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';

import { Card, ConfirmSheet, EmptyState, ScreenHeader } from '@tendshare/ui';
import { HeartHandshake } from 'lucide-react-native';

import { Screen } from '../src/components/Screen';
import { useSession } from '../src/auth/session';
import { useCircle } from '../src/circles/CircleProvider';
import { circleDisplayName } from '../src/circles/activeCircle';
import { getSupabaseClient } from '../src/lib/supabase';
import { useIsOnline } from '../src/lib/online';
import { ProfileView } from '../src/profile/components/ProfileView';
import {
  BasicsSheet,
  ConditionSheet,
  ContactSheet,
  InsuranceSheet,
} from '../src/profile/components/ProfileSheets';
import { changedFields } from '../src/profile/diff';
import { PICK_REFUSAL_COPY, pickImage, type PickedImage } from '../src/profile/picker';
import {
  deleteCondition,
  deleteContact,
  deleteInsurance,
  profileProblemCopy,
  removeCareImage,
  saveBasics,
  saveCondition,
  saveContact,
  saveInsurance,
  uploadCareImage,
  type BasicsPatch,
  type ProfileProblem,
} from '../src/profile/profileActions';
import {
  loadCareProfile,
  type CareBasics,
  type CareCondition,
  type CareProfile,
  type CareContact,
  type ContactKind,
  type ConditionKind,
  type InsuranceCard,
} from '../src/profile/profileData';
import { buildPath, signCareMediaPath } from '../src/profile/storage';
import { emptyToNull } from '../src/profile/validation';
import type { BasicsValues } from '../src/profile/validation';

/**
 * The person's profile, wired to the database.
 *
 * The screen is `ProfileView`; everything in this file is the part that cannot be
 * drawn — the read, the signed photo URLs, the writes, and the optimistic row
 * that goes back where it was when a write is refused.
 *
 * ## Optimistic, and visibly so
 *
 * Every save paints the change first and closes the sheet, because a form that
 * waits for a round trip on a kitchen wifi feels broken. If the database says no,
 * the change is put back **and the reason is said out loud** above the sections:
 * a row that quietly reappears is worse than one that never moved, because the
 * person cannot tell whether they did something wrong.
 *
 * ## Where the audit trail comes from
 *
 * Nowhere in this file. The triggers in `20261106120000_care_recipient_profile.sql`
 * write the trail in the same transaction as the change, with field names only.
 * The app could write a row of its own here; it must not, because a client that
 * can write the log can write the wrong thing into it.
 */
type SheetState =
  | { readonly kind: 'none' }
  | { readonly kind: 'basics' }
  | {
      readonly kind: 'contact';
      readonly contactKind: ContactKind;
      readonly contact: CareContact | null;
    }
  | {
      readonly kind: 'condition';
      readonly conditionKind: ConditionKind;
      readonly condition: CareCondition | null;
    }
  | { readonly kind: 'insurance'; readonly card: InsuranceCard | null };

const NO_SHEET: SheetState = { kind: 'none' };

const BASICS_FIELDS = [
  'full_name',
  'preferred_name',
  'relationship',
  'date_of_birth',
  'phone',
  'notes',
] as const;

/** The patch for the basics: only what changed, trimmed, `""` as `null`. */
function basicsPatchOf(basics: CareBasics, values: BasicsValues): BasicsPatch {
  const changed = changedFields(
    {
      full_name: basics.fullName,
      preferred_name: basics.preferredName,
      relationship: basics.relationship,
      date_of_birth: basics.dateOfBirth,
      phone: basics.phone,
      notes: basics.notes,
    },
    {
      full_name: values.fullName,
      preferred_name: values.preferredName,
      relationship: values.relationship,
      date_of_birth: values.dateOfBirth,
      phone: values.phone,
      notes: values.notes,
    },
    BASICS_FIELDS,
  );

  // Built in one expression rather than assigned field by field: the patch is
  // `readonly`, and a column that did not change must not appear in it at all.
  return {
    ...(changed.includes('full_name') ? { full_name: values.fullName.trim() } : {}),
    ...(changed.includes('preferred_name')
      ? { preferred_name: emptyToNull(values.preferredName) }
      : {}),
    ...(changed.includes('relationship') ? { relationship: emptyToNull(values.relationship) } : {}),
    ...(changed.includes('date_of_birth')
      ? { date_of_birth: emptyToNull(values.dateOfBirth) }
      : {}),
    ...(changed.includes('phone') ? { phone: emptyToNull(values.phone) } : {}),
    ...(changed.includes('notes') ? { notes: emptyToNull(values.notes) } : {}),
  };
}

/** The basics as the screen shows them, after an optimistic save. */
function basicsAfter(basics: CareBasics, values: BasicsValues): CareBasics {
  return {
    ...basics,
    fullName: values.fullName.trim(),
    preferredName: emptyToNull(values.preferredName),
    relationship: emptyToNull(values.relationship),
    dateOfBirth: emptyToNull(values.dateOfBirth),
    phone: emptyToNull(values.phone),
    notes: emptyToNull(values.notes),
  };
}

export default function ProfileScreen() {
  const router = useRouter();
  const client = getSupabaseClient();
  const { user } = useSession();
  const { active, capabilities, circlesState } = useCircle();
  const online = useIsOnline();

  const [profile, setProfile] = useState<CareProfile | null>(null);
  const [loadState, setLoadState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [request, setRequest] = useState(0);
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [cardUrls, setCardUrls] = useState<Readonly<Record<string, string>>>({});
  const [problem, setProblem] = useState<ProfileProblem | null>(null);
  /** A refusal from the photo picker: its own sentence, above the sections. */
  const [photoProblem, setPhotoProblem] = useState<{ title: string; message: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const [sheet, setSheet] = useState<SheetState>(NO_SHEET);
  const [sheetKey, setSheetKey] = useState(0);
  const [confirming, setConfirming] = useState<{
    readonly table: 'contact' | 'condition' | 'insurance';
    readonly id: string;
    readonly name: string;
  } | null>(null);

  // The card photo, held here because it is bytes: the sheet chooses it, the
  // screen uploads it after the row it belongs to exists.
  const [pickedPhoto, setPickedPhoto] = useState<PickedImage | null>(null);
  const [photoRemoved, setPhotoRemoved] = useState(false);
  const [photoError, setPhotoError] = useState<string | null>(null);

  const circleId = active?.circleId ?? null;
  const selfId = user?.id ?? '';
  const basics = profile?.basics ?? null;

  useEffect(() => {
    if (client === null || circleId === null || selfId === '') {
      setLoadState(circlesState === 'error' ? 'error' : 'loading');
      return;
    }

    let cancelled = false;
    setLoadState('loading');

    void (async () => {
      const loaded = await loadCareProfile(client, circleId);

      if (cancelled) {
        return;
      }

      if (loaded === null) {
        setLoadState('error');
        return;
      }

      setProfile(loaded);
      setLoadState('ready');

      // Signed URLs are fetched after the rows, never stored: a path is what the
      // database holds, and a URL that outlives five minutes is a link nobody
      // can revoke.
      if (loaded.basics?.photoPath !== null && loaded.basics?.photoPath !== undefined) {
        const signed = await signCareMediaPath(client, loaded.basics.photoPath);

        if (!cancelled && signed !== null) {
          setPhotoUrl(signed.url);
        }
      }

      const urls: Record<string, string> = {};

      for (const card of loaded.insurance) {
        if (card.imagePath === null) {
          continue;
        }

        const signed = await signCareMediaPath(client, card.imagePath);

        if (signed !== null) {
          urls[card.id] = signed.url;
        }
      }

      if (!cancelled) {
        setCardUrls(urls);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [client, circleId, selfId, request, circlesState]);

  const reload = useCallback(() => {
    setRequest((count) => count + 1);
  }, []);

  const goBack = useCallback(() => {
    router.back();
  }, [router]);

  const open = useCallback((next: SheetState) => {
    setProblem(null);
    setPickedPhoto(null);
    setPhotoRemoved(false);
    setPhotoError(null);
    setSheetKey((count) => count + 1);
    setSheet(next);
  }, []);

  const closeSheet = useCallback(() => {
    setSheet(NO_SHEET);
    setPickedPhoto(null);
    setPhotoRemoved(false);
    setPhotoError(null);
  }, []);

  /** Paint the change, remember what it looked like, and put it back on failure. */
  const optimistically = useCallback(
    (next: CareProfile, write: () => Promise<{ ok: boolean; problem?: ProfileProblem }>) => {
      const before = profile;

      if (before === null) {
        return;
      }

      setBusy(true);
      setProblem(null);
      setProfile(next);
      setSheet(NO_SHEET);

      void write().then((result) => {
        setBusy(false);

        if (!result.ok) {
          setProfile(before);
          setProblem(result.problem ?? 'unknown');
        }
      });
    },
    [profile],
  );

  // -------------------------------------------------------------------------
  // The basics
  // -------------------------------------------------------------------------

  const saveBasicsValues = useCallback(
    (values: BasicsValues) => {
      if (client === null || profile === null || profile.basics === null) {
        return;
      }

      const patch = basicsPatchOf(profile.basics, values);

      if (Object.keys(patch).length === 0) {
        closeSheet();
        return;
      }

      optimistically({ ...profile, basics: basicsAfter(profile.basics, values) }, () =>
        saveBasics(client, { recipientId: profile.basics?.id ?? '', patch }),
      );
    },
    [client, profile, optimistically, closeSheet],
  );

  // -------------------------------------------------------------------------
  // Doctors and pharmacies
  // -------------------------------------------------------------------------

  const saveContactValues = useCallback(
    (
      values: { name: string; organisation: string; phone: string; address: string; notes: string },
      isPrimary: boolean,
    ) => {
      if (
        client === null ||
        profile === null ||
        profile.basics === null ||
        sheet.kind !== 'contact'
      ) {
        return;
      }

      const basicsRow = profile.basics;
      const existing = sheet.contact;
      const tempId = existing?.id ?? `pending-${String(Date.now())}`;
      const row: CareContact = {
        id: tempId,
        kind: sheet.contactKind,
        name: values.name.trim(),
        organisation: emptyToNull(values.organisation),
        phone: emptyToNull(values.phone),
        address: emptyToNull(values.address),
        notes: emptyToNull(values.notes),
        isPrimary,
      };

      const others = profile.contacts.filter((contact) => contact.id !== existing?.id);
      // One main contact per kind: the row that is now main unsets the others in
      // the same optimistic paint, so the screen never shows two "Main" badges.
      const contacts = isPrimary
        ? [
            ...others.map((contact) =>
              contact.kind === row.kind ? { ...contact, isPrimary: false } : contact,
            ),
            row,
          ]
        : [...others, row];

      optimistically({ ...profile, contacts }, async () => {
        const result = await saveContact(client, {
          circleId: basicsRow.circleId,
          careRecipientId: basicsRow.id,
          contactId: existing?.id,
          kind: row.kind,
          name: row.name,
          organisation: row.organisation,
          phone: row.phone,
          address: row.address,
          notes: row.notes,
          isPrimary,
        });

        if (result.ok && existing === null && result.id !== undefined) {
          setProfile((current) =>
            current === null
              ? current
              : {
                  ...current,
                  contacts: current.contacts.map((contact) =>
                    contact.id === tempId ? { ...contact, id: result.id ?? tempId } : contact,
                  ),
                },
          );
        }

        return result;
      });
    },
    [client, profile, sheet, optimistically],
  );

  // -------------------------------------------------------------------------
  // Allergies and conditions
  // -------------------------------------------------------------------------

  const saveConditionValues = useCallback(
    (values: { label: string; notes: string }) => {
      if (
        client === null ||
        profile === null ||
        profile.basics === null ||
        sheet.kind !== 'condition'
      ) {
        return;
      }

      const basicsRow = profile.basics;
      const existing = sheet.condition;
      const tempId = existing?.id ?? `pending-${String(Date.now())}`;
      const row: CareCondition = {
        id: tempId,
        kind: sheet.conditionKind,
        label: values.label.trim(),
        notes: emptyToNull(values.notes),
      };

      const conditions = [...profile.conditions.filter((item) => item.id !== existing?.id), row];

      optimistically({ ...profile, conditions }, async () => {
        const result = await saveCondition(client, {
          circleId: basicsRow.circleId,
          careRecipientId: basicsRow.id,
          conditionId: existing?.id,
          kind: row.kind,
          label: row.label,
          notes: row.notes,
        });

        if (result.ok && existing === null && result.id !== undefined) {
          setProfile((current) =>
            current === null
              ? current
              : {
                  ...current,
                  conditions: current.conditions.map((condition) =>
                    condition.id === tempId ? { ...condition, id: result.id ?? tempId } : condition,
                  ),
                },
          );
        }

        return result;
      });
    },
    [client, profile, sheet, optimistically],
  );

  // -------------------------------------------------------------------------
  // Insurance cards
  // -------------------------------------------------------------------------

  const choosePhoto = useCallback(() => {
    void (async () => {
      const result = await pickImage();

      if (result.status === 'cancelled') {
        return;
      }

      if (result.status === 'refused') {
        setPhotoError(PICK_REFUSAL_COPY[result.reason]);
        return;
      }

      setPhotoError(null);
      setPhotoRemoved(false);
      setPickedPhoto(result.image);
    })();
  }, []);

  const saveInsuranceValues = useCallback(
    (values: { planName: string; memberId: string; groupNumber: string }) => {
      if (
        client === null ||
        profile === null ||
        profile.basics === null ||
        sheet.kind !== 'insurance'
      ) {
        return;
      }

      const basicsRow = profile.basics;
      const existing = sheet.card;
      const tempId = existing?.id ?? `pending-${String(Date.now())}`;
      const picked = pickedPhoto;
      const removed = photoRemoved;
      const before = profile;

      const row: InsuranceCard = {
        id: tempId,
        planName: values.planName.trim(),
        memberId: emptyToNull(values.memberId),
        groupNumber: emptyToNull(values.groupNumber),
        imagePath:
          picked !== null
            ? (existing?.imagePath ?? null)
            : removed
              ? null
              : (existing?.imagePath ?? null),
      };

      const insurance = [...profile.insurance.filter((card) => card.id !== existing?.id), row];

      setBusy(true);
      setProblem(null);
      setProfile({ ...profile, insurance });
      setSheet(NO_SHEET);

      void (async () => {
        let imagePath = row.imagePath;
        let uploadedPath: string | null = null;

        if (picked !== null) {
          const path = buildPath({
            circleId: basicsRow.circleId,
            careRecipientId: basicsRow.id,
            kind: 'insurance',
            rowId: existing?.id,
            extension: picked.extension,
            at: Date.now(),
          });

          const uploaded = await uploadCareImage(client, {
            path,
            bytes: picked.bytes,
            contentType: picked.mimeType,
          });

          if (!uploaded.ok) {
            setBusy(false);
            setProfile(before);
            setProblem(uploaded.problem ?? 'unknown');
            return;
          }

          uploadedPath = path;
          imagePath = path;
        }

        const result = await saveInsurance(client, {
          circleId: basicsRow.circleId,
          careRecipientId: basicsRow.id,
          insuranceId: existing?.id,
          planName: row.planName,
          memberId: row.memberId,
          groupNumber: row.groupNumber,
          imagePath,
        });

        setBusy(false);

        if (!result.ok) {
          setProfile(before);
          setProblem(result.problem ?? 'unknown');

          if (uploadedPath !== null) {
            void removeCareImage(client, uploadedPath);
          }

          return;
        }

        const savedId = result.id ?? tempId;

        setProfile((current) =>
          current === null
            ? current
            : {
                ...current,
                insurance: current.insurance.map((card) =>
                  card.id === tempId ? { ...card, id: savedId, imagePath } : card,
                ),
              },
        );

        // A replaced or removed photo is an orphan in the bucket otherwise:
        // storage is not cascaded by SQL, so this is the only thing that deletes it.
        if (
          existing?.imagePath !== null &&
          existing?.imagePath !== undefined &&
          existing.imagePath !== imagePath
        ) {
          void removeCareImage(client, existing.imagePath);
        }

        if (imagePath === null) {
          setCardUrls((current) => {
            const next = { ...current };
            delete next[savedId];
            return next;
          });
          return;
        }

        const signed = await signCareMediaPath(client, imagePath);

        if (signed !== null) {
          setCardUrls((current) => ({ ...current, [savedId]: signed.url }));
        }
      })();
    },
    [client, profile, sheet, pickedPhoto, photoRemoved],
  );

  // -------------------------------------------------------------------------
  // The person's photo
  // -------------------------------------------------------------------------

  const changePhoto = useCallback(() => {
    if (client === null || profile === null || profile.basics === null) {
      return;
    }

    const basicsRow = profile.basics;

    void (async () => {
      const result = await pickImage();

      if (result.status === 'cancelled') {
        return;
      }

      if (result.status === 'refused') {
        setPhotoProblem({
          title: 'That photo didn’t work',
          message: PICK_REFUSAL_COPY[result.reason],
        });
        return;
      }

      const path = buildPath({
        circleId: basicsRow.circleId,
        careRecipientId: basicsRow.id,
        kind: 'photo',
        extension: result.image.extension,
        at: Date.now(),
      });

      const previousUrl = photoUrl;
      const previousPath = basicsRow.photoPath;

      setPhotoProblem(null);
      setPhotoUrl(result.image.previewUri);
      setProfile((current) =>
        current === null || current.basics === null
          ? current
          : { ...current, basics: { ...current.basics, photoPath: path } },
      );

      const uploaded = await uploadCareImage(client, {
        path,
        bytes: result.image.bytes,
        contentType: result.image.mimeType,
      });

      if (!uploaded.ok) {
        setPhotoUrl(previousUrl);
        setProfile((current) =>
          current === null || current.basics === null
            ? current
            : { ...current, basics: { ...current.basics, photoPath: previousPath } },
        );
        setProblem(uploaded.problem ?? 'unknown');
        return;
      }

      const saved = await saveBasics(client, {
        recipientId: basicsRow.id,
        patch: { photo_url: path },
      });

      if (!saved.ok) {
        setPhotoUrl(previousUrl);
        setProfile((current) =>
          current === null || current.basics === null
            ? current
            : { ...current, basics: { ...current.basics, photoPath: previousPath } },
        );
        setProblem(saved.problem ?? 'unknown');
        void removeCareImage(client, path);
        return;
      }

      if (previousPath !== null) {
        void removeCareImage(client, previousPath);
      }

      const signed = await signCareMediaPath(client, path);

      if (signed !== null) {
        setPhotoUrl(signed.url);
      }
    })();
  }, [client, profile, photoUrl]);

  // -------------------------------------------------------------------------
  // Removing a row
  // -------------------------------------------------------------------------

  const confirmDelete = useCallback(() => {
    if (client === null || profile === null || confirming === null) {
      return;
    }

    const target = confirming;
    const before = profile;
    setConfirming(null);

    const next: CareProfile =
      target.table === 'contact'
        ? { ...profile, contacts: profile.contacts.filter((contact) => contact.id !== target.id) }
        : target.table === 'condition'
          ? { ...profile, conditions: profile.conditions.filter((item) => item.id !== target.id) }
          : { ...profile, insurance: profile.insurance.filter((card) => card.id !== target.id) };

    const removedPath =
      target.table === 'insurance'
        ? (profile.insurance.find((card) => card.id === target.id)?.imagePath ?? null)
        : null;

    setBusy(true);
    setProblem(null);
    setProfile(next);

    void (async () => {
      const result =
        target.table === 'contact'
          ? await deleteContact(client, target.id)
          : target.table === 'condition'
            ? await deleteCondition(client, target.id)
            : await deleteInsurance(client, target.id);

      setBusy(false);

      if (!result.ok) {
        setProfile(before);
        setProblem(result.problem ?? 'unknown');
        return;
      }

      if (removedPath !== null) {
        void removeCareImage(client, removedPath);
      }
    })();
  }, [client, profile, confirming]);

  const problemCopy = problem === null ? null : profileProblemCopy(problem);

  if (active === null) {
    return (
      <Screen>
        <ScreenHeader onBack={goBack} title="Their profile" titleTestID="profile-title" />
        <Card padding="sm">
          <EmptyState
            actionLabel={circlesState === 'error' ? 'Try again' : undefined}
            body={
              circlesState === 'error'
                ? 'We couldn’t read your circle just now. Nothing has changed.'
                : 'You’re not in a circle yet. Setting one up takes three short screens.'
            }
            headline={circlesState === 'error' ? 'We couldn’t load it' : 'No circle yet'}
            icon={HeartHandshake}
            testID="profile-no-circle"
          />
        </Card>
      </Screen>
    );
  }

  return (
    <>
      <ProfileView
        capabilities={capabilities}
        cardUrls={cardUrls}
        circleName={circleDisplayName(active)}
        loadState={loadState}
        offline={!online}
        onAddCondition={(kind) => {
          open({ kind: 'condition', conditionKind: kind, condition: null });
        }}
        onAddContact={(kind) => {
          open({ kind: 'contact', contactKind: kind, contact: null });
        }}
        onAddInsurance={() => {
          open({ kind: 'insurance', card: null });
        }}
        onBack={goBack}
        onChangePhoto={changePhoto}
        onEditBasics={() => {
          open({ kind: 'basics' });
        }}
        onEditCondition={(condition) => {
          open({ kind: 'condition', conditionKind: condition.kind, condition });
        }}
        onEditContact={(contact) => {
          open({ kind: 'contact', contactKind: contact.kind, contact });
        }}
        onEditInsurance={(card) => {
          open({ kind: 'insurance', card });
        }}
        onRetry={reload}
        photoUrl={photoUrl}
        problem={photoProblem ?? problemCopy}
        profile={profile}
        role={active.role}
      />

      {basics === null ? null : (
        <BasicsSheet
          busy={busy}
          initial={{
            fullName: basics.fullName,
            preferredName: basics.preferredName ?? '',
            relationship: basics.relationship ?? '',
            dateOfBirth: basics.dateOfBirth ?? '',
            phone: basics.phone ?? '',
            notes: basics.notes ?? '',
          }}
          key={`basics-${String(sheetKey)}`}
          onClose={closeSheet}
          onSave={saveBasicsValues}
          visible={sheet.kind === 'basics'}
        />
      )}

      {sheet.kind === 'contact' ? (
        <ContactSheet
          busy={busy}
          contact={sheet.contact}
          key={`contact-${String(sheetKey)}`}
          kind={sheet.contactKind}
          onClose={closeSheet}
          onDelete={() => {
            const contact = sheet.contact;

            if (contact !== null) {
              setSheet(NO_SHEET);
              setConfirming({ table: 'contact', id: contact.id, name: contact.name });
            }
          }}
          onSave={saveContactValues}
          visible
        />
      ) : null}

      {sheet.kind === 'condition' ? (
        <ConditionSheet
          busy={busy}
          condition={sheet.condition}
          key={`condition-${String(sheetKey)}`}
          kind={sheet.conditionKind}
          onClose={closeSheet}
          onDelete={() => {
            const condition = sheet.condition;

            if (condition !== null) {
              setSheet(NO_SHEET);
              setConfirming({ table: 'condition', id: condition.id, name: condition.label });
            }
          }}
          onSave={saveConditionValues}
          visible
        />
      ) : null}

      {sheet.kind === 'insurance' ? (
        <InsuranceSheet
          busy={busy}
          card={sheet.card}
          hasPhoto={
            pickedPhoto !== null ||
            (photoRemoved
              ? false
              : sheet.card?.imagePath !== null && sheet.card?.imagePath !== undefined)
          }
          key={`insurance-${String(sheetKey)}`}
          onClose={closeSheet}
          onDelete={() => {
            const card = sheet.card;

            if (card !== null) {
              setSheet(NO_SHEET);
              setConfirming({ table: 'insurance', id: card.id, name: card.planName });
            }
          }}
          onPickPhoto={choosePhoto}
          onRemovePhoto={() => {
            setPickedPhoto(null);
            setPhotoRemoved(true);
          }}
          onSave={saveInsuranceValues}
          photoError={photoError}
          photoPending={pickedPhoto !== null}
          visible
        />
      ) : null}

      <ConfirmSheet
        cancelLabel="Keep it"
        confirmLabel={
          confirming?.table === 'contact'
            ? 'Remove contact'
            : confirming?.table === 'condition'
              ? 'Remove it'
              : 'Remove card'
        }
        destructive
        loading={busy}
        message={
          confirming === null
            ? ''
            : `“${confirming.name}” will be removed from this profile for everyone in the circle, and the change is recorded in the activity log. This cannot be undone.`
        }
        onClose={() => {
          setConfirming(null);
        }}
        onConfirm={confirmDelete}
        testID="profile-delete-confirm"
        title={confirming === null ? 'Remove it?' : `Remove “${confirming.name}”?`}
        visible={confirming !== null}
      />
    </>
  );
}
