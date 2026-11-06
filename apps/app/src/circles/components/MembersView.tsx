import { HeartHandshake, Users } from 'lucide-react-native';
import { View } from 'react-native';

import {
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
import type { CircleMember, CareRecipientSummary } from '../loadCircles';
import type { CircleRole } from '../circleState';
import type { Capabilities } from '../roles';
import { ALL_ROLES, ROLES, canChangeRoleOf, capabilitySummary, roleLabel } from '../roles';

export interface MembersViewProps {
  /** The circle's name, for the eyebrow line. */
  readonly circleName: string;
  /** The reader's role in this circle. */
  readonly role: CircleRole | null;
  readonly capabilities: Capabilities;
  readonly recipient: CareRecipientSummary | null;
  /** `null` while loading. */
  readonly members: readonly CircleMember[] | null;
  /** From `plan_limits`; `null` means no limit, or no answer. */
  readonly memberLimit: number | null;
  readonly loadState: 'loading' | 'ready' | 'error';
  readonly offline: boolean;
  /** A refusal or failure from the last action, in plain language. */
  readonly problem: { readonly title: string; readonly message: string } | null;
  readonly onBack?: () => void;
  readonly onRetry: () => void;
  readonly onSelectMember?: (member: CircleMember) => void;
  readonly onRename: () => void;
  readonly testID?: string;
}

/**
 * The members screen: who is in this circle, what each of them may do, and the
 * two things an owner can change here.
 *
 * Read-only for everyone but the owner, and that is said out loud rather than
 * shown as greyed-out controls: a disabled button a family member can never
 * enable is a small daily reminder that they are not trusted, and the brief is
 * explicit about calm over mechanism.
 *
 * Loading, error, offline and empty are all first-class: the roster is the one
 * screen where "nobody is here" and "we could not ask" must never look alike.
 */
export function MembersView({
  circleName,
  role,
  capabilities,
  recipient,
  members,
  memberLimit,
  loadState,
  offline,
  problem,
  onBack,
  onRetry,
  onSelectMember,
  onRename,
  testID = 'screen-members',
}: MembersViewProps) {
  const theme = useTheme();
  const roster = members ?? [];
  const atLimit = memberLimit !== null && roster.length >= memberLimit;

  return (
    <Screen>
      <View style={{ gap: theme.space.md }} testID={testID}>
        <ScreenHeader
          backLabel="Back to More"
          eyebrow={circleName}
          onBack={onBack}
          subtitle={`Everyone who can see what’s happening${recipient ? ` with ${recipient.fullName}` : ''}.`}
          title="Your circle"
          titleTestID="members-title"
        />

        {offline ? (
          <Notice
            message="You can read everything here. Changing a role or removing someone needs a connection, so those are paused."
            testID="members-offline"
            title="You’re offline"
            tone="warning"
          />
        ) : null}

        {problem ? (
          <Notice
            message={problem.message}
            testID="members-problem"
            title={problem.title}
            tone="danger"
          />
        ) : null}

        <Section title="Who you’re caring for">
          <Card padding="none">
            {loadState === 'loading' ? (
              <View style={{ gap: theme.space.sm, padding: theme.space.sm }}>
                <Skeleton lines={2} testID="members-recipient-loading" />
              </View>
            ) : recipient === null ? (
              <EmptyState
                body="Nobody has been added to this circle yet."
                headline="No one added yet"
                icon={HeartHandshake}
                testID="members-recipient-empty"
              />
            ) : (
              <ListRow
                avatarName={recipient.fullName}
                showChevron={false}
                subtitle={recipient.relationship ?? 'Relationship not added'}
                testID="members-recipient"
                title={recipient.fullName}
              />
            )}
          </Card>
        </Section>

        <Section
          description={
            memberLimit === null
              ? undefined
              : `This plan covers up to ${String(memberLimit)} people. Everyone here counts, and nobody is removed when a plan changes.`
          }
          title="People in this circle"
        >
          <Card padding="none">
            {loadState === 'loading' ? (
              <View style={{ gap: theme.space.md, padding: theme.space.sm }}>
                <Skeleton lines={2} testID="members-loading-one" />
                <Skeleton lines={2} testID="members-loading-two" />
                <Skeleton lines={2} testID="members-loading-three" />
              </View>
            ) : loadState === 'error' ? (
              <EmptyState
                actionLabel="Try again"
                body="We couldn’t read who is in this circle. Nothing has changed."
                headline="We couldn’t load the circle"
                icon={Users}
                onAction={onRetry}
                testID="members-error"
              />
            ) : roster.length === 0 ? (
              <EmptyState
                body="Nobody is in this circle yet."
                headline="Just you, for now"
                icon={Users}
                testID="members-empty"
              />
            ) : (
              roster.map((member, index) => {
                const canManage = canChangeRoleOf(role, member.role) && !offline;

                return (
                  <ListRow
                    key={member.profileId}
                    accessibilityHint={
                      canManage ? 'Opens a sheet to change their role or remove them.' : undefined
                    }
                    avatarName={member.displayName}
                    divider={index > 0}
                    onPress={
                      canManage && onSelectMember
                        ? () => {
                            onSelectMember(member);
                          }
                        : undefined
                    }
                    showChevron={canManage}
                    subtitle={ROLES[member.role].description}
                    testID={`members-row-${member.profileId}`}
                    title={member.isSelf ? `${member.displayName} (you)` : member.displayName}
                    trailing={<Badge label={roleLabel(member.role)} tone="brand" />}
                  />
                );
              })
            )}
          </Card>

          {atLimit ? (
            <Notice
              message={`Everyone already in the circle stays exactly where they are. A bigger plan is the only way to add someone new.`}
              testID="members-plan-limit"
              title={`This plan covers ${String(memberLimit)} people`}
              tone="warning"
            />
          ) : null}
        </Section>

        {capabilities.canManageMembers ? (
          <Card padding="none">
            <ListRow
              accessibilityHint="Opens a sheet with the circle’s name."
              icon={Users}
              onPress={onRename}
              subtitle="What the family sees at the top of every screen."
              testID="members-rename"
              title="Rename this circle"
            />
          </Card>
        ) : (
          <Notice
            message="You can see everyone here. Changing a role, removing someone or renaming the circle is the owner’s job."
            testID="members-read-only"
            title="You’re here as a reader"
            tone="info"
          />
        )}

        {/*
          No invite button yet. Saying so is the honest version of a control that
          does nothing: the alternative is a button that promises an email and
          sends none. Same wording as the last onboarding screen.
        */}
        <Notice
          message="We’re still building invitations. Nothing has been sent to anyone, and nobody has been left out."
          testID="members-invites-not-yet"
          title="Inviting family isn’t available yet"
          tone="info"
        />

        <Section
          description="Roles are how the circle shares the work without sharing everything."
          title="What each role can do"
        >
          <View style={{ gap: theme.space.sm }}>
            {ALL_ROLES.map((each) => (
              <Card key={each} padding="sm" testID={`members-role-${each}`}>
                <View style={{ gap: theme.space['2xs'] }}>
                  <View
                    style={{
                      alignItems: 'center',
                      flexDirection: 'row',
                      gap: theme.space.xs,
                    }}
                  >
                    <Text variant="bodyStrong">{ROLES[each].label}</Text>
                    {each === role ? <Badge label="You" tone="neutral" /> : null}
                  </View>
                  <Text tone="secondary" variant="caption">
                    {ROLES[each].description}
                  </Text>
                  <Text tone="tertiary" variant="caption">
                    {capabilitySummary(each).join(' · ')}
                  </Text>
                </View>
              </Card>
            ))}
          </View>
        </Section>

        <Button
          fullWidth
          label="Back"
          onPress={onBack}
          size="large"
          testID="members-done"
          variant="secondary"
        />
      </View>
    </Screen>
  );
}
