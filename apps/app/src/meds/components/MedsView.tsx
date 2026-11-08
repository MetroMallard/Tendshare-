/**
 * The meds screen: today's doses first, then the whole list.
 *
 * ## Two lists, one question each
 *
 * The top of the screen answers "what is due, and has anybody given it?" — the
 * day's doses, gathered under the clock times the family typed, each with one
 * large tick. Below it is the list itself: every medicine, its times as pills,
 * and the way to change one.
 *
 * ## What this screen will never say
 *
 * Nothing here advises. There is no "take with food", no dose suggestion, no
 * interaction warning and no "you should" — the only words about a medicine are
 * the family's own, carried through from the database untouched. The quiet
 * notice at the bottom says so once, in the same words the profile uses.
 *
 * ## Every state is a real state
 *
 * Loading is row-shaped skeletons, empty says what the list is for and offers the
 * one next step, error is one retry that keeps what was already read, offline
 * keeps the cached list readable and stops the ticking, and a lapsed plan greys
 * out the paid extras only — never the tick, which is free for ever.
 *
 * The component is presentational on purpose: the screen that owns the reads and
 * the writes is `app/(tabs)/meds.tsx`, and `/meds-preview` renders this one with
 * fixture props so every state can be looked at without a live circle.
 */
import { History, Pencil, Pill, Plus } from 'lucide-react-native';
import { View } from 'react-native';

import {
  Badge,
  Button,
  Card,
  EmptyState,
  ScreenHeader,
  Section,
  Skeleton,
  Text,
  brand,
  useTheme,
} from '@tendshare/ui';

import { Notice } from '../../components/Notice';
import { Screen } from '../../components/Screen';
import type { Capabilities } from '../../circles/roles';
import { checkOffLine, tickAccessibilityHint, tickAccessibilityLabel } from '../checkoffSentence';
import {
  buildDoseSlots,
  clockLabel,
  groupSlotsByClock,
  listMedications,
  normalizeClock,
  openDoseCount,
  strengthAndForm,
  type CheckOff,
  type DoseSlot,
  type Medication,
} from '../doseSlots';
import { refillCount, refillCountLine, refillLine } from '../refill';
import { TickButton } from './TickButton';

export interface MedsProblem {
  readonly title: string;
  readonly message: string;
}

export interface MedsViewProps {
  /** The active circle's name, for the eyebrow line. */
  readonly circleName: string;
  readonly capabilities: Capabilities;
  /** May this role read `medication_history()`? See `canReadMedHistory()`. */
  readonly canReadHistory: boolean;
  readonly loadState: 'loading' | 'ready' | 'error';
  readonly offline: boolean;
  /** A circle whose paid plan ended: the extras are read-only, ticking is not. */
  readonly planLapsed: boolean;
  /** `YYYY-MM-DD` — passed in so the screen is deterministic in a preview. */
  readonly today: string;
  readonly medications: readonly Medication[];
  readonly checkOffs: readonly CheckOff[];
  readonly problem: MedsProblem | null;
  readonly onRetry: () => void;
  readonly onAdd: () => void;
  readonly onEdit: (medication: Medication) => void;
  readonly onTick: (slot: DoseSlot) => void;
  readonly onUndo: (slot: DoseSlot) => void;
  readonly onOpenHistory: (medication: Medication | null) => void;
  readonly testID?: string;
}

