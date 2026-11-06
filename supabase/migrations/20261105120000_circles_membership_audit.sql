-- 20261105120000_circles_membership_audit.sql
--
-- Tendshare — care circles, part 1: the audit trail for membership changes, the
-- member plan limit, and one integrity hole closed.
--
-- Forward-only. Never edit after it has been applied; add a new migration.
--
-- ## Why this file exists
--
-- The plan promises "an audit log of views and changes to sensitive records",
-- and Task 3 built the table, its policies and `log_audit_event()` — but nothing
-- wrote to it automatically. Every audit row so far was one a client chose to
-- write by calling the function. That is a record of what a client said it did,
-- not a record of what happened: a change to a role, a removal from the circle
-- or a rename could happen with no trace at all.
--
-- So this migration moves the record to where the change is made. Triggers on
-- `circle_members` and `circles` append the row inside the same transaction as
-- the change, which means the two cannot disagree: if the write commits, the
-- audit row commits; if it rolls back, so does the audit row.
--
-- ## What the audit row may contain
--
-- `audit_log.summary` is documented in Task 3 as "ids, counts, field names.
-- Never a medication name, a note, a document title or any free text the family
-- typed". A circle name is free text the family typed, so a rename records
-- `{"fields": ["name"]}` and not the name itself. A role change records the two
-- enum values, which are not health information and are the whole point of the
-- entry.
--
-- ## The three functions below are SECURITY DEFINER, with a pinned search_path
--
-- A trigger that writes to `audit_log` runs as the calling user, and no client
-- role has INSERT on that table (by design, in Task 3). SECURITY DEFINER is what
-- lets the trigger write the row while the client still cannot. `search_path` is
-- pinned to `public, pg_temp` so a shadowed `audit_log` in another schema cannot
-- be substituted for the real one. None of the three is executable by a client:
-- they are trigger functions, and `execute` is revoked at the bottom.
--
-- ---------------------------------------------------------------------------
-- 1. The owner's membership row can never be demoted
-- ---------------------------------------------------------------------------
--
-- `circle_members_update_owner` lets the owner update any membership row in
-- their circle, with the one condition `role <> 'owner'` on the result. Read
-- together with `circle_members_validate_owner` (which only stops someone
-- *else* being made owner), that leaves a hole: the owner could set their own
-- row to `family_member`. The circle would then have an `owner_id` and no owner
-- membership row — every `has_circle_role(id, ['owner'])` check in the schema
-- would answer no, and nobody could ever run the circle again.
--
-- The UI does not offer it, and will not. This is the guarantee underneath the
-- UI, because "the app does not send that request" is not a policy.
--
-- Handing the circle to somebody else is a different, deliberate feature (a
-- transfer, with the new owner's consent) and is not built.

create function public.circle_members_keep_owner()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if old.role = 'owner' and new.role <> 'owner' then
    raise exception 'the circle owner cannot be given another role'
      using errcode = '42501';
  end if;

  return new;
end;
$$;

comment on function public.circle_members_keep_owner() is
  'A circle always keeps exactly one owner membership: the owner row cannot be demoted to another role.';

create trigger circle_members_keep_owner
  before update on public.circle_members
  for each row execute function public.circle_members_keep_owner();

-- ---------------------------------------------------------------------------
-- 2. The member limit, from the same config table as everything else
-- ---------------------------------------------------------------------------
--
-- `plan_limits.max_members` has existed since Task 3 and nothing read it: a free
-- circle could hold a hundred members. The brief caps a free circle at three,
-- and Task 15 (invites) is where adding a member becomes something a family can
-- do — so the limit has to be real before that ships, not after.
--
-- Nothing is deleted when a plan ends: this refuses a *new* member, and never
-- touches the people already in the circle. That is the difference between a
-- limit and a lockout.
--
-- A visiting helper counts as a member here. They are a real person with access
-- to the circle's care records; the free plan's three are three people, not
-- three relatives.

create function public.circle_members_enforce_plan_limit()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  circle_tier public.plan_tier;
  allowed integer;
  existing integer;
begin
  -- Serialise additions per circle so two simultaneous invites cannot both
  -- pass the check on the same free seat.
  perform 1 from public.circles c where c.id = new.circle_id for update;

  select c.plan_tier into circle_tier from public.circles c where c.id = new.circle_id;

  select l.max_members into allowed from public.plan_limits l where l.tier = circle_tier;

  if not found then
    raise exception 'no plan limits configured for tier %', circle_tier using errcode = '55000';
  end if;

  -- null means "no limit" (Family and Family Plus).
  if allowed is null then
    return new;
  end if;

  select count(*) into existing
  from public.circle_members m
  where m.circle_id = new.circle_id;

  if existing >= allowed then
    raise exception 'the % plan covers up to % people in a circle; upgrade to add another',
      circle_tier, allowed
      using errcode = 'P0001';
  end if;

  return new;
end;
$$;

comment on function public.circle_members_enforce_plan_limit() is
  'Refuses a new member beyond plan_limits.max_members. Never removes anyone already in the circle.';

create trigger circle_members_enforce_plan_limit
  before insert on public.circle_members
  for each row execute function public.circle_members_enforce_plan_limit();

-- ---------------------------------------------------------------------------
-- 3. Membership changes write themselves into the audit trail
-- ---------------------------------------------------------------------------
--
-- One row per real change: somebody joined, somebody's role changed, somebody
-- was removed. The actor is taken from the session (`auth.uid()`), never from
-- the request, so a client cannot claim a change was made by someone else.
--
-- BEFORE DELETE on purpose: a member may remove themselves, and at BEFORE DELETE
-- time their row is still visible, so `actor_role` records what they were when
-- they left rather than null.
--
-- The `exists` guard at the top is not defensive noise. Deleting an account
-- cascades: profiles -> circles -> circle_members. In the middle of that
-- statement the circle is on its way out, and an audit row pointing at it would
-- either fail the foreign key (aborting the account deletion the person asked
-- for) or be deleted a moment later with the circle anyway. So when the circle
-- is going, nothing is written.

create function public.audit_circle_member_change()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  target_circle uuid;
  actor uuid := auth.uid();
  actor_role public.circle_role;
begin
  if tg_op = 'DELETE' then
    target_circle := old.circle_id;
  else
    target_circle := new.circle_id;
  end if;

  if not exists (select 1 from public.circles c where c.id = target_circle) then
    if tg_op = 'DELETE' then
      return old;
    end if;
    return new;
  end if;

  select m.role into actor_role
  from public.circle_members m
  where m.circle_id = target_circle and m.profile_id = actor;

  if tg_op = 'INSERT' then
    insert into public.audit_log (
      circle_id, actor_id, actor_role, table_name, row_id, action, summary
    )
    values (
      target_circle, actor, actor_role, 'circle_members', new.id::text, 'create',
      jsonb_build_object('role', new.role)
    );

    return new;
  end if;

  if tg_op = 'UPDATE' then
    -- An update that changes nothing about the role (a re-save, a helper label)
    -- is not a membership event.
    if new.role is distinct from old.role then
      insert into public.audit_log (
        circle_id, actor_id, actor_role, table_name, row_id, action, summary
      )
      values (
        target_circle, actor, actor_role, 'circle_members', new.id::text, 'update',
        jsonb_build_object('field', 'role', 'from', old.role, 'to', new.role)
      );
    end if;

    return new;
  end if;

  insert into public.audit_log (
    circle_id, actor_id, actor_role, table_name, row_id, action, summary
  )
  values (
    target_circle, actor, actor_role, 'circle_members', old.id::text, 'delete',
    jsonb_build_object('role', old.role)
  );

  return old;
end;
$$;

comment on function public.audit_circle_member_change() is
  'Appends an audit row for every join, role change and removal, with the actor taken from the session.';

create trigger circle_members_audit_insert
  after insert on public.circle_members
  for each row execute function public.audit_circle_member_change();

create trigger circle_members_audit_update
  after update on public.circle_members
  for each row execute function public.audit_circle_member_change();

create trigger circle_members_audit_delete
  before delete on public.circle_members
  for each row execute function public.audit_circle_member_change();

-- ---------------------------------------------------------------------------
-- 4. A rename writes itself into the audit trail
-- ---------------------------------------------------------------------------
--
-- Only the name. Plan changes are billing (Task 15) and will get their own
-- entry with the subscription, not here.
--
-- The name itself is not recorded — it is free text a family typed, and the
-- audit payload stays to field names.

create function public.audit_circle_rename()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  actor uuid := auth.uid();
  actor_role public.circle_role;
begin
  if new.name is not distinct from old.name then
    return new;
  end if;

  select m.role into actor_role
  from public.circle_members m
  where m.circle_id = new.id and m.profile_id = actor;

  insert into public.audit_log (
    circle_id, actor_id, actor_role, table_name, row_id, action, summary
  )
  values (
    new.id, actor, actor_role, 'circles', new.id::text, 'update',
    jsonb_build_object('fields', jsonb_build_array('name'))
  );

  return new;
end;
$$;

comment on function public.audit_circle_rename() is
  'Appends an audit row when a circle is renamed. Records the field name, never the name itself.';

create trigger circles_audit_rename
  after update on public.circles
  for each row execute function public.audit_circle_rename();

-- ---------------------------------------------------------------------------
-- 5. None of the above is callable by a client
-- ---------------------------------------------------------------------------
--
-- They are trigger functions. Revoking execute means a client cannot call them
-- directly to forge an audit row or trip a check outside a real write — the
-- table's own privileges already stop the audit_log insert, and this closes the
-- function-shaped door next to it.

revoke all on function public.circle_members_keep_owner() from public, anon, authenticated;
revoke all on function public.circle_members_enforce_plan_limit() from public, anon, authenticated;
revoke all on function public.audit_circle_member_change() from public, anon, authenticated;
revoke all on function public.audit_circle_rename() from public, anon, authenticated;
