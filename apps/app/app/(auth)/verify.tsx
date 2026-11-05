import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';

import { SessionLoadingView } from '../../src/auth/components/SessionLoadingView';
import { VerifyView } from '../../src/auth/components/VerifyView';
import { digitsOnly } from '../../src/auth/code';
import { nextAvailableAt, secondsRemaining } from '../../src/auth/cooldown';
import type { AuthFailure } from '../../src/auth/errors';
import { useSession } from '../../src/auth/session';

/**
 * Enter the code.
 *
 * The resend cooldown is real: it starts when the code is sent, it is shown as a
 * countdown on the button, and the button is disabled until it ends. That is
 * also what keeps a nervous person from burning through the server's own rate
 * limit and being locked out for an hour.
 */
export default function VerifyRoute() {
  const router = useRouter();
  const { pendingEmail, verifyEmailCode, resendEmailCode, clearPendingEmail, isOffline } =
    useSession();

  const [code, setCode] = useState('');
  const [verifying, setVerifying] = useState(false);
  const [resending, setResending] = useState(false);
  const [failure, setFailure] = useState<AuthFailure | null>(null);
  const [availableAt, setAvailableAt] = useState<number | null>(() => nextAvailableAt(Date.now()));
  const [now, setNow] = useState(() => Date.now());

  // One ticker for the countdown, and it only runs while there is a countdown.
  const resendIn = secondsRemaining(now, availableAt);
  useEffect(() => {
    if (resendIn === 0) {
      return;
    }

    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [resendIn]);

  if (pendingEmail === null) {
    // The route guard is about to send this person back to sign in; showing a
    // form with no address in it for one frame would only be confusing.
    return <SessionLoadingView />;
  }

  const email = pendingEmail;

  async function submit() {
    if (verifying) {
      return;
    }

    setFailure(null);
    setVerifying(true);
    const result = await verifyEmailCode(email, code);
    setVerifying(false);

    if (!result.ok) {
      setFailure(result.failure);
      setCode('');
      return;
    }

    // Signed in. The guard would take it from here; this makes the transition
    // immediate rather than one render later.
    router.replace('/');
  }

  async function resend() {
    if (resending || resendIn > 0) {
      return;
    }

    setFailure(null);
    setResending(true);
    const result = await resendEmailCode(email);
    setResending(false);

    if (!result.ok) {
      setFailure(result.failure);
      return;
    }

    setAvailableAt(nextAvailableAt(Date.now()));
    setNow(Date.now());
  }

  return (
    <VerifyView
      code={code}
      email={email}
      failure={failure}
      offline={isOffline}
      onChangeCode={(value) => {
        setCode(digitsOnly(value));
        if (failure !== null) {
          setFailure(null);
        }
      }}
      onChangeEmail={() => {
        clearPendingEmail();
        router.replace('/sign-in');
      }}
      onResend={() => {
        void resend();
      }}
      onSubmit={() => {
        void submit();
      }}
      resendIn={resendIn}
      resending={resending}
      verifying={verifying}
    />
  );
}
