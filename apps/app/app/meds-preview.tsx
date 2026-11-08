import { useState, type ReactNode } from 'react';
import { ScrollView, View } from 'react-native';

import { Button, ScreenHeader, Text, ThemeProvider, useTheme } from '@tendshare/ui';

import type { CircleRole } from '../src/circles/circleState';
import { capabilitiesFor } from '../src/circles/roles';
import { MedHistorySheet } from '../src/meds/components/MedHistorySheet';
import { MedSheet } from '../src/meds/components/MedSheet';
import { MedsView } from '../src/meds/components/MedsView';
import type { CheckOff, Medication } from '../src/meds/doseSlots';
import type { MedicationHistoryEntry } from '../src/meds/historySentence';
import { canReadMedHistory } from '../src/meds/medHistoryAccess';
import { EMPTY_MED_VALUES } from '../src/meds/medValidation';

/**
 * Every state of the meds screens, on purpose, at 390px, in both schemes — the
 * Task 8 twin of `/profile-preview` and `/circles-preview`.
 *
 * Hidden and unlinked. It renders the real `MedsView`, `MedSheet` and
 * `MedHistorySheet` with fixture props, so what QA and the owner look at is what
 * the app ships: today's doses partly ticked, the visiting helper's plain list,
 * the reader who ticks nothing, a lapsed plan's read-only extras, a refill due,
 * the loading skeletons, the empty list, the error and the offline banner — plus
 * the add sheet and the history sheet.
 *
 * Nothing here touches the session or Supabase, so it works with no account at
 * all: the owner can see every screen before signing in.
 */

const noop = () => undefined;

/** Fixed so the preview says the same thing on every machine and every day. */
const TODAY = '2026-11-07';

const METFORMIN: Medication = {
  id: 'm1',
  circleId: 'c1',
  careRecipientId: 'r1',
  name: 'Metformin',
  strength: '500 mg',
  form: 'tablet',
  instructions: 'With breakfast, the one she keeps by the kettle.',
  startsOn: '2026-03-12',
  endsOn: null,
  refillDueOn: null,
  refillReminderDays: 7,
  archivedAt: null,
  times: [
    { id: 't1', timeOfDay: '08:00:00', label: null, sortOrder: 0 },
    { id: 't2', timeOfDay: '20:00:00', label: null, sortOrder: 1 },
  ],
};

const AMLODIPINE: Medication = {
  id: 'm2',
  circleId: 'c1',
  careRecipientId: 'r1',
  name: 'Amlodipine',
  strength: '5 mg',
  form: 'tablet',
  instructions: null,
  startsOn: null,
  endsOn: null,
  refillDueOn: null,
  refillReminderDays: 7,
  archivedAt: null,
  times: [{ id: 't3', timeOfDay: '08:00:00', label: null, sortOrder: 0 }],
};

const WARFARIN: Medication = {
  id: 'm3',
  circleId: 'c1',
  careRecipientId: 'r1',
  name: 'Warfarin',
  strength: '3 mg',
  form: 'tablet',
  instructions: 'As written on the yellow card in the kitchen drawer.',
  startsOn: null,
  endsOn: null,
  // Inside the seven-day window, so the row carries "Refill due 12 Nov".
  refillDueOn: '2026-11-12',
  refillReminderDays: 7,
  archivedAt: null,
  times: [{ id: 't4', timeOfDay: '18:00:00', label: null, sortOrder: 0 }],
};

const ATORVASTATIN: Medication = {
  id: 'm4',
  circleId: 'c1',
  careRecipientId: 'r1',
  name: 'Atorvastatin',
  strength: '20 mg',
  form: 'tablet',
  instructions: null,
  startsOn: null,
  endsOn: null,
  // Already past its date: "Refill was due 1 Nov".
  refillDueOn: '2026-11-01',
  refillReminderDays: 7,
  archivedAt: null,
  times: [{ id: 't5', timeOfDay: '20:00:00', label: null, sortOrder: 0 }],
};

const MEDICATIONS: readonly Medication[] = [METFORMIN, AMLODIPINE, WARFARIN, ATORVASTATIN];

