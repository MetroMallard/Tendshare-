import {
  AlertTriangle,
  Camera,
  HeartHandshake,
  Pill,
  Plus,
  ShieldCheck,
  Stethoscope,
  UserRound,
} from 'lucide-react-native';
import { View } from 'react-native';

import {
  Avatar,
  Badge,
  Button,
  Card,
  EmptyState,
  ListRow,
  ScreenHeader,
  Section,
  Skeleton,
  Text,
  useTheme,
} from '@tendshare/ui';

import { Notice } from '../../components/Notice';
import { Screen } from '../../components/Screen';
import type { CircleRole } from '../../circles/circleState';
import type { Capabilities } from '../../circles/roles';
import {
  CONDITION_KIND_LABELS,
  contactsOf,
  conditionsOf,
  dateOfBirthLabel,
  type CareContact,
  type CareCondition,
  type CareProfile,
  type ContactKind,
  type InsuranceCard,
} from '../profileData';

export interface ProfileViewProps {
  /** The circle's name, for the eyebrow line. */
  readonly circleName: string;
  readonly role: CircleRole | null;
  readonly capabilities: Capabilities;
  readonly loadState: 'loading' | 'ready' | 'error';
  readonly offline: boolean;
  /** `null` while loading or when the read failed. */
  readonly profile: CareProfile | null;
  /** A signed, short-lived URL for the person's photo. */
  readonly photoUrl: string | null;
  /** Card id → signed URL, for the cards that have a photo. */
  readonly cardUrls: Readonly<Record<string, string>>;
  /** A refusal or failure from the last write, in plain language. */
  readonly problem: { readonly title: string; readonly message: string } | null;
  readonly onBack?: () => void;
  readonly onRetry: () => void;
  readonly onEditBasics: () => void;
  readonly onChangePhoto: () => void;
  readonly onAddContact: (kind: ContactKind) => void;
  readonly onEditContact: (contact: CareContact) => void;
  readonly onAddCondition: (kind: CareCondition['kind']) => void;
  readonly onEditCondition: (condition: CareCondition) => void;
  readonly onAddInsurance: () => void;
  readonly onEditInsurance: (card: InsuranceCard) => void;
  readonly testID?: string;
}

/**
 * The person profile: who the family is caring for, and what they have written
 * down about them.
 *
 * Five sections in the order a family fills them in — the basics, doctors,
 * pharmacies, allergies and conditions, insurance cards — because that is the
 * order the information becomes useful: a name and a face, then who to call,
 * then what to tell them, then what to show at a desk.
 *
 * Three things this screen is careful about:
 *
 *   * **It is a notebook.** The allergy section carries the same sentence
 *     onboarding does: this is what the family typed, not medical advice, and
 *     nothing here is checked against anything.
 *   * **A visiting helper sees less, and is told so.** The owner's directive is
 *     that a helper sees the person they are helping — name, photo, relationship
 *     — and nothing about their health. The screen asks `canSeeCareDetails`, the
 *     database refuses the rest, and the helper gets one calm sentence instead of
 *     four empty sections that look like a broken app.
 *   * **Every state is a real state.** Loading is skeletons per section, empty
 *     says what the section is for, error is one retry, offline says what still
 *     works, and read-only is stated rather than shown as greyed-out controls.
 */
