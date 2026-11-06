import { useRouter } from 'expo-router';
import {
  Bell,
  CheckCheck,
  ChevronRight,
  CircleAlert,
  FileText,
  House,
  Pill,
  Plus,
  TriangleAlert,
  Users,
  Wallet,
} from 'lucide-react-native';
import { useState } from 'react';
import { View } from 'react-native';

import {
  Avatar,
  AvatarStack,
  Badge,
  Button,
  Card,
  ConfirmSheet,
  EmptyState,
  Field,
  ListRow,
  ScreenHeader,
  Section,
  SegmentedControl,
  Sheet,
  Skeleton,
  StatusPill,
  Switch,
  Text,
  TextField,
  typography,
  useTheme,
  useThemeMode,
  type ThemeColors,
  type ThemeMode,
  type TypeVariant,
} from '@tendshare/ui';

import { Screen } from '../src/components/Screen';

/**
 * THE HIDDEN COMPONENT GALLERY.
 *
 * This screen is the place the design system is judged: every colour token, the
 * whole type scale, spacing, radii and elevation, and every component in every
 * variant and state — in whichever scheme the toggle at the top says.
 *
 * It is reachable two ways and no others: the `/gallery` link, or five quick taps
 * on the version line at the bottom of the More tab. It is not in the tab bar, it
 * is not linked from a screen, and nothing in the product mentions it, so a
 * family using the app cannot land here by accident.
 */

const COLOR_GROUPS: ReadonlyArray<{
  readonly title: string;
  readonly keys: ReadonlyArray<keyof ThemeColors>;
}> = [
  {
    title: 'Page, surfaces and borders',
    keys: [
      'bg',
      'surface',
      'surfaceRaised',
      'surfaceSunken',
      'surfaceMuted',
      'border',
      'borderStrong',
      'overlay',
    ],
  },
  { title: 'Text', keys: ['textPrimary', 'textSecondary', 'textTertiary', 'textInverse'] },
  {
    title: 'Brand — deep navy',
    keys: ['brand', 'brandPressed', 'brandFg', 'brandSoft', 'brandSoftFg'],
  },
  {
    title: 'Accent — soft teal',
    keys: ['accent', 'accentPressed', 'accentFg', 'accentSoft', 'accentSoftFg'],
  },
  {
    title: 'Status — colour is never the only signal',
    keys: [
      'success',
      'successSoft',
      'successSoftFg',
      'warning',
      'warningSoft',
      'warningSoftFg',
      'danger',
      'dangerPressed',
      'dangerSoft',
      'dangerSoftFg',
    ],
  },
  { title: 'Focus', keys: ['focus'] },
];

const MODE_OPTIONS = [
  { value: 'system' as ThemeMode, label: 'System' },
  { value: 'light' as ThemeMode, label: 'Light' },
  { value: 'dark' as ThemeMode, label: 'Dark' },
];

function Swatch({
  name,
  value,
  borderColor,
}: {
  readonly name: string;
  readonly value: string;
  readonly borderColor: string;
}) {
  const theme = useTheme();

  return (
    <View
      style={{ alignItems: 'center', flexDirection: 'row', gap: theme.space.sm, minHeight: 48 }}
    >
      <View
        style={{
          backgroundColor: value,
          borderColor,
          borderRadius: theme.radius.field,
          borderWidth: 1,
          height: theme.space.lg,
          width: theme.space.lg,
        }}
      />
      <Text style={{ flex: 1 }} variant="caption">
        {name}
      </Text>
      <Text tone="tertiary" variant="caption">
        {value.toUpperCase()}
      </Text>
    </View>
  );
}