/** Sara did the 8 am Metformin; Priya did the 8 am Amlodipine. Two are still open. */
const CHECK_OFFS: readonly CheckOff[] = [
  {
    id: 'k1',
    medicationId: 'm1',
    doseDate: TODAY,
    doseTime: '08:00:00',
    takenByName: 'Sara',
    takenAt: new Date(2026, 10, 7, 8, 12).toISOString(),
  },
  {
    id: 'k2',
    medicationId: 'm2',
    doseDate: TODAY,
    doseTime: '08:00:00',
    takenByName: 'Priya',
    takenAt: new Date(2026, 10, 7, 8, 4).toISOString(),
  },
];

const HISTORY: readonly MedicationHistoryEntry[] = [
  {
    occurredAt: new Date(2026, 10, 7, 13, 4).toISOString(),
    event: 'dose.ticked',
    action: 'create',
    tableName: 'med_checkoffs',
    medicationId: 'm1',
    fields: [],
    actorName: 'Priya',
    doseTime: '13:00:00',
  },
  {
    occurredAt: new Date(2026, 10, 7, 13, 9).toISOString(),
    event: 'dose.unticked',
    action: 'delete',
    tableName: 'med_checkoffs',
    medicationId: 'm1',
    fields: [],
    actorName: 'Tom',
    doseTime: '13:00:00',
  },
  {
    occurredAt: new Date(2026, 10, 6, 9, 30).toISOString(),
    event: 'update',
    action: 'update',
    tableName: 'medications',
    medicationId: 'm1',
    fields: ['strength', 'form'],
    actorName: 'Sara',
    doseTime: null,
  },
  {
    occurredAt: new Date(2026, 10, 3, 17, 45).toISOString(),
    event: 'create',
    action: 'create',
    tableName: 'medications',
    medicationId: 'm1',
    fields: ['name', 'instructions', 'refill_reminder_days'],
    actorName: 'Sara',
    doseTime: null,
  },
];

function medsView(options: {
  readonly role: CircleRole;
  readonly loadState?: 'loading' | 'ready' | 'error';
  readonly offline?: boolean;
  readonly planLapsed?: boolean;
  readonly medications?: readonly Medication[];
  readonly checkOffs?: readonly CheckOff[];
  readonly problem?: { title: string; message: string } | null;
}): ReactNode {
  const capabilities = capabilitiesFor(options.role);

  return (
    <MedsView
      canReadHistory={canReadMedHistory(capabilities)}
      capabilities={capabilities}
      checkOffs={options.checkOffs ?? CHECK_OFFS}
      circleName="Margaret’s circle"
      loadState={options.loadState ?? 'ready'}
      medications={options.medications ?? MEDICATIONS}
      offline={options.offline ?? false}
      onAdd={noop}
      onEdit={noop}
      onOpenHistory={noop}
      onRetry={noop}
      onTick={noop}
      onUndo={noop}
      planLapsed={options.planLapsed ?? false}
      problem={options.problem ?? null}
      today={TODAY}
    />
  );
}

interface StateFixture {
  readonly key: string;
  readonly label: string;
  readonly render: () => ReactNode;
}