export function ProfileView({
  circleName,
  role,
  capabilities,
  loadState,
  offline,
  profile,
  photoUrl,
  cardUrls,
  problem,
  onBack,
  onRetry,
  onEditBasics,
  onChangePhoto,
  onAddContact,
  onEditContact,
  onAddCondition,
  onEditCondition,
  onAddInsurance,
  onEditInsurance,
  testID = 'screen-profile',
}: ProfileViewProps) {
  const theme = useTheme();
  const basics = profile?.basics ?? null;
  const canEdit = capabilities.canEditCareRecipient && !offline;
  const canSeeDetails = capabilities.canSeeCareDetails;

  const doctors = profile === null ? [] : contactsOf(profile, 'doctor');
  const pharmacies = profile === null ? [] : contactsOf(profile, 'pharmacy');
  const conditions = profile === null ? [] : conditionsOf(profile);
  const allergies = conditions.filter((condition) => condition.kind === 'allergy');
  const otherConditions = conditions.filter((condition) => condition.kind === 'condition');

  const name = basics?.fullName ?? 'The person you’re caring for';
  const photo = (
    <Avatar
      accessibilityLabel={basics === null ? 'No photo yet' : `${name}’s photo`}
      name={name}
      size="large"
      testID="profile-photo"
      uri={photoUrl}
    />
  );

  return (
    <Screen>
      <View style={{ gap: theme.space.md }} testID={testID}>
        <ScreenHeader
          eyebrow={circleName}
          onBack={onBack}
          subtitle="Everything the family needs about the person you’re caring for, in one place."
          title={basics?.preferredName ?? basics?.fullName ?? 'Their profile'}
          titleTestID="profile-title"
        />

        {offline ? (
          <Notice
            message="You can read everything here. Adding or changing something needs a connection, so those are paused."
            testID="profile-offline"
            title="You’re offline"
            tone="warning"
          />
        ) : null}

        {problem ? (
          <Notice
            message={problem.message}
            testID="profile-problem"
            title={problem.title}
            tone="danger"
          />
        ) : null}

        {loadState === 'error' ? (
          <Card padding="sm">
            <EmptyState
              actionLabel="Try again"
              body="We couldn’t read their profile just now. Nothing has changed."
              headline="We couldn’t load the profile"
              icon={UserRound}
              onAction={onRetry}
              testID="profile-error"
            />
          </Card>
        ) : loadState === 'loading' ? (
          <LoadingSections />
        ) : basics === null ? (
          <Card padding="sm">
            <EmptyState
              body="Nobody has been added to this circle yet. Once they are, their details live here."
              headline="No one added yet"
              icon={HeartHandshake}
              testID="profile-empty"
            />
          </Card>
        ) : (
          <>
            <Section title="The basics">
              <Card padding="none">
                <View
                  style={{
                    alignItems: 'center',
                    gap: theme.space.xs,
                    paddingBottom: theme.space.sm,
                    paddingHorizontal: theme.space.sm,
                    paddingTop: theme.space.md,
                  }}
                >
                  {photo}
                  <Text align="center" variant="heading">
                    {basics.fullName}
                  </Text>
                  <Text align="center" tone="secondary" variant="caption">
                    {[
                      basics.preferredName === null ? null : `Goes by ${basics.preferredName}`,
                      basics.relationship,
                    ]
                      .filter((part): part is string => part !== null && part.length > 0)
                      .join(' · ') || 'No relationship added yet'}
                  </Text>

                  {canEdit ? (
                    <Button
                      accessibilityHint="Opens your photos to choose a picture."
                      icon={Camera}
                      label={basics.photoPath === null ? 'Add a photo' : 'Change photo'}
                      onPress={onChangePhoto}
                      size="small"
                      testID="profile-photo-button"
                      variant="secondary"
                    />
                  ) : null}
                </View>

                <BasicsRow
                  canEdit={canEdit}
                  label="Full name"
                  onPress={onEditBasics}
                  testID="profile-row-name"
                  value={basics.fullName}
                />
                <BasicsRow
                  canEdit={canEdit}
                  divider
                  label="Preferred name"
                  onPress={onEditBasics}
                  testID="profile-row-preferred-name"
                  value={basics.preferredName}
                />
                <BasicsRow
                  canEdit={canEdit}
                  divider
                  label="Relationship"
                  onPress={onEditBasics}
                  testID="profile-row-relationship"
                  value={basics.relationship}
                />
                <BasicsRow
                  canEdit={canEdit}
                  divider
                  label="Date of birth"
                  onPress={onEditBasics}
                  testID="profile-row-dob"
                  value={basics.dateOfBirth === null ? null : dateOfBirthLabel(basics.dateOfBirth)}
                />
                <BasicsRow
                  canEdit={canEdit}
                  divider
                  label="Phone"
                  onPress={onEditBasics}
                  testID="profile-row-phone"
                  value={basics.phone}
                />
              </Card>

              {canSeeDetails && basics.notes !== null ? (
                <Card testID="profile-notes">
                  <View style={{ gap: theme.space['2xs'] }}>
                    <Text variant="label">A note from the family</Text>
                    <Text tone="secondary">{basics.notes}</Text>
                  </View>
                </Card>
              ) : null}
            </Section>

            {canSeeDetails ? (
              <>
                <Section
                  description="The people who look after them. Their number is one tap away when you need it."
                  title="Doctors"
                >
                  <Card padding="none">
                    {doctors.length === 0 ? (
                      <EmptyState
                        body={`Add the doctor ${name} sees, so nobody has to hunt for the number.`}
                        headline="No doctors yet"
                        icon={Stethoscope}
                        testID="profile-doctors-empty"
                      />
                    ) : (
                      doctors.map((contact, index) => (
                        <ContactRow
                          key={contact.id}
                          canEdit={canEdit}
                          contact={contact}
                          divider={index > 0}
                          onPress={() => {
                            onEditContact(contact);
                          }}
                        />
                      ))
                    )}
                  </Card>

                  {canEdit ? (
                    <Button
                      fullWidth
                      icon={Plus}
                      label="Add a doctor"
                      onPress={() => {
                        onAddContact('doctor');
                      }}
                      testID="profile-add-doctor"
                      variant="secondary"
                    />
                  ) : null}
                </Section>

                <Section
                  description="Where prescriptions are collected, and who to call about a refill."
                  title="Pharmacies"
                >
                  <Card padding="none">
                    {pharmacies.length === 0 ? (
                      <EmptyState
                        body="Add the pharmacy on the corner, so a refill is never a phone call nobody has the number for."
                        headline="No pharmacy yet"
                        icon={Pill}
                        testID="profile-pharmacies-empty"
                      />
                    ) : (
                      pharmacies.map((contact, index) => (
                        <ContactRow
                          key={contact.id}
                          canEdit={canEdit}
                          contact={contact}
                          divider={index > 0}
                          onPress={() => {
                            onEditContact(contact);
                          }}
                        />
                      ))
                    )}
                  </Card>

                  {canEdit ? (
                    <Button
                      fullWidth
                      icon={Plus}
                      label="Add a pharmacy"
                      onPress={() => {
                        onAddContact('pharmacy');
                      }}
                      testID="profile-add-pharmacy"
                      variant="secondary"
                    />
                  ) : null}
                </Section>

                <Section
                  description="Exactly as your family words it — nothing here is checked against anything."
                  title="Allergies and conditions"
                >
                  <Card padding="none">
                    {conditions.length === 0 ? (
                      <EmptyState
                        body={`Write down what ${name} is allergic to and what they live with, in your own words.`}
                        headline="Nothing written down yet"
                        icon={AlertTriangle}
                        testID="profile-conditions-empty"
                      />
                    ) : (
                      <>
                        {allergies.map((condition, index) => (
                          <ConditionRow
                            key={condition.id}
                            canEdit={canEdit}
                            condition={condition}
                            divider={index > 0}
                            onPress={() => {
                              onEditCondition(condition);
                            }}
                          />
                        ))}
                        {otherConditions.map((condition, index) => (
                          <ConditionRow
                            key={condition.id}
                            canEdit={canEdit}
                            condition={condition}
                            divider={index > 0 || allergies.length > 0}
                            onPress={() => {
                              onEditCondition(condition);
                            }}
                          />
                        ))}
                      </>
                    )}
                  </Card>

                  {canEdit ? (
                    <View style={{ flexDirection: 'row', gap: theme.space.xs }}>
                      <View style={{ flex: 1 }}>
                        <Button
                          fullWidth
                          label="Add an allergy"
                          onPress={() => {
                            onAddCondition('allergy');
                          }}
                          testID="profile-add-allergy"
                          variant="secondary"
                        />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Button
                          fullWidth
                          label="Add a condition"
                          onPress={() => {
                            onAddCondition('condition');
                          }}
                          testID="profile-add-condition"
                          variant="secondary"
                        />
                      </View>
                    </View>
                  ) : null}

                  {/*
                    The same sentence onboarding uses. It is repeated here because
                    this is the screen where somebody is most likely to expect the
                    app to have an opinion — and it never does.
                  */}
                  <Notice
                    message="We only help your family stay organised. We don’t give medical advice, and nothing here is checked against anything else."
                    testID="profile-not-medical"
                    title="This isn’t medical information"
                  />
                </Section>

                <Section
                  description="The cards you are asked for at a hospital desk. The photo is private to this circle."
                  title="Insurance cards"
                >
                  <Card padding="none">
                    {(profile?.insurance.length ?? 0) === 0 ? (
                      <EmptyState
                        body="Add a card once and nobody has to photograph it again in a waiting room."
                        headline="No cards yet"
                        icon={ShieldCheck}
                        testID="profile-insurance-empty"
                      />
                    ) : (
                      profile?.insurance.map((card, index) => (
                        <ListRow
                          key={card.id}
                          accessibilityHint={canEdit ? 'Opens the card to edit it.' : undefined}
                          divider={index > 0}
                          icon={ShieldCheck}
                          onPress={
                            canEdit
                              ? () => {
                                  onEditInsurance(card);
                                }
                              : undefined
                          }
                          showChevron={canEdit}
                          subtitle={
                            card.memberId === null
                              ? 'No member ID added'
                              : `Member ${card.memberId}${card.groupNumber === null ? '' : ` · Group ${card.groupNumber}`}`
                          }
                          subtitleBelow
                          testID={`profile-insurance-${card.id}`}
                          title={card.planName}
                          trailing={
                            cardUrls[card.id] === undefined &&
                            card.imagePath === null ? undefined : (
                              <Badge label="Photo" tone="success" />
                            )
                          }
                        />
                      ))
                    )}
                  </Card>

                  {canEdit ? (
                    <Button
                      fullWidth
                      icon={Plus}
                      label="Add a card"
                      onPress={onAddInsurance}
                      testID="profile-add-insurance"
                      variant="secondary"
                    />
                  ) : null}
                </Section>
              </>
            ) : (
              /*
                The visiting helper's whole screen. One sentence, in plain words,
                instead of four sections that are empty for a reason they cannot
                see — and a promise the database keeps, not just this screen.
              */
              <Notice
                message={`You can see who you’re helping. Doctors, allergies and insurance stay with the family — ask them if you need something.`}
                testID="profile-helper-notice"
                title="This is the part you can see"
                tone="info"
              />
            )}

            {!capabilities.canEditCareRecipient ? (
              <Notice
                message={`You can read everything here. Changing ${name}’s details is the family’s job.`}
                testID="profile-read-only"
                title="You’re here as a reader"
                tone="info"
              />
            ) : null}

            {role === null ? null : (
              <Text align="center" tone="tertiary" variant="caption">
                Changes here are recorded in the circle’s activity log.
              </Text>
            )}
          </>
        )}
      </View>
    </Screen>
  );
}

