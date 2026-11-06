import { View } from 'react-native';

import { Button, Card, ListRow, Text, TextField, useTheme } from '@tendshare/ui';
import { Mail } from 'lucide-react-native';

import { Screen } from '../../components/Screen';
import type { OnboardingFailure } from '../errors';
import type { InviteActions } from '../inviteActions';
import { OnboardingNotice } from './OnboardingNotice';
import { StepHeader } from './StepHeader';

export interface InviteViewProps {
  readonly addresses: readonly string[];
  readonly email: string;
  readonly onChangeEmail: (value: string) => void;
  readonly onAddEmail: () => void;
  readonly onRemoveAddress: (address: string) => void;
  /** One plain sentence about the last address that could not be added. */
  readonly inviteProblem?: string;
  readonly actions: InviteActions;
  readonly onFinish: () => void;
  readonly onSkip: () => void;
  readonly invitesEnabled: boolean;
  readonly offline: boolean;
  readonly submitting: boolean;
  readonly failure: OnboardingFailure | null;
  readonly onBack: () => void;
}

/**
 * Screen 3 — invite family, or honestly don't.
 *
 * Invitations are Task 11. There is no invitation table and no email service, so
 * this screen does not pretend: it says plainly that nothing has been sent, and
 * the addresses added here stay on this device. The skip is a real button at
 * full width, and when no addresses have been added it *is* the primary action,
 * because "Invite them later" is the honest default rather than a failure.
 */
export function InviteView({
  addresses,
  email,
  onChangeEmail,
  onAddEmail,
  onRemoveAddress,
  inviteProblem,
  actions,
  onFinish,
  onSkip,
  invitesEnabled,
  offline,
  submitting,
  failure,
  onBack,
}: InviteViewProps) {
  const theme = useTheme();
  const hasAddresses = addresses.length > 0;

  return (
    <Screen
      keyboardAware
      footer={
        <View style={{ gap: theme.space.xs }}>
          <Button
            disabled={offline}
            fullWidth
            label={actions.primary.label}
            loading={submitting}
            loadingLabel="Setting up your circle"
            onPress={onFinish}
            size="large"
            testID={actions.primary.testID}
          />
          {actions.secondary ? (
            <Button
              fullWidth
              label={actions.secondary.label}
              onPress={onSkip}
              size="large"
              testID={actions.secondary.testID}
              variant="secondary"
            />
          ) : null}
          {actions.primary.hint ? (
            <Text align="center" tone="tertiary" variant="caption">
              {actions.primary.hint}
            </Text>
          ) : null}
        </View>
      }
    >
      <View style={{ gap: theme.space.md }} testID="screen-onboarding-invite">
        <StepHeader
          onBack={onBack}
          step="invite"
          subtitle="Care is easier when it's shared. You can do this now, or any time later."
          title="Invite your family"
          titleTestID="onboarding-invite-title"
        />

        {offline ? (
          <OnboardingNotice
            message="We can't save your circle until you're back online. Everything you've typed is safe on this device."
            testID="onboarding-invite-offline"
            title="You're offline"
            tone="warning"
          />
        ) : null}

        {failure ? (
          <OnboardingNotice
            message={failure.message}
            testID="onboarding-invite-error"
            title={failure.title}
            tone="danger"
          />
        ) : null}

        <OnboardingNotice
          message={
            invitesEnabled
              ? 'We will email each person an invitation. Only people you invite can see your family’s care.'
              : "Invites aren't switched on yet, so nothing has been sent. Any addresses you add stay on this device, and you can send them from More once invites are on."
          }
          testID="onboarding-invite-notice"
          title={invitesEnabled ? 'What happens next' : 'Nothing is sent yet'}
          tone="info"
        />

        <Card>
          <View style={{ gap: theme.space.sm }}>
            <TextField
              autoCapitalize="none"
              autoComplete="email"
              autoCorrect={false}
              editable={!submitting}
              error={inviteProblem}
              inputMode="email"
              keyboardType="email-address"
              label="Their email address"
              onChangeText={onChangeEmail}
              onSubmitEditing={onAddEmail}
              optional
              placeholder="sibling@example.com"
              returnKeyType="done"
              testID="onboarding-invite-email"
              textContentType="emailAddress"
              value={email}
            />

            <Button
              disabled={email.trim().length === 0 || submitting}
              fullWidth
              label={hasAddresses ? 'Add another' : 'Add'}
              onPress={onAddEmail}
              size="medium"
              testID="onboarding-invite-add"
              variant="secondary"
            />

            {hasAddresses ? (
              <View>
                {addresses.map((address, index) => (
                  <ListRow
                    icon={Mail}
                    divider={index > 0}
                    key={address}
                    testID={`onboarding-invite-row-${address}`}
                    title={address}
                    trailing={
                      <Button
                        label="Remove"
                        onPress={() => {
                          onRemoveAddress(address);
                        }}
                        size="small"
                        testID={`onboarding-invite-remove-${address}`}
                        variant="ghost"
                      />
                    }
                  />
                ))}
              </View>
            ) : (
              <Text tone="secondary" variant="caption">
                No one added yet. You can skip this screen entirely.
              </Text>
            )}
          </View>
        </Card>
      </View>
    </Screen>
  );
}
