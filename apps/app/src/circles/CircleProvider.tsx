/**
 * One question, asked once per session: does this person have a circle — and if
 * so, which one are they looking at?
 *
 * The first half routes the whole app (onboarding or Today), so it lives above
 * the navigator rather than being re-asked by each screen. Task 6 added the
 * second half: a person can be in several circles, and every tab is about one of
 * them at a time.
 *
 * Four rules, all of them about not guessing:
 *
 *   * **Ask when signed in, and only then.** A signed-out visitor has no
 *     question to answer, and no request is made.
 *   * **Never guess.** While the answer is loading, the state says so; if the
 *     lookup fails, it says `error`. The guard moves nobody on either, because a
 *     redirect built on a failed request is how people get stuck in a loop.
 *   * **Believe a write over a read.** `adopt()` is called the instant a circle
 *     is created, so finishing onboarding never races the refetch that would
 *     otherwise bounce the person back into setup. `renameActive()` does the same
 *     for a rename: the header changes the moment the database says yes.
 *   * **Remember the choice on the device.** Which circle you were last in is
 *     written to the keychain (web: `localStorage`) as you switch, and read back
 *     before the first paint of the tabs. It is not a global setting: the phone
 *     in the kitchen and the laptop in the office are different people's views
 *     of the same family.
 *
 * Capabilities are derived here, once, from the active circle's role, so no
 * screen has to remember which roles may do what.
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
import { chooseActiveCircle, rememberedChoiceFor, type CircleSummary } from './activeCircle';
import { activeCircleStore } from './activeCircleStore';
import { resolveCircleState, type CircleState } from './circleState';
import { loadCircleSnapshot } from './loadCircleState';
import { loadCircles } from './loadCircles';
import { capabilitiesFor, type Capabilities } from './roles';

export interface CircleValue {
  /** For the onboarding guard: none, incomplete, ready, loading or error. */
  readonly state: CircleState;
  /** The owned circle still waiting for its person, when there is one. */
  readonly circleId: string | null;
  readonly refresh: () => void;
  /** Called after a successful create: the circle exists, stop asking. */
  readonly adopt: (circleId: string) => void;

  /** Every circle this person is in. Empty while loading, and for a new account. */
  readonly circles: readonly CircleSummary[];
  /** The circle the tabs are about, or `null` when there is none. */
  readonly active: CircleSummary | null;
  /** What the active role may do. All false when there is no circle. */
  readonly capabilities: Capabilities;
  /** `loading` until the list is read; `error` if it could not be. */
  readonly circlesState: 'loading' | 'ready' | 'error';
  /** Switch circles: one tap, remembered on this device. */
  readonly switchTo: (circleId: string) => void;
  /** Ask again — after a retry, or after somebody else changed the roster. */
  readonly reloadCircles: () => void;
  /** After a successful rename, so every header agrees without a refetch. */
  readonly renameActive: (name: string) => void;
}

const CircleContext = createContext<CircleValue | null>(null);

export function CircleProvider({ children }: PropsWithChildren) {
  const { status, user } = useSession();
  const client = getSupabaseClient();
  const userId = user?.id ?? null;

  const [state, setState] = useState<CircleState>('loading');
  const [circleId, setCircleId] = useState<string | null>(null);
  const [request, setRequest] = useState(0);

  const [circles, setCircles] = useState<readonly CircleSummary[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [circlesState, setCirclesState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [circlesRequest, setCirclesRequest] = useState(0);

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

  useEffect(() => {
    if (status !== 'signedIn' || userId === null || client === null) {
      setCircles([]);
      setActiveId(null);
      setCirclesState('ready');
      return;
    }

    let cancelled = false;
    setCirclesState('loading');

    void (async () => {
      try {
        const loaded = await loadCircles(client, userId);

        if (cancelled) {
          return;
        }

        if (loaded === null) {
          setCirclesState('error');
          return;
        }

        // A device that has never chosen, or whose keychain refused, is a first
        // visit: the first circle, which is the one they set up.
        const remembered = await activeCircleStore.get(userId).catch(() => null);

        if (cancelled) {
          return;
        }

        const chosen = chooseActiveCircle(loaded, remembered);

        setCircles(loaded);
        setActiveId(chosen?.circleId ?? null);
        setCirclesState('ready');
      } catch {
        if (!cancelled) {
          setCirclesState('error');
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [status, userId, client, circlesRequest]);

  const refresh = useCallback(() => {
    setRequest((count) => count + 1);
  }, []);

  const adopt = useCallback((_circleId: string) => {
    setState('ready');
    setCircleId(null);
  }, []);

  const reloadCircles = useCallback(() => {
    setCirclesRequest((count) => count + 1);
  }, []);

  const switchTo = useCallback(
    (nextId: string) => {
      setActiveId(nextId);

      if (userId === null) {
        return;
      }

      // Fire and forget: a keychain that refuses must not stop the switch. The
      // worst case is that this device forgets the choice, not that the person
      // cannot change circles.
      const remember = rememberedChoiceFor(circles, nextId);

      void (remember === null
        ? activeCircleStore.clear(userId).catch(() => undefined)
        : activeCircleStore.set(userId, remember).catch(() => undefined));
    },
    [circles, userId],
  );

  const renameActive = useCallback((name: string) => {
    setCircles((current) =>
      current.map((circle) =>
        circle.circleId === activeId ? { ...circle, name } : circle,
      ),
    );
  }, [activeId]);

  const active = useMemo<CircleSummary | null>(() => {
    if (circles.length === 0) {
      return null;
    }

    return circles.find((circle) => circle.circleId === activeId) ?? circles[0] ?? null;
  }, [circles, activeId]);

  const capabilities = useMemo(() => capabilitiesFor(active?.role ?? null), [active]);

  const value = useMemo<CircleValue>(
    () => ({
      state,
      circleId,
      refresh,
      adopt,
      circles,
      active,
      capabilities,
      circlesState,
      switchTo,
      reloadCircles,
      renameActive,
    }),
    [
      state,
      circleId,
      refresh,
      adopt,
      circles,
      active,
      capabilities,
      circlesState,
      switchTo,
      reloadCircles,
      renameActive,
    ],
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