function BasicsRow({
  label,
  value,
  canEdit,
  onPress,
  divider,
  testID,
}: {
  readonly label: string;
  readonly value: string | null;
  readonly canEdit: boolean;
  readonly onPress: () => void;
  readonly divider?: boolean;
  readonly testID: string;
}) {
  return (
    <ListRow
      accessibilityHint={canEdit ? 'Opens the basics to edit them.' : undefined}
      divider={divider}
      onPress={canEdit ? onPress : undefined}
      showChevron={canEdit}
      subtitle={value === null || value.length === 0 ? 'Not added yet' : value}
      testID={testID}
      title={label}
    />
  );
}

function ContactRow({
  contact,
  canEdit,
  onPress,
  divider,
}: {
  readonly contact: CareContact;
  readonly canEdit: boolean;
  readonly onPress: () => void;
  readonly divider: boolean;
}) {
  const parts = [contact.organisation, contact.phone].filter(
    (part): part is string => part !== null && part.trim().length > 0,
  );

  return (
    <ListRow
      accessibilityHint={canEdit ? 'Opens this contact to edit it.' : undefined}
      divider={divider}
      icon={contact.kind === 'pharmacy' ? Pill : Stethoscope}
      onPress={canEdit ? onPress : undefined}
      showChevron={canEdit}
      subtitle={parts.length === 0 ? 'No phone number yet' : parts.join(' · ')}
      subtitleBelow
      testID={`profile-contact-${contact.id}`}
      title={contact.name}
      trailing={contact.isPrimary ? <Badge label="Main" tone="brand" /> : undefined}
    />
  );
}

