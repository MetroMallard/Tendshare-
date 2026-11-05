import { useState } from 'react';

import { CareView } from '../../src/onboarding/components/CareView';
import { OnboardingLoadingView } from '../../src/onboarding/components/OnboardingLoadingView';
import { useOnboarding } from '../../src/onboarding/OnboardingProvider';
import {
  checkRecipientName,
  textProblemMessage,
  type Relationship,
} from '../../src/onboarding/validation';

/**
 * Step 2 of 3 — who the family is caring for.
 *
 * A first name and a relationship word. Nothing here is a medical record, and
 * the screen says so out loud.
 */
export default function CareScreen() {
  const {
    status,
    draft,
    failure,
    submitting,
    offline,
    setRecipientName,
    setRelationship,
    goTo,
    goBack,
  } = useOnboarding();

  const [nameError, setNameError] = useState<string | undefined>(undefined);
  const [relationshipError, setRelationshipError] = useState<string | undefined>(undefined);

  if (status === 'loading') {
    return <OnboardingLoadingView />;
  }

  const onSubmit = () => {
    const check = checkRecipientName(draft.recipientName);
    let valid = true;

    if (!check.ok) {
      setNameError(textProblemMessage(check.problem, 'their name'));
      valid = false;
    } else {
      setNameError(undefined);
    }

    if (draft.relationship === null) {
      setRelationshipError('Choose how they are related to you.');
      valid = false;
    } else {
      setRelationshipError(undefined);
    }

    if (valid) {
      goTo('invite');
    }
  };

  return (
    <CareView
      failure={failure}
      nameError={nameError}
      offline={offline}
      onBack={goBack}
      onChangeName={(value) => {
        setNameError(undefined);
        setRecipientName(value);
      }}
      onChangeRelationship={(value: Relationship) => {
        setRelationshipError(undefined);
        setRelationship(value);
      }}
      onSubmit={onSubmit}
      recipientName={draft.recipientName}
      relationship={draft.relationship}
      relationshipError={relationshipError}
      submitting={submitting}
    />
  );
}