export default function GalleryScreen() {
  const theme = useTheme();
  const { mode, scheme, setMode } = useThemeMode();
  const router = useRouter();

  const [segment, setSegment] = useState<'week' | 'month'>('week');
  const [reminders, setReminders] = useState(true);
  const [quiet, setQuiet] = useState(false);
  const [name, setName] = useState('');
  const [sheetOpen, setSheetOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmLoading, setConfirmLoading] = useState(false);

  return (
    <Screen>
      <ScreenHeader
        eyebrow="Hidden · not part of the product"
        onBack={() => {
          router.back();
        }}
        subtitle="Every token and every component, in both schemes. Reach this from the version line on More, or at /gallery."
        title="Design system"
        titleTestID="screen-gallery-heading"
      />

      <Section
        description="System follows the phone. Light and dark are the same scale in two palettes."
        title="Theme"
      >
        <SegmentedControl
          accessibilityLabel="Colour scheme"
          onChange={setMode}
          options={MODE_OPTIONS}
          value={mode}
        />
        <Text tone="secondary" variant="caption">
          Showing the {scheme} scheme.
        </Text>
      </Section>

      <Section
        description="Screens and components only ever name a token, never a hex value."
        title="Colour"
      >
        {COLOR_GROUPS.map((group) => (
          <Card key={group.title} padding="sm" title={group.title}>
            {group.keys.map((key) => (
              <Swatch
                borderColor={theme.colors.borderStrong}
                key={key}
                name={key}
                value={theme.colors[key]}
              />
            ))}
          </Card>
        ))}
      </Section>

      <Section description="Body is 17px. Nothing in the product is under 14px." title="Type scale">
        <Card>
          {(Object.keys(typography) as TypeVariant[]).map((variant) => (
            <View
              key={variant}
              style={{
                borderTopColor: theme.colors.border,
                borderTopWidth: 1,
                gap: theme.space['2xs'],
                paddingVertical: theme.space.xs,
              }}
            >
              <Text tone="tertiary" variant="caption">
                {variant} · {typography[variant].fontSize}/{typography[variant].lineHeight} ·{' '}
                {typography[variant].fontWeight}
              </Text>
              <Text variant={variant}>Who can take Mom to cardiology Thursday?</Text>
            </View>
          ))}
        </Card>
      </Section>

      <Section description="An 8pt grid, one 4pt half-step, radii 12–16." title="Space and shape">
        <Card title="Spacing">
          {Object.entries(theme.space).map(([key, value]) => (
            <View
              key={key}
              style={{ alignItems: 'center', flexDirection: 'row', gap: theme.space.sm }}
            >
              <Text style={{ width: theme.space.xl }} tone="tertiary" variant="caption">
                {key}
              </Text>
              <View
                style={{
                  backgroundColor: theme.colors.brandSoft,
                  borderRadius: theme.radius.pill,
                  height: theme.space.sm,
                  width: value,
                }}
              />
              <Text tone="tertiary" variant="caption">
                {value}
              </Text>
            </View>
          ))}
        </Card>

        <Card title="Radius">
          <View style={{ flexDirection: 'row', gap: theme.space.sm }}>
            {(
              [
                ['field', theme.radius.field],
                ['card', theme.radius.card],
                ['panel', theme.radius.panel],
              ] as const
            ).map(([key, value]) => (
              <View key={key} style={{ alignItems: 'center', gap: theme.space['2xs'] }}>
                <View
                  style={{
                    backgroundColor: theme.colors.surfaceSunken,
                    borderColor: theme.colors.border,
                    borderRadius: value,
                    borderWidth: 1,
                    height: theme.space['2xl'],
                    width: theme.space['2xl'],
                  }}
                />
                <Text tone="secondary" variant="caption">
                  {key} {value}
                </Text>
              </View>
            ))}
          </View>
        </Card>

        <Card title="Elevation">
          <View style={{ flexDirection: 'row', gap: theme.space.sm }}>
            <View
              style={[
                {
                  backgroundColor: theme.colors.surface,
                  borderColor: theme.colors.border,
                  borderRadius: theme.radius.card,
                  borderWidth: 1,
                  flex: 1,
                  padding: theme.space.sm,
                },
                theme.elevation.card,
              ]}
            >
              <Text variant="caption">card</Text>
            </View>
            <View
              style={[
                {
                  backgroundColor: theme.colors.surfaceRaised,
                  borderColor: theme.colors.border,
                  borderRadius: theme.radius.card,
                  borderWidth: 1,
                  flex: 1,
                  padding: theme.space.sm,
                },
                theme.elevation.raised,
              ]}
            >
              <Text variant="caption">raised</Text>
            </View>
          </View>
        </Card>
      </Section>

      <Section description="Four variants, every state, 48pt minimum." title="Buttons">
        <Card title="Primary">
          <Button label="Add an appointment" icon={Plus} />
          <Button disabled label="Disabled" />
          <Button label="Saving…" loading />
        </Card>
        <Card title="Secondary">
          <Button label="Invite family" variant="secondary" />
          <Button disabled label="Disabled" variant="secondary" />
          <Button label="Saving…" loading variant="secondary" />
        </Card>
        <Card title="Ghost">
          <Button label="See all" variant="ghost" />
          <Button disabled label="Disabled" variant="ghost" />
          <Button label="Saving…" loading variant="ghost" />
        </Card>
        <Card title="Destructive">
          <Button label="Delete this document" variant="destructive" />
          <Button disabled label="Disabled" variant="destructive" />
          <Button label="Deleting…" loading variant="destructive" />
        </Card>
        <Card title="Sizes and width">
          <Button label="Small" size="small" variant="secondary" />
          <Button label="Medium (default)" variant="secondary" />
          <Button fullWidth label="Large, full width" size="large" />
        </Card>
      </Section>

      <Section description="The workhorse: icon or avatar, title, subtitle, trailing." title="Rows">
        <Card padding="sm" title="ListRow">
          <ListRow
            icon={Pill}
            onPress={() => undefined}
            subtitle="8:00 AM · With breakfast"
            title="Lisinopril 10 mg"
          />
          <ListRow
            divider
            icon={House}
            onPress={() => undefined}
            subtitle="Friday, 10:30 AM"
            title="Cardiology"
          />
          <ListRow
            avatarName="Margaret Chen"
            divider
            onPress={() => undefined}
            subtitle="Lives at home"
            title="Margaret, 78"
          />
          <ListRow
            divider
            subtitle="No action needed"
            title="Metformin 500 mg"
            trailing={<Badge label="Given" tone="success" />}
          />
          <ListRow
            divider
            onPress={() => undefined}
            subtitle="Opens the vault"
            title="Documents"
            trailing={<Badge label="10" />}
          />
          {/*
            The stacked variant: the badge keeps the first line, the sentence
            gets the whole width beneath it. This is the members roster's row,
            and the reason the subtitle is not clamped here.
          */}
          <ListRow
            avatarName="Margaret Chen"
            divider
            subtitle="Runs the circle. Can change anything, including who is in it."
            subtitleBelow
            title="Margaret Chen (you)"
            trailing={<Badge label="Owner" tone="brand" />}
          />
          <ListRow
            avatarName="Priya Raman"
            divider
            onPress={() => undefined}
            subtitle="A paid aide or a neighbour. Sees the plan and checks off what they did."
            subtitleBelow
            title="Priya Raman"
            trailing={<Badge label="Visiting helper" tone="brand" />}
          />
        </Card>
      </Section>

      <Section description="A status always carries a glyph and a word." title="Badges and status">
        <Card title="Badge">
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.space.xs }}>
            <Badge label="Neutral" />
            <Badge label="Brand" tone="brand" />
            <Badge label="Accent" tone="accent" />
            <Badge icon={CheckCheck} label="Given" tone="success" />
            <Badge icon={TriangleAlert} label="Due soon" tone="warning" />
            <Badge icon={CircleAlert} label="Missed" tone="danger" />
          </View>
        </Card>
        <Card title="StatusPill">
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.space.xs }}>
            <StatusPill label="Given" status="success" />
            <StatusPill label="Needs attention" status="warning" />
            <StatusPill label="Missed" status="danger" />
            <StatusPill label="Upcoming" status="neutral" />
          </View>
        </Card>
      </Section>

      <Section
        description="Label, hint, inline error and the a11y wiring that goes with them."
        title="Fields"
      >
        <Card title="TextField">
          <TextField
            label="Medication name"
            onChangeText={setName}
            placeholder="Type it exactly as the label says"
            value={name}
          />
          <TextField
            hint="As written on the bottle."
            label="Strength"
            optional
            placeholder="10 mg"
          />
          <TextField
            error="Add a name so your family knows what this is."
            label="Prescriber"
            placeholder="Dr. Patel"
          />
          <TextField editable={false} label="Read-only" value="Dr. Patel" />
        </Card>
        <Card title="Field around another control">
          <Field label="Which circle" hint="You can switch at any time.">
            <SegmentedControl
              accessibilityLabel="Which circle"
              onChange={setSegment}
              options={[
                { label: 'This week', value: 'week' },
                { label: 'This month', value: 'month' },
              ]}
              value={segment}
            />
          </Field>
        </Card>
      </Section>

      <Section
        description="Two to four choices, 48pt each, announced as radio buttons."
        title="Segmented control"
      >
        <SegmentedControl
          accessibilityLabel="Period"
          onChange={setSegment}
          options={[
            { icon: House, label: 'Today', value: 'week' },
            { icon: Wallet, label: 'Month', value: 'month' },
          ]}
          value={segment}
        />
      </Section>

      <Section
        description="The whole row is the target, and the state is written out."
        title="Switches"
      >
        <Card>
          <Switch
            description="A quiet nudge the morning a dose is due."
            label="Reminders"
            onValueChange={setReminders}
            value={reminders}
          />
          <Switch
            description="Only the essentials, nothing with health details."
            label="Quiet hours"
            onValueChange={setQuiet}
            value={quiet}
          />
          <Switch disabled label="Locked by your plan" onValueChange={setQuiet} value={false} />
        </Card>
      </Section>

      <Section description="Initials on a soft tint — no photos to upload." title="People">
        <Card>
          <View style={{ alignItems: 'center', flexDirection: 'row', gap: theme.space.sm }}>
            <Avatar name="Margaret Chen" size="large" />
            <Avatar name="Dana Reed" />
            <Avatar name="Mike Reed" size="small" />
            <Avatar name="Sara Alvarez" size="small" />
          </View>
          <AvatarStack
            names={['Dana Reed', 'Mike Reed', 'Sara Alvarez', 'Margaret Chen', 'Tom Reed']}
          />
        </Card>
      </Section>

      <Section description="Loading, empty, and the shape of what is coming." title="States">
        <Card title="Skeleton — text">
          <Skeleton lines={3} />
        </Card>
        <Card title="Skeleton — row">
          <Skeleton lines={2} shape="row" />
        </Card>
        <Card title="Skeleton — card">
          <Skeleton shape="card" />
        </Card>
        <Card padding="sm" title="EmptyState">
          <EmptyState
            actionLabel="Invite family"
            body="Nobody else is here yet. A circle of one is not much of a circle."
            headline="It's just you so far"
            icon={Users}
            onAction={() => undefined}
          />
        </Card>
        <Card padding="sm" title="EmptyState, no action">
          <EmptyState
            body="Documents your family adds will appear here."
            headline="No documents yet"
            icon={FileText}
          />
        </Card>
      </Section>

      <Section
        description="Sheets rise from the bottom; the destructive one asks before it takes."
        title="Sheets"
      >
        <Card>
          <Button
            label="Open a sheet"
            onPress={() => {
              setSheetOpen(true);
            }}
            variant="secondary"
          />
          <Button
            label="Ask before deleting"
            onPress={() => {
              setConfirmOpen(true);
            }}
            variant="secondary"
          />
        </Card>
      </Section>

      <Section
        description="Header, rows and a link — the shape of a real screen."
        title="Screen header"
      >
        <Card>
          <ScreenHeader
            action={
              <View
                style={{
                  alignItems: 'center',
                  flexDirection: 'row',
                  gap: theme.space['2xs'],
                }}
              >
                <Bell color={theme.colors.textSecondary} size={22} strokeWidth={2} />
                <ChevronRight color={theme.colors.textTertiary} size={18} strokeWidth={2} />
              </View>
            }
            eyebrow="Thursday, November 5"
            subtitle="A calm line under the title, at 17px."
            title="Good morning, Dana"
          />
          <Text tone="secondary">
            Every screen is built from these pieces. If something is missing here, it does not
            belong in a screen yet.
          </Text>
        </Card>
      </Section>

      <Sheet
        description="Sheets hold one decision: a form, a confirmation, or a short set of choices."
        onClose={() => {
          setSheetOpen(false);
        }}
        title="This is a sheet"
        visible={sheetOpen}
      >
        <Text tone="secondary">
          The scrim closes it, the hardware back button closes it, and so does the button below.
        </Text>
      </Sheet>

      <ConfirmSheet
        confirmLabel="Delete this document"
        destructive
        loading={confirmLoading}
        message="It will be removed for everyone in the circle. This cannot be undone."
        onClose={() => {
          setConfirmOpen(false);
          setConfirmLoading(false);
        }}
        onConfirm={() => {
          setConfirmLoading(true);
        }}
        title="Delete this document?"
        visible={confirmOpen}
      />

      <Text align="center" tone="tertiary" variant="caption">
        End of the gallery. Hidden screen — not linked from the app.
      </Text>
    </Screen>
  );
}