export function MedsView({
  circleName,
  capabilities,
  canReadHistory,
  loadState,
  offline,
  planLapsed,
  today,
  medications,
  checkOffs,
  problem,
  onRetry,
  onAdd,
  onEdit,
  onTick,
  onUndo,
  onOpenHistory,
  testID = 'screen-meds',
}: MedsViewProps) {
  const theme = useTheme();

  // Everything is decided from the capability map, never from a role name: the
  // database enforces the same four answers, and a screen that asked "is this a
  // helper?" could drift from it the moment a role changes.
  const canEdit = capabilities.canEditMeds && !offline;
  const canTick = capabilities.canCheckOffMeds && !offline;
  const canUndo = capabilities.canUndoCheckOff && !offline;
  const canSeeList = capabilities.canSeeMeds;

  const slots = buildDoseSlots(medications, checkOffs, today);
  const groups = groupSlotsByClock(slots);
  const list = listMedications(medications);
  const open = openDoseCount(slots);
  const refills = refillCount(list, today);
  const refillSummary = refillCountLine(refills);

  const header = (
    <ScreenHeader
      action={
        canEdit && canSeeList ? (
          <Button
            accessibilityHint="Opens a sheet to add a medicine."
            icon={Plus}
            label="Add"
            onPress={onAdd}
            size="small"
            testID="meds-add"
            variant="secondary"
          />
        ) : undefined
      }
      eyebrow={circleName}
      subtitle="The list exactly as your family writes it."
      title="Meds"
      titleTestID="meds-title"
    />
  );

  if (!canSeeList) {
    return (
      <Screen>
        <View style={{ gap: theme.space.md }} testID={testID}>
          {header}
          <Card padding="sm">
            <EmptyState
              body="Your role in this circle doesn’t include the medicine list. Ask the circle’s owner if you think that’s wrong."
              headline="Not shared with you"
              icon={Pill}
              testID="meds-not-shared"
            />
          </Card>
        </View>
      </Screen>
    );
  }

  return (
    <Screen>
      <View style={{ gap: theme.space.md }} testID={testID}>
        {header}

        {offline ? (
          <Notice
            message="The list you last read is here. Ticking a dose needs a connection, so the ticks are paused until you’re back."
            testID="meds-offline"
            title="You’re offline"
            tone="warning"
          />
        ) : null}

        {problem ? (
          <Notice
            message={problem.message}
            testID="meds-problem"
            title={problem.title}
            tone="danger"
          />
        ) : null}

        {planLapsed ? (
          <Notice
            message="The medicine list and ticking doses still work. Refill reminders are read-only until the plan is back — nothing has been removed."
            testID="meds-plan-lapsed"
            title="Your plan has ended"
            tone="info"
          />
        ) : null}

        {loadState === 'error' ? (
          <Card padding="sm">
            <EmptyState
              actionLabel="Try again"
              body="We couldn’t read the medicine list just now. Nothing has changed."
              headline="We couldn’t load the list"
              icon={Pill}
              onAction={onRetry}
              testID="meds-error"
            />
          </Card>
        ) : loadState === 'loading' ? (
          <MedsLoading />
        ) : medications.length === 0 ? (
          <Card padding="sm">
            <EmptyState
              actionLabel={canEdit ? 'Add the first medicine' : undefined}
              body={`Add each medicine exactly as it is on the box. ${brand.name} never suggests doses and never gives advice.`}
              headline="No medicines yet"
              icon={Pill}
              onAction={canEdit ? onAdd : undefined}
              testID="meds-empty"
            />
          </Card>
        ) : (
          <>
            {refillSummary !== null && canEdit ? (
              <Text testID="meds-refill-count" tone="secondary" variant="caption">
                {refillSummary}
              </Text>
            ) : null}

            <Section
              description={
                open === 0
                  ? 'Every dose today is ticked. The list below has the whole schedule.'
                  : `${String(open)} of today’s ${String(slots.length)} ${slots.length === 1 ? 'dose' : 'doses'} still to tick.`
              }
              title="Today"
            >
              {groups.length === 0 ? (
                <Card padding="sm">
                  <EmptyState
                    body="Nothing is scheduled for today. Add a time to a medicine and its doses appear here."
                    headline="Nothing due today"
                    icon={Pill}
                    testID="meds-today-empty"
                  />
                </Card>
              ) : (
                groups.map((group) => (
                  <Card key={group.doseTime} padding="none" testID={`meds-group-${group.doseTime}`}>
                    <View
                      style={{
                        paddingHorizontal: theme.space.sm,
                        paddingTop: theme.space.sm,
                      }}
                    >
                      <Text tone="secondary" uppercase variant="label">
                        {group.clock}
                      </Text>
                    </View>

                    {group.slots.map((slot, index) => (
                      <DoseRow
                        key={slot.key}
                        canTick={canTick}
                        canUndo={canUndo}
                        divider={index > 0}
                        onTick={() => {
                          onTick(slot);
                        }}
                        onUndo={() => {
                          onUndo(slot);
                        }}
                        slot={slot}
                      />
                    ))}
                  </Card>
                ))
              )}
            </Section>

            <Section
              description="Every medicine your family has written down, with the times it is taken."
              title="All medicines"
            >
              {list.length === 0 ? (
                <Card padding="sm">
                  <EmptyState
                    body="Nothing in the list is being taken at the moment."
                    headline="No medicines in the list"
                    icon={Pill}
                    testID="meds-list-empty"
                  />
                </Card>
              ) : (
                list.map((medication) => (
                  <MedicationCard
                    key={medication.id}
                    canEdit={canEdit}
                    canReadHistory={canReadHistory}
                    medication={medication}
                    onEdit={() => {
                      onEdit(medication);
                    }}
                    onHistory={() => {
                      onOpenHistory(medication);
                    }}
                    showRefill={canEdit && !planLapsed}
                    today={today}
                  />
                ))
              )}

              {canReadHistory ? (
                <Button
                  accessibilityHint="Opens the change history for every medicine in the circle."
                  fullWidth
                  icon={History}
                  label="Change history"
                  onPress={() => {
                    onOpenHistory(null);
                  }}
                  testID="meds-history-all"
                  variant="ghost"
                />
              ) : null}
            </Section>
          </>
        )}

        <Card tone="muted" testID="meds-not-medical">
          <View style={{ gap: theme.space['2xs'] }}>
            <Text variant="label">This isn’t medical information</Text>
            <Text tone="secondary" variant="caption">
              We only help your family stay organised. We don’t give medical advice, and nothing
              here is checked against anything else.
            </Text>
          </View>
        </Card>
      </View>
    </Screen>
  );
}