const STATES: readonly StateFixture[] = [
  {
    key: 'owner',
    label: 'Meds — owner, partly ticked',
    render: () => medsView({ role: 'owner' }),
  },
  {
    key: 'helper',
    label: 'Meds — visiting helper',
    render: () => medsView({ role: 'visiting_helper' }),
  },
  {
    key: 'view-only',
    label: 'Meds — view only',
    render: () => medsView({ role: 'view_only' }),
  },
  {
    key: 'lapsed',
    label: 'Meds — plan ended',
    render: () => medsView({ role: 'owner', planLapsed: true }),
  },
  {
    key: 'refill',
    label: 'Meds — refill due',
    render: () => medsView({ role: 'owner', checkOffs: [] }),
  },
  {
    key: 'loading',
    label: 'Meds — loading',
    render: () => medsView({ role: 'owner', loadState: 'loading', medications: [], checkOffs: [] }),
  },
  {
    key: 'empty',
    label: 'Meds — no medicines',
    render: () => medsView({ role: 'owner', medications: [], checkOffs: [] }),
  },
  {
    key: 'error',
    label: 'Meds — error',
    render: () => medsView({ role: 'owner', loadState: 'error', medications: [], checkOffs: [] }),
  },
  {
    key: 'offline',
    label: 'Meds — offline',
    render: () => medsView({ role: 'owner', offline: true }),
  },
  {
    key: 'refused',
    label: 'Meds — a write was refused',
    render: () =>
      medsView({
        role: 'owner',
        problem: {
          title: 'That didn’t save',
          message:
            'Something went wrong on the way. Nothing was changed, and what you typed is still here — try again in a moment.',
        },
      }),
  },
  {
    key: 'add-sheet',
    label: 'Add a medicine — sheet',
    render: () => (
      <View style={{ flex: 1 }}>
        {medsView({ role: 'owner' })}
        <MedSheet
          busy={false}
          initial={{
            ...EMPTY_MED_VALUES,
            name: 'Metformin',
            strength: '500 mg',
            form: 'tablet',
            instructions: 'With breakfast.',
            times: ['08:00', '20:00'],
            startsOn: '2026-03-12',
            refillDueOn: '2026-11-12',
          }}
          mode="add"
          onArchive={noop}
          onClose={noop}
          onSave={noop}
          planLapsed={false}
          visible
        />
      </View>
    ),
  },
  {
    key: 'edit-sheet',
    label: 'Edit a medicine — sheet',
    render: () => (
      <View style={{ flex: 1 }}>
        {medsView({ role: 'owner' })}
        <MedSheet
          busy={false}
          initial={{
            ...EMPTY_MED_VALUES,
            name: 'Warfarin',
            strength: '3 mg',
            form: 'tablet',
            instructions: 'As written on the yellow card in the kitchen drawer.',
            times: ['18:00'],
            refillDueOn: '2026-11-12',
          }}
          mode="edit"
          onArchive={noop}
          onClose={noop}
          onSave={noop}
          planLapsed={false}
          visible
        />
      </View>
    ),
  },
  {
    key: 'history',
    label: 'Change history — sheet',
    render: () => (
      <View style={{ flex: 1 }}>
        {medsView({ role: 'owner' })}
        <MedHistorySheet
          entries={HISTORY}
          loadState="ready"
          medicationName={null}
          onClose={noop}
          onRetry={noop}
          visible
        />
      </View>
    ),
  },
  {
    key: 'history-empty',
    label: 'Change history — empty',
    render: () => (
      <View style={{ flex: 1 }}>
        {medsView({ role: 'view_only' })}
        <MedHistorySheet
          entries={[]}
          loadState="ready"
          medicationName="Metformin"
          onClose={noop}
          onRetry={noop}
          visible
        />
      </View>
    ),
  },
];

function PreviewBody() {
  const theme = useTheme();
  const [selected, setSelected] = useState(STATES[0]?.key ?? 'owner');
  const [scheme, setScheme] = useState<'light' | 'dark'>('light');
  const current = STATES.find((state) => state.key === selected) ?? STATES[0];

  return (
    <View
      style={{
        backgroundColor: theme.colors.surfaceSunken,
        flex: 1,
        flexDirection: 'row',
        gap: theme.space.md,
        padding: theme.space.md,
      }}
    >
      <View style={{ gap: theme.space.xs, width: 220 }}>
        <ScreenHeader subtitle="Hidden preview — not linked from the app." title="Meds preview" />
        <Button
          label={scheme === 'light' ? 'Dark' : 'Light'}
          onPress={() => {
            setScheme(scheme === 'light' ? 'dark' : 'light');
          }}
          size="small"
          testID="preview-scheme"
          variant="secondary"
        />
        <ScrollView>
          <View style={{ gap: theme.space['2xs'] }}>
            {STATES.map((state) => (
              <Button
                key={state.key}
                label={state.label}
                onPress={() => {
                  setSelected(state.key);
                }}
                size="small"
                testID={`preview-${state.key}`}
                variant={state.key === selected ? 'primary' : 'ghost'}
              />
            ))}
          </View>
        </ScrollView>
        <Text tone="tertiary" variant="caption">
          {current?.label ?? ''} · {scheme}
        </Text>
      </View>

      <View style={{ alignItems: 'center', flex: 1 }}>
        <View
          style={{
            borderColor: theme.colors.borderStrong,
            borderRadius: theme.radius.card,
            borderWidth: 1,
            flex: 1,
            overflow: 'hidden',
            width: 390,
          }}
          testID="preview-frame"
        >
          {/* `key` remounts the frame when the scheme changes: `initialMode` is read
              once, so without it the Dark button recoloured the page and left the
              phone frame light. */}
          <ThemeProvider initialMode={scheme} key={`${scheme}-${selected}`}>
            <View style={{ flex: 1 }}>{current?.render()}</View>
          </ThemeProvider>
        </View>
      </View>
    </View>
  );
}

export default function MedsPreviewRoute() {
  return <PreviewBody />;
}
