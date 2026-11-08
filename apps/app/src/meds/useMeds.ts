/**
 * The meds data, shared by the Meds tab and the Today card.
 *
 * Both screens ask the same question of the same three tables, so they ask it
 * through one hook: a second copy of the reads would be a second set of rules for
 * what "we could not ask" looks like.
 *
 * The snapshot is held in state rather than refetched on every render, so an
 * optimistic tick can be painted immediately and put back if the database says
 * no. `apply` is the one way to change it, which keeps every local edit in one
 * shape — a function from the old snapshot to the new one.
 */
import { useCallback, useEffect, useState } from 'react';

import { getSupabaseClient } from '../lib/supabase';
import { loadMeds, type MedsSnapshot } from './medData';

export type MedsStatus = 'loading' | 'ready' | 'error';

export interface MedsData {
  readonly status: MedsStatus;
  /** `null` until the first successful read. Kept during a reload. */
  readonly snapshot: MedsSnapshot | null;
  readonly reload: () => void;
  /** Paint a local change; the caller owns putting it back. */
  readonly apply: (update: (snapshot: MedsSnapshot) => MedsSnapshot) => void;
}

const EMPTY: MedsSnapshot = { careRecipientId: null, medications: [], checkOffs: [] };

export function useMeds(circleId: string | null, date: string): MedsData {
  const client = getSupabaseClient();
  const [status, setStatus] = useState<MedsStatus>('loading');
  const [snapshot, setSnapshot] = useState<MedsSnapshot | null>(null);
  const [request, setRequest] = useState(0);

  useEffect(() => {
    if (circleId === null || client === null) {
      setStatus(circleId === null ? 'error' : 'loading');
      return;
    }

    let cancelled = false;
    setStatus((current) => (current === 'ready' ? 'ready' : 'loading'));

    void loadMeds(client, circleId, date)
      .then((result) => {
        if (cancelled) {
          return;
        }

        if (result === null) {
          setStatus('error');
          return;
        }

        setSnapshot(result);
        setStatus('ready');
      })
      .catch(() => {
        if (!cancelled) {
          setStatus('error');
        }
      });

    return () => {
      cancelled = true;
    };
  }, [client, circleId, date, request]);

  const reload = useCallback(() => {
    setRequest((current) => current + 1);
  }, []);

  const apply = useCallback((update: (current: MedsSnapshot) => MedsSnapshot) => {
    setSnapshot((current) => update(current ?? EMPTY));
  }, []);

  return { status, snapshot, reload, apply };
}