/** One dose: the medicine, the family's words, and the tick. */
function DoseRow({
  slot,
  canTick,
  canUndo,
  divider,
  onTick,
  onUndo,
}: {
  readonly slot: DoseSlot;
  readonly canTick: boolean;
  readonly canUndo: boolean;
  readonly divider: boolean;
  readonly onTick: () => void;
  readonly onUndo: () => void;
}) {
  const theme = useTheme();
  const meta = strengthAndForm(slot);
  const ticked = slot.checkOff !== null;
  const interactive = ticked ? canUndo : canTick;

  return (
    <View
      style={{
        alignItems: 'center',
        borderColor: theme.colors.border,
        borderTopWidth: divider ? 1 : 0,
        flexDirection: 'row',
        gap: theme.space.sm,
        minHeight: theme.layout.controlHeight.large,
        paddingHorizontal: theme.space.sm,
        paddingVertical: theme.space.xs,
      }}
      testID={`meds-dose-${slot.key}`}
    >
      <View style={{ flex: 1, gap: theme.space['2xs'] }}>
        <Text variant="bodyStrong">{slot.medicationName}</Text>
        {meta.length > 0 ? (
          <Text tone="secondary" variant="caption">
            {meta}
          </Text>
        ) : null}
        {slot.instructions !== null && slot.instructions.trim().length > 0 ? (
          <Text tone="secondary" variant="caption">
            {slot.instructions}
          </Text>
        ) : null}
        {slot.checkOff !== null ? (
          <Text tone="success" variant="caption">
            {checkOffLine(slot.checkOff)}
          </Text>
        ) : null}
      </View>

      <TickButton
        accessibilityHint={tickAccessibilityHint(slot.checkOff)}
        accessibilityLabel={tickAccessibilityLabel({
          medicationName: slot.medicationName,
          doseTime: slot.doseTime,
          checkOff: slot.checkOff,
        })}
        disabled={!interactive}
        onPress={ticked ? onUndo : onTick}
        state={ticked ? 'ticked' : 'open'}
        testID={`meds-tick-${slot.key}`}
      />
    </View>
  );
}

/** One medicine in the list below today. */
function MedicationCard({
  medication,
  canEdit,
  canReadHistory,
  showRefill,
  today,
  onEdit,
  onHistory,
}: {
  readonly medication: Medication;
  readonly canEdit: boolean;
  readonly canReadHistory: boolean;
  readonly showRefill: boolean;
  readonly today: string;
  readonly onEdit: () => void;
  readonly onHistory: () => void;
}) {
  const theme = useTheme();
  const meta = strengthAndForm(medication);
  const refill = showRefill ? refillLine(medication, today) : null;

  return (
    <Card padding="sm" testID={`meds-medicine-${medication.id}`}>
      <View style={{ gap: theme.space.xs }}>
        <View style={{ gap: theme.space['2xs'] }}>
          <Text variant="subheading">{medication.name}</Text>
          {meta.length > 0 ? (
            <Text tone="secondary" variant="caption">
              {meta}
            </Text>
          ) : null}
          {medication.instructions !== null && medication.instructions.trim().length > 0 ? (
            <Text tone="secondary">{medication.instructions}</Text>
          ) : null}
        </View>

        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.space['2xs'] }}>
          {medication.times.length === 0 ? (
            <Text tone="secondary" variant="caption">
              No times set yet
            </Text>
          ) : (
            medication.times.map((time) => (
              <Badge
                key={time.id}
                label={clockLabel(normalizeClock(time.timeOfDay))}
                testID={`meds-time-${time.id}`}
              />
            ))
          )}
        </View>

        {refill !== null ? (
          <Text testID={`meds-refill-${medication.id}`} tone="secondary" variant="caption">
            {refill}
          </Text>
        ) : null}

        {canEdit || canReadHistory ? (
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.space.xs }}>
            {canEdit ? (
              <Button
                accessibilityHint="Opens this medicine so you can change it."
                icon={Pencil}
                label="Edit"
                onPress={onEdit}
                size="small"
                testID={`meds-edit-${medication.id}`}
                variant="secondary"
              />
            ) : null}
            {canReadHistory ? (
              <Button
                accessibilityHint="Opens the change history for this medicine."
                icon={History}
                label="History"
                onPress={onHistory}
                size="small"
                testID={`meds-history-${medication.id}`}
                variant="ghost"
              />
            ) : null}
          </View>
        ) : null}
      </View>
    </Card>
  );
}

/** Row-shaped placeholders, so the first paint has the shape of the answer. */
function MedsLoading() {
  const theme = useTheme();

  return (
    <View style={{ gap: theme.space.md }} testID="meds-loading">
      <View style={{ gap: theme.space.xs }}>
        <Skeleton width={120} />
        <Card padding="sm">
          <View style={{ gap: theme.space.sm }}>
            <Skeleton shape="row" />
            <Skeleton shape="row" />
          </View>
        </Card>
      </View>
      <View style={{ gap: theme.space.xs }}>
        <Skeleton width={140} />
        <Card padding="sm">
          <View style={{ gap: theme.space.sm }}>
            <Skeleton lines={2} />
            <Skeleton shape="row" />
          </View>
        </Card>
      </View>
    </View>
  );
}
