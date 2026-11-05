/**
 * The three screens' shared state: the draft, the finish button, and the way
 * back.
 *
 * One provider above the onboarding stack means every screen reads the same
 * answers, back navigation cannot lose a typed name, and the finish flow exists
 * once instead of three times. It also owns the two things a screen must never
 * do on its own: write the rows, and decide where to go afterwards.
 *
 * Deliberate choices worth knowing about:
 *
 *   * **The draft is written as it is typed**, debounced a moment so a fast
 *     typist does not hammer the keychain. That is what makes "close the app on
 *     screen 2" harmless.
 *   * **A failure never discards the draft.** Every failure path leaves the
 *     answers in place and the person on the screen that failed, with a sentence
 *     about what to do and a button that tries again.
 *   * **Finishing tells the circle provider first**, then navigates. The other
 *     order lets the route guard see "no circle" for a frame and bounce the
 *     person back into setup they have just completed.
 */
import { useRouter } from 'expo-router';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PropsWithChildren,
} from 'react';

import { useSession } from '../auth/session';
import { useCircle } from '../circles/CircleProvider';
import { getSupabaseClient } from '../lib/supabase';
import { HOME_PATH } from '../navigation/authGuard';
import { completeOnboarding } from './complete';
import { clearDraft, loadDraft, saveDraft, savePendingInvites } from './draftStore';
import { emptyDraft, hasName, resumeStep, type OnboardingDraft } from './draft';
import { onboardingFailureOf, type OnboardingFailure } from './errors';
import { currentInviteActions, type InviteActions } from './inviteActions';
import { previousStep, stepPath, type OnboardingStep } from './steps';
import { suggestDisplayName } from './suggestName';
import { addInvite, removeInvite, type InviteResult, type Relationship } from './validation';
import { supabaseWrites } from './writes.supabase';

export interface OnboardingValue {
  /** `loading` while the stored draft is being read back. */
  readonly status: 'loading' | 'ready';
  readonly draft: OnboardingDraft;
  /** Where this person should start, given what is already filled in. */
  readonly resumeAt: OnboardingStep;
  readonly failure: OnboardingFailure | null;
  readonly submitting: boolean;
  readonly offline: boolean;
  readonly inviteActions: InviteActions;
  readonly setDisplayName: (value: string) => void;
  readonly setRecipientName: (value: string) => void;
  readonly setRelationship: (value: Relationship) => void;
  readonly addInviteAddress: (raw: string) => InviteResult;
  readonly removeInviteAddress: (address: string) => void;
  readonly goTo: (step: OnboardingStep) => void;
  readonly goBack: () => void;
  readonly startOver: () => void;
  readonly finish: (options?: { readonly skipInvites?: boolean }) => void;
  readonly dismissFailure: () => void;
}

const OnboardingContext = createContext<OnboardingValue | null>(null);

/** Long enough to skip intermediate keystrokes, short enough to survive a close. */
const SAVE_DEBOUNCE_MS = 300;

