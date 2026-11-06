import { useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { View } from 'react-native';

import {
  Button,
  Card,
  ConfirmSheet,
  EmptyState,
  OptionList,
  ScreenHeader,
  Sheet,
  Text,
  TextField,
  useTheme,
} from '@tendshare/ui';
import { Users } from 'lucide-react-native';

import { Screen } from '../src/components/Screen';
import { useSession } from '../src/auth/session';
import { useCircle } from '../src/circles/CircleProvider';
import { circleDisplayName } from '../src/circles/activeCircle';
import {
  loadCareRecipient,
  loadCircleMembers,
  loadMemberLimit,
  type CareRecipientSummary,
  type CircleMember,
} from '../src/circles/loadCircles';
import {
  changeMemberRole,
  memberProblemCopy,
  removeCircleMember,
  renameCircle,
  validateCircleName,
  type MemberProblem,
} from '../src/circles/memberActions';
import { ASSIGNABLE_ROLES, CIRCLE_NAME_MAX_LENGTH, ROLES, roleLabel } from '../src/circles/roles';
import { MembersView } from '../src/circles/components/MembersView';
import type { CircleRole } from '../src/circles/circleState';
import { getSupabaseClient } from '../src/lib/supabase';
import { useIsOnline } from '../src/lib/online';

/**
 * The members screen, wired to the database.
 *
 * Every read and write is scoped to the active circle and re-checked by Row
 * Level Security, so the screen can be honest about who may do what without
 * being the thing that enforces it: the capability map decides what to offer,
 * and the database decides what happens.
 *
 * A refusal is not an error state. It closes the sheet and shows one calm
 * sentence above the roster, because "only the owner can do that" is an answer,
 * not a crash.
 */
export default function MembersScreen() {
  const theme = useTheme();
  const router = useRouter();
  const client = getSupabaseClient();
  const { user } = useSession();
  const { active, capabilities, circlesState, reloadCircles, renameActive } = useCircle();
  const online = useIsOnline();

  const [members, setMembers] = useState<readonly CircleMember[] | null>(null);
  const [recipient, setRecipient] = useState<CareRecipientSummary | null>(null);
  const [memberLimit, setMemberLimit] = useState<number | null>(null);
  const [loadState, setLoadState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [request, setRequest] = useState(0);

  const [problem, setProblem] = useState<MemberProblem | null>(null);
  const [selected, setSelected] = useState<CircleMember | null>(null);
  const [confirmingRemove, setConfirmingRemove] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [draftName, setDraftName] = useState('');
  const [nameError, setNameError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const circleId = active?.circleId ?? null;
  const selfId = user?.id ?? '';
  const tier = active?.planTier ?? 'free';

  useEffect(() => {
    if (client === null || circleId === null || selfId === '') {
      setLoadState(circlesState === 'error' ? 'error' : 'loading');
      return;
    }

    let cancelled = false;
    setLoadState('loading');

    void (async () => {
      const [roster, person, limit] = await Promise.all([
        loadCircleMembers(client, circleId, selfId),
        loadCareRecipient(client, circleId),
        loadMemberLimit(client, tier),
      ]);

      if (cancelled) {
        return;
      }

      if (roster === null) {
        setLoadState('error');
        return;
      }

      setMembers(roster);
      setRecipient(person);
      setMemberLimit(limit);
      setLoadState('ready');
    })();

    return () => {
      cancelled = true;
    };
  }, [client, circleId, selfId, tier, request, circlesState]);

  const reload = useCallback(() => {
    setRequest((count) => count + 1);
  }, []);

  const goBack = useCallback(() => {
    router.back();
  }, [router]);

  const applyRole = useCallback(
    (member: CircleMember, role: CircleRole) => {
      if (client === null || circleId === null) {
        return;
      }

      setBusy(true);
      setProblem(null);

      void changeMemberRole(client, { circleId, profileId: member.profileId, role }).then(
        (result) => {
          setBusy(false);
          setSelected(null);

          if (!result.ok) {
            setProblem(result.problem ?? 'unknown');
            return;
          }

          reload();
          reloadCircles();
        },
      );
    },
    [client, circleId, reload, reloadCircles],
  );

  const removeMember = useCallback(() => {
    if (client === null || circleId === null || selected === null) {
      return;
    }

    setBusy(true);
    setProblem(null);

    void removeCircleMember(client, { circleId, profileId: selected.profileId }).then((result) => {
      setBusy(false);
      setConfirmingRemove(false);
      setSelected(null);

      if (!result.ok) {
        setProblem(result.problem ?? 'unknown');
        return;
      }

      reload();
      reloadCircles();
    });
  }, [client, circleId, selected, reload, reloadCircles]);

  const saveName = useCallback(() => {
    if (client === null || circleId === null) {
      return;
    }

    const error = validateCircleName(draftName);

    if (error !== null) {
      setNameError(error);
      return;
    }

    setBusy(true);
    setProblem(null);

    void renameCircle(client, { circleId, name: draftName }).then((result) => {
      setBusy(false);

      if (!result.ok) {
        setProblem(result.problem ?? 'unknown');
        return;
      }

      renameActive(draftName.trim());
      setRenaming(false);
      setNameError(null);
    });
  }, [client, circleId, draftName, renameActive]);

  const problemCopy = problem === null ? null : memberProblemCopy(problem);

  if (active === null) {
    return (
      <Screen>
        <ScreenHeader onBack={goBack} title="Your circle" titleTestID="members-title" />
        <Card padding="sm">
          <EmptyState
            actionLabel={circlesState === 'error' ? 'Try again' : undefined}
            body={
              circlesState === 'error'
                ? 'We couldn’t read your circle just now. Nothing has changed.'
                : 'You’re not in a circle yet. Setting one up takes three short screens.'
            }
            headline={circlesState === 'error' ? 'We couldn’t load it' : 'No circle yet'}
            icon={Users}
            onAction={circlesState === 'error' ? reloadCircles : undefined}
            testID="members-no-circle"
          />
        </Card>
      </Screen>
    );
  }

  return (
    <>
      <MembersView
        capabilities={capabilities}
        circleName={circleDisplayName(active)}
        loadState={loadState}
        memberLimit={memberLimit}
        members={members}
        offline={!online}
        onBack={goBack}
        onOpenRecipient={() => {
          router.push('/profile');
        }}
        onRename={() => {
          setDraftName(active.name ?? '');
          setNameError(null);
          setRenaming(true);
        }}
        onRetry={reload}
        onSelectMember={(member) => {
          setProblem(null);
          setSelected(member);
        }}
        problem={problemCopy}
        recipient={recipient}
        role={active.role}
      />

      <Sheet
        description={
          selected === null
            ? undefined
            : `${selected.displayName} is a ${roleLabel(selected.role).toLowerCase()} now. Pick what they should be.`
        }
        footer={
          <View style={{ gap: theme.space.xs }}>
            <Button
              fullWidth
              label="Remove from circle"
              onPress={() => {
                setConfirmingRemove(true);
              }}
              variant="destructive"
            />
            <Button
              fullWidth
              label="Close"
              onPress={() => {
                setSelected(null);
              }}
              variant="secondary"
            />
          </View>
        }
        onClose={() => {
          setSelected(null);
        }}
        testID="members-role-sheet"
        title={selected === null ? 'Change a role' : `What can ${selected.displayName} do?`}
        visible={selected !== null && !confirmingRemove}
      >
        <OptionList
          accessibilityLabel="Role in this circle"
          onChange={(role) => {
            if (selected !== null) {
              applyRole(selected, role);
            }
          }}
          options={ASSIGNABLE_ROLES.map((role) => ({
            value: role,
            label: ROLES[role].label,
            description: ROLES[role].description,
          }))}
          testID="members-role-option"
          value={selected?.role ?? null}
        />
      </Sheet>

      <ConfirmSheet
        cancelLabel="Keep them in the circle"
        confirmLabel="Remove from circle"
        destructive
        loading={busy}
        message={
          selected === null
            ? ''
            : `${selected.displayName} will stop seeing this circle straight away. Their own account, and everything they have written, stays exactly as it is. You can invite them again later.`
        }
        onClose={() => {
          setConfirmingRemove(false);
        }}
        onConfirm={removeMember}
        testID="members-remove-confirm"
        title={selected === null ? 'Remove from circle?' : `Remove ${selected.displayName}?`}
        visible={confirmingRemove}
      />

      <Sheet
        description={`Up to ${String(CIRCLE_NAME_MAX_LENGTH)} characters. Everyone in the circle sees this name.`}
        footer={
          <View style={{ gap: theme.space.xs }}>
            <Button
              fullWidth
              label="Save name"
              loading={busy}
              loadingLabel="Saving"
              onPress={saveName}
              testID="members-rename-save"
            />
            <Button
              fullWidth
              label="Cancel"
              onPress={() => {
                setRenaming(false);
              }}
              variant="secondary"
            />
          </View>
        }
        onClose={() => {
          setRenaming(false);
        }}
        testID="members-rename-sheet"
        title="Rename this circle"
        visible={renaming}
      >
        <TextField
          autoCapitalize="words"
          autoCorrect={false}
          error={nameError ?? undefined}
          label="Circle name"
          maxLength={CIRCLE_NAME_MAX_LENGTH}
          onChangeText={(value) => {
            setDraftName(value);
            setNameError(null);
          }}
          placeholder="Mum’s circle"
          returnKeyType="done"
          testID="members-rename-field"
          value={draftName}
        />
        <Text tone="tertiary" variant="caption">
          {`${String(draftName.trim().length)} of ${String(CIRCLE_NAME_MAX_LENGTH)} characters`}
        </Text>
      </Sheet>
    </>
  );
}
