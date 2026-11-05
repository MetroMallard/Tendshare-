/**
 * One question, asked once per session: does this person have a circle?
 *
 * The answer routes the whole app — onboarding or Today — so it lives in a
 * provider above the navigator rather than being re-asked by each screen. Three
 * rules:
 *
 *   * **Ask when signed in, and only then.** A signed-out visitor has no
 *     question to answer, and no request is made.
 *   * **Never guess.** While the answer is loading, the state says so; if the
 *     lookup fails, it says `error`. The guard moves nobody on either, because
 *     a redirect built on a failed request is how people get stuck in a loop.
 *   * **Believe a write over a read.** `adopt()` is called the instant a circle
 *     is created, so finishing onboarding never races the refetch that would
 *     otherwise bounce the person back into setup.
 */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type PropsWithChildren,
} from 'react';

import { useSession } from '../auth/session';
import { getSupabaseClient } from '../lib/supabase';
import { resolveCircleState, type CircleState } from './circleState';
import { loadCircleSnapshot } from './loadCircleState';

export interface CircleValue {
  readonly state: CircleState;
  /** The owned circle still waiting for its person, when there is one. */
  readonly circleId: string | null;
  readonly refresh: () => void;
  /** Called after a successful create: the circle exists, stop asking. */
  readonly adopt: (circleId: string) => void;
}

const CircleContext = createContext<CircleValue | null>(null);

export function CircleProvider({ children }: PropsWithChildren) {
  const { status, user } = useSession();
  const client = getSupabaseClient();
  const userId = user?.id ?? null;

  const [state, setState] = useState<CircleState>('loading');
  const [circleId, setCircleId] = useState<string | null>(null);
  const [request, setRequest] = useState(0);

  useEffect(() => {
    if (status !== 'signedIn' || userId === null || client === null) {
      setState(status === 'signedIn' ? 'error' : 'none');
      setCircleId(null);
      return;
    }

    let cancelled = false;
    setState('loading');

    void loadCircleSnapshot(client, userId)
      .then((snapshot) => {
        if (cancelled) {
          return;
        }

        if (snapshot === null) {
          setState('error');
          setCircleId(null);
          return;
        }

        const resolution = resolveCircleState(snapshot);
        setState(resolution.state);
        setCircleId(resolution.circleId);
      })
      .catch(() => {
        if (!cancelled) {
          setState('error');
          setCircleId(null);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [status, userId, client, request]);

  const refresh = useCallback(() => {
    setRequest((count) => count + 1);
  }, []);

  const adopt = useCallback((_circleId: string) => {
    setState('ready');
    setCircleId(null);
  }, []);

  const value = useMemo<CircleValue>(
    () => ({ state, circleId, refresh, adopt }),
    [state, circleId, refresh, adopt],
  );

  return <CircleContext.Provider value={value}>{children}</CircleContext.Provider>;
}

export function useCircle(): CircleValue {
  const value = useContext(CircleContext);

  if (value === null) {
    throw new Error('useCircle must be used inside <CircleProvider>.');
  }

  return value;
}
