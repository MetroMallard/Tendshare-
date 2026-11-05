import { useRouter } from 'expo-router';
import { useState } from 'react';

import { useSession } from '../../src/auth/session';
import { SignInView } from '../../src/auth/components/SignInView';
import type { AuthFailure } from '../../src/auth/errors';
import type { AuthProviderId } from '../../src/auth/providers';

/**
 * Sign in.
 *
 * The screen holds only what a screen should: what has been typed, whether a
 * request is in flight, and the last thing worth saying about it. Everything
 * else — the session, the providers, the copy for a failure — comes from the
 * session provider or a pure module.
 */
export default function SignInRoute() {
  const router = useRouter();
  const {
    status,
    isOffline,
    providers,
    providersLoading,
    signInWithEmailCode,
    continueWithProvider,
  } = useSession();

  const [email, setEmail] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [busyProvider, setBusyProvider] = useState<AuthProviderId | null>(null);
  const [failure, setFailure] = useState<AuthFailure | null>(null);

  const notConfigured = status === 'notConfigured';

  async function submit() {
    if (submitting || notConfigured) {
      return;
    }

    setFailure(null);
    setSubmitting(true);
    const result = await signInWithEmailCode(email);
    setSubmitting(false);

    if (!result.ok) {
      setFailure(result.failure);
      return;
    }

    // The address is in the session provider's memory only, so the next screen
    // has it without anything being written to disk.
    router.push('/verify');
  }

  async function useProvider(id: AuthProviderId) {
    if (busyProvider !== null) {
      return;
    }

    setFailure(null);
    setBusyProvider(id);
    const result = await continueWithProvider(id);
    setBusyProvider(null);

    if (!result.ok && result.failure.kind !== 'provider_cancelled') {
      setFailure(result.failure);
    }
  }

  return (
    <SignInView
      busyProvider={busyProvider}
      email={email}
      failure={failure}
      notConfigured={notConfigured}
      offline={isOffline}
      onChangeEmail={(value) => {
        setEmail(value);
        if (failure !== null) {
          setFailure(null);
        }
      }}
      onProvider={(id) => {
        void useProvider(id);
      }}
      onSubmit={() => {
        void submit();
      }}
      providers={providers}
      providersLoading={providersLoading}
      submitting={submitting}
    />
  );
}