export function OnboardingProvider({ children }: PropsWithChildren) {
  const router = useRouter();
  const circle = useCircle();
  const { user, displayName: profileName, isOffline } = useSession();
  const client = getSupabaseClient();
  const writes = useMemo(() => (client === null ? null : supabaseWrites(client)), [client]);

  const [draft, setDraft] = useState<OnboardingDraft>(emptyDraft);
  const [status, setStatus] = useState<'loading' | 'ready'>('loading');
  const [failure, setFailure] = useState<OnboardingFailure | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const suggestionRef = useRef<string>('');

  // ---- Read the draft back, once ------------------------------------------
  useEffect(() => {
    let cancelled = false;

    const suggestion = suggestDisplayName({
      profileName,
      metadata: user?.user_metadata ?? null,
      email: user?.email ?? null,
    });
    suggestionRef.current = suggestion;

    void loadDraft().then((stored) => {
      if (cancelled) {
        return;
      }

      // A name already typed (and saved) wins over the suggestion; a suggestion
      // is a starting point, never an overwrite.
      setDraft(hasName(stored) ? stored : { ...stored, displayName: suggestion });
      setStatus('ready');
    });

    return () => {
      cancelled = true;
    };
    // Mount only, deliberately: a later change to the profile must not clobber
    // an answer the person has already typed.
  }, []);

  // ---- Persist as they type ----------------------------------------------
  useEffect(() => {
    if (status !== 'ready') {
      return;
    }

    const timer = setTimeout(() => {
      void saveDraft(draft);
    }, SAVE_DEBOUNCE_MS);

    return () => {
      clearTimeout(timer);
    };
  }, [draft, status]);

  const userId = user?.id ?? null;

  const setDisplayName = useCallback((value: string) => {
    setDraft((current) => ({ ...current, displayName: value }));
    setFailure(null);
  }, []);

  const setRecipientName = useCallback((value: string) => {
    setDraft((current) => ({ ...current, recipientName: value }));
    setFailure(null);
  }, []);

  const setRelationship = useCallback((value: Relationship) => {
    setDraft((current) => ({ ...current, relationship: value }));
    setFailure(null);
  }, []);

  const addInviteAddress = useCallback(
    (raw: string): InviteResult => {
      const result = addInvite(draft.invites, raw);

      if (result.ok) {
        setDraft((current) => ({ ...current, invites: result.addresses }));
      }

      return result;
    },
    [draft.invites],
  );

  const removeInviteAddress = useCallback((address: string) => {
    setDraft((current) => ({ ...current, invites: removeInvite(current.invites, address) }));
  }, []);

  const goTo = useCallback(
    (step: OnboardingStep) => {
      setDraft((current) => ({ ...current, step }));
      setFailure(null);
      router.push(stepPath(step));
    },
    [router],
  );

  const goBack = useCallback(() => {
    const target = previousStep(draft.step);

    if (target === null) {
      return;
    }

    setDraft((current) => ({ ...current, step: target }));
    setFailure(null);

    // A fresh load of `/onboarding/care` has nothing behind it; going back then
    // means the previous screen, not leaving the app.
    if (typeof router.canGoBack === 'function' && router.canGoBack()) {
      router.back();
    } else {
      router.replace(stepPath(target));
    }
  }, [draft.step, router]);

  const startOver = useCallback(() => {
    setFailure(null);
    void clearDraft();
    setDraft({ ...emptyDraft(), displayName: suggestionRef.current });
    router.replace(stepPath('you'));
  }, [router]);

  const finish = useCallback(
    (options?: { readonly skipInvites?: boolean }) => {
      if (submitting) {
        return;
      }

      const submitted: OnboardingDraft =
        options?.skipInvites === true ? { ...draft, invites: [] } : draft;

      setSubmitting(true);
      setFailure(null);

      if (writes === null || userId === null) {
        setFailure(onboardingFailureOf(writes === null ? 'not_configured' : 'signed_out'));
        setSubmitting(false);
        return;
      }

      void completeOnboarding(writes, {
        userId,
        draft: submitted,
        existingCircleId: draft.circleId ?? circle.circleId,
        offline: isOffline,
      })
        .then(async (result) => {
          if (!result.ok) {
            setFailure(result.failure);
            setDraft((current) => ({ ...current, circleId: result.circleId }));
            setSubmitting(false);
            return;
          }

          // The addresses are kept on this device because invites are not
          // switched on yet; nothing has been sent.
          await savePendingInvites(result.invites);
          await clearDraft();

          setDraft(emptyDraft());
          setSubmitting(false);
          circle.adopt(result.circleId);
          router.replace(HOME_PATH);
        })
        .catch(() => {
          setFailure(onboardingFailureOf('unknown'));
          setSubmitting(false);
        });
    },
    [circle, draft, isOffline, router, submitting, userId, writes],
  );

  const dismissFailure = useCallback(() => {
    setFailure(null);
  }, []);

  const resumeAt = useMemo(() => resumeStep(draft), [draft]);
  const inviteActions = useMemo(
    () => currentInviteActions(draft.invites.length),
    [draft.invites.length],
  );

  const value = useMemo<OnboardingValue>(
    () => ({
      status,
      draft,
      resumeAt,
      failure,
      submitting,
      offline: isOffline,
      inviteActions,
      setDisplayName,
      setRecipientName,
      setRelationship,
      addInviteAddress,
      removeInviteAddress,
      goTo,
      goBack,
      startOver,
      finish,
      dismissFailure,
    }),
    [
      status,
      draft,
      resumeAt,
      failure,
      submitting,
      isOffline,
      inviteActions,
      setDisplayName,
      setRecipientName,
      setRelationship,
      addInviteAddress,
      removeInviteAddress,
      goTo,
      goBack,
      startOver,
      finish,
      dismissFailure,
    ],
  );

  return <OnboardingContext.Provider value={value}>{children}</OnboardingContext.Provider>;
}

export function useOnboarding(): OnboardingValue {
  const value = useContext(OnboardingContext);

  if (value === null) {
    throw new Error('useOnboarding must be used inside <OnboardingProvider>.');
  }

  return value;
}