function ConditionRow({
  condition,
  canEdit,
  onPress,
  divider,
}: {
  readonly condition: CareCondition;
  readonly canEdit: boolean;
  readonly onPress: () => void;
  readonly divider: boolean;
}) {
  return (
    <ListRow
      accessibilityHint={canEdit ? 'Opens this to edit it.' : undefined}
      divider={divider}
      onPress={canEdit ? onPress : undefined}
      showChevron={canEdit}
      subtitle={condition.notes ?? undefined}
      subtitleBelow={condition.notes !== null}
      testID={`profile-condition-${condition.id}`}
      title={condition.label}
      trailing={
        <Badge
          label={CONDITION_KIND_LABELS[condition.kind]}
          tone={condition.kind === 'allergy' ? 'warning' : 'neutral'}
        />
      }
    />
  );
}

/** Four sections of skeleton, shaped like the real thing. */
function LoadingSections() {
  const theme = useTheme();

  return (
    <View style={{ gap: theme.space.md }}>
      {['basics', 'doctors', 'conditions', 'insurance'].map((section) => (
        <Card key={section} padding="sm" testID={`profile-loading-${section}`}>
          <View style={{ gap: theme.space.sm }}>
            <Skeleton lines={1} width={140} />
            <Skeleton lines={2} />
          </View>
        </Card>
      ))}
    </View>
  );
}
