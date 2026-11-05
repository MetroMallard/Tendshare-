import { useState } from 'react';

import { OnboardingLoadingView } from '../../src/onboarding/components/OnboardingLoadingView';
import { YouView } from '../../src/onboarding/components/YouView';
import { useOnboarding } from '../../src/onboarding/OnboardingProvider';
import { draftHasContent } from '../../src/onboarding/draft';
import { checkDisplayName, textProblemMessage } from '../../src/onboarding/validation';

/**
 * Step 1 of 3 — the name their family will see.
 *
 * The route owns nothing but the inline error; the answer itself lives in the
 * draft, so going back and forth or killing the app cannot lose it.
 */
export default function YouScreen() {
  const { status, draft, failure, submitting, offline, setDisplayName, goTo, startOver } =
    useOnboarding();

  const [nameError, setNameError] = useState<string | undefined>(undefined);

  if (status === 'loading') {
    return <OnboardingLoadingView />;
  }

  const onSubmit = () => {
    const check = checkDisplayName(draft.displayName);

    if (!check.ok) {
      setNameError(textProblemMessage(check.problem, 'your name'));
      return;
    }

    setNameError(undefined);
    goTo('care');
  };

  return (
    <YouView
      displayName={draft.displayName}
      failure={failure}
      nameError={nameError}
      offline={offline}
      onChangeName={(value) => {
        setNameError(undefined);
        setDisplayName(value);
      }}
      onSubmit={onSubmit}
      onStartOver={draftHasContent(draft) ? startOver : undefined}
      submitting={submitting}
    />
  );
}
