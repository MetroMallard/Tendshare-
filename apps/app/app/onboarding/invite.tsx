import { useState } from 'react';

import { InviteView } from '../../src/onboarding/components/InviteView';
import { OnboardingLoadingView } from '../../src/onboarding/components/OnboardingLoadingView';
import { useOnboarding } from '../../src/onboarding/OnboardingProvider';
import { features } from '../../src/lib/features';
import { inviteProblemMessage } from '../../src/onboarding/validation';

/**
 * Step 3 of 3 — invite family, or leave it for later.
 *
 * The addresses typed here are kept on this device and **nothing is sent**:
 * invitations are Task 11 and there is no service behind them yet. The screen
 * says exactly that, in the notice above the field and in the hint under the
 * button, and the skip is a full-width button rather than a grey line.
 */
export default function InviteScreen() {
  const {
    status,
    draft,
    failure,
    submitting,
    offline,
    inviteActions,
    addInviteAddress,
    removeInviteAddress,
    goBack,
    finish,
  } = useOnboarding();

  const [email, setEmail] = useState('');
  const [inviteProblem, setInviteProblem] = useState<string | undefined>(undefined);

  if (status === 'loading') {
    return <OnboardingLoadingView />;
  }

  const onAddEmail = () => {
    const result = addInviteAddress(email);

    if (!result.ok) {
      setInviteProblem(inviteProblemMessage(result.problem));
      return;
    }

    setInviteProblem(undefined);
    setEmail('');
  };

  return (
    <InviteView
      actions={inviteActions}
      addresses={draft.invites}
      email={email}
      failure={failure}
      inviteProblem={inviteProblem}
      invitesEnabled={features.invitesEnabled}
      onAddEmail={onAddEmail}
      onBack={goBack}
      onChangeEmail={(value) => {
        setInviteProblem(undefined);
        setEmail(value);
      }}
      onFinish={() => {
        finish();
      }}
      onRemoveAddress={removeInviteAddress}
      onSkip={() => {
        finish({ skipInvites: true });
      }}
      offline={offline}
      submitting={submitting}
    />
  );
}
