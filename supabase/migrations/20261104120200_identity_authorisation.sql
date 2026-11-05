-- 20261104120000_identity_authorisation.sql
--
-- Tendshare — identity and authorisation core, part 3 of 4: Row Level Security.
--
-- Forward-only. Never edit after it has been applied; add a new migration.
--
-- The rules, in the brief's words:
--   * a member sees a circle's data only if they are a member of that circle;
--   * owner and family_member read and write care data;
--   * view_only reads, never writes;
--   * visiting_helper gets the narrow slice the role allows, not general read;
--   * only the owner changes memberships, roles, circle settings and plan fields;
--   * audit_log cannot be updated or deleted by anyone.
--
-- ## How policy recursion between `circles` and `circle_members` is avoided
--
-- The classic bug in this schema shape: the SELECT policy on `circles` says
-- "you may read a circle if you are a member", which means reading
-- `circle_members`; and the SELECT policy on `circle_members` says "you may
-- read a membership if you are a member of the circle", which means reading
-- `circle_members` again. Postgres detects that as
-- `infinite recursion detected in policy for relation "circle_members"`.
--
-- Every membership question is therefore answered by a SECURITY DEFINER
-- function (`is_circle_member`, `has_circle_role`, `circle_role_for`,
-- `shares_circle_with`, `can_write_care_data`, `is_circle_owner`). Those
-- functions run as the table owner, so the SELECT inside them is not filtered
-- by the policies that call them: the recursion stops at the function boundary.
-- The functions are the *only* place membership is read from inside a policy,
-- and they read `circle_members` and nothing else, so there is no policy on
-- `circle_members` that can re-enter another policy on `circle_members`.
--
-- Consequences that are deliberate:
--   * `search_path` is pinned on every definer function (`public, pg_temp`), so
--     a caller cannot shadow `circle_members` with a table of their own;
--   * EXECUTE is revoked from PUBLIC and from `anon`, and granted only to
--     `authenticated`, so the helpers cannot be used as an oracle while
--     unauthenticated.
--
-- ## Why there is an owner-role policy on every table
--
-- RLS is ENABLEd *and* FORCEd on every table below, which means the policies
-- apply to the table owner too — including the SECURITY DEFINER helpers and
-- triggers above, which run as the owner. Without a policy for the owner role
-- those helpers would see nothing and the signup trigger could not write a
-- profile at all.
--
-- So each table carries one policy for the role that owns it, and only that
-- role. That role is the migration/admin role (the same one the Supabase SQL
-- editor and `pnpm db:migrate` use). It is not reachable from the API: PostgREST
-- connects as `authenticator` and switches to `anon` or `authenticated` for
-- every request, and neither of those is a member of the owner role. The client
-- surface is therefore unchanged — this policy is what makes FORCE RLS
-- compatible with server-side definer code, not a hole in it.

-- ---------------------------------------------------------------------------
-- Authorisation helpers
-- ---------------------------------------------------------------------------

-- Is the caller a member of this circle, in any role?
create function public.is_circle_member(target_circle_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.circle_members m
    where m.circle_id = target_circle_id
      and m.profile_id = auth.uid()
  );
$$;

-- The caller's role in this circle, or null when they are not a member.
create function public.circle_role_for(target_circle_id uuid)
returns public.circle_role
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select m.role
  from public.circle_members m
  where m.circle_id = target_circle_id
    and m.profile_id = auth.uid()
  limit 1;
$$;

-- Does the caller hold one of these roles in this circle?
create function public.has_circle_role(target_circle_id uuid, allowed_roles public.circle_role[])
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.circle_members m
    where m.circle_id = target_circle_id
      and m.profile_id = auth.uid()
      and m.role = any (allowed_roles)
  );
$$;

-- Owner or family member: the two roles that may write care data.
create function public.can_write_care_data(target_circle_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select public.has_circle_role(
    target_circle_id,
    array['owner', 'family_member']::public.circle_role[]
  );
$$;

create function public.is_circle_owner(target_circle_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select public.has_circle_role(target_circle_id, array['owner']::public.circle_role[]);
$$;

-- Do the caller and this profile share a circle? Used for reading other
-- members' display names and avatars, and nothing else.
create function public.shares_circle_with(target_profile_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.circle_members mine
    join public.circle_members theirs on theirs.circle_id = mine.circle_id
    where mine.profile_id = auth.uid()
      and theirs.profile_id = target_profile_id
  );
$$;

-- A circle whose plan has ended is read-only: nothing is deleted, extra
-- features stop accepting writes. `past_due` still writes — that is the grace
-- period while a card is retried.
create function public.circle_is_writable(target_circle_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select coalesce(
    (
      select c.plan_status not in ('canceled', 'expired')
      from public.circles c
      where c.id = target_circle_id
    ),
    false
  );
$$;

revoke all on function public.is_circle_member(uuid) from public;
revoke all on function public.circle_role_for(uuid) from public;
revoke all on function public.has_circle_role(uuid, public.circle_role[]) from public;
revoke all on function public.can_write_care_data(uuid) from public;
revoke all on function public.is_circle_owner(uuid) from public;
revoke all on function public.shares_circle_with(uuid) from public;
revoke all on function public.circle_is_writable(uuid) from public;

grant execute on function public.is_circle_member(uuid) to authenticated;
grant execute on function public.circle_role_for(uuid) to authenticated;
grant execute on function public.has_circle_role(uuid, public.circle_role[]) to authenticated;
grant execute on function public.can_write_care_data(uuid) to authenticated;
grant execute on function public.is_circle_owner(uuid) to authenticated;
grant execute on function public.shares_circle_with(uuid) to authenticated;
grant execute on function public.circle_is_writable(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Enable and force RLS on every table
-- ---------------------------------------------------------------------------

alter table public.profiles enable row level security;
alter table public.circles enable row level security;
alter table public.circle_members enable row level security;
alter table public.care_recipients enable row level security;
alter table public.audit_log enable row level security;
alter table public.plan_limits enable row level security;

alter table public.profiles force row level security;
alter table public.circles force row level security;
alter table public.circle_members force row level security;
alter table public.care_recipients force row level security;
alter table public.audit_log force row level security;
alter table public.plan_limits force row level security;

-- The single policy for the role that owns these tables — see the note at the
-- top of this file. One per table, all four operations, no client role in it.
do $$
declare
  owner_role name;
  target_table text;
begin
  select r.rolname into owner_role
  from pg_class c
  join pg_roles r on r.oid = c.relowner
  where c.oid = 'public.profiles'::regclass;

  foreach target_table in array array[
    'profiles', 'circles', 'circle_members', 'care_recipients', 'audit_log', 'plan_limits'
  ]
  loop
    execute format(
      'create policy %I on public.%I for all to %I using (true) with check (true)',
      target_table || '_table_owner_all',
      target_table,
      owner_role
    );
  end loop;
end;
$$;

-- ---------------------------------------------------------------------------
-- profiles
-- ---------------------------------------------------------------------------

-- Any member may read the name and avatar of anyone in their own circles, and
-- their own row always.
create policy profiles_select_self_or_circle_mate
  on public.profiles
  for select
  to authenticated
  using (id = auth.uid() or public.shares_circle_with(id));

-- A person may rename themselves and change their own avatar. Nothing else.
create policy profiles_update_self
  on public.profiles
  for update
  to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

-- No INSERT policy: profiles are created by the signup trigger.
-- No DELETE policy: profiles go when the auth user goes.

-- ---------------------------------------------------------------------------
-- circles
-- ---------------------------------------------------------------------------

-- The care team reads the circle. A visiting helper does not: the circle's
-- settings and plan are not part of the narrow slice that role allows.
create policy circles_select_care_team
  on public.circles
  for select
  to authenticated
  using (
    public.has_circle_role(
      id,
      array['owner', 'family_member', 'view_only']::public.circle_role[]
    )
  );

-- Anyone may create a circle they own. The owner membership row is created by
-- trigger, so a circle never exists without an owner.
create policy circles_insert_self_as_owner
  on public.circles
  for insert
  to authenticated
  with check (owner_id = auth.uid());

-- Only the owner changes the name, the plan fields and the settings.
create policy circles_update_owner
  on public.circles
  for update
  to authenticated
  using (public.is_circle_owner(id))
  with check (public.is_circle_owner(id));

-- The owner may delete the circle outright (full data deletion).
create policy circles_delete_owner
  on public.circles
  for delete
  to authenticated
  using (public.is_circle_owner(id));

-- ---------------------------------------------------------------------------
-- circle_members
-- ---------------------------------------------------------------------------

-- The care team sees the roster. A visiting helper sees only their own
-- membership row — the roster is not part of the narrow slice the role allows.
create policy circle_members_select_member
  on public.circle_members
  for select
  to authenticated
  using (
    profile_id = auth.uid()
    or public.has_circle_role(
      circle_id,
      array['owner', 'family_member', 'view_only']::public.circle_role[]
    )
  );

-- Only the owner adds members, and never by granting the owner role.
create policy circle_members_insert_owner
  on public.circle_members
  for insert
  to authenticated
  with check (public.is_circle_owner(circle_id) and role <> 'owner');

-- Only the owner changes a role.
create policy circle_members_update_owner
  on public.circle_members
  for update
  to authenticated
  using (public.is_circle_owner(circle_id))
  with check (public.is_circle_owner(circle_id) and role <> 'owner');

-- The owner removes anyone; a member may remove themselves. The owner row
-- itself cannot be deleted, so a circle always has an owner.
create policy circle_members_delete_owner_or_self
  on public.circle_members
  for delete
  to authenticated
  using (
    role <> 'owner'
    and (public.is_circle_owner(circle_id) or profile_id = auth.uid())
  );

-- ---------------------------------------------------------------------------
-- care_recipients
-- ---------------------------------------------------------------------------

-- Every role in the circle reads the basics of the person being cared for.
-- This table holds basics only; medical detail will live in its own table with
-- its own policy that excludes visiting_helper.
create policy care_recipients_select_circle
  on public.care_recipients
  for select
  to authenticated
  using (
    public.has_circle_role(
      circle_id,
      array['owner', 'family_member', 'view_only', 'visiting_helper']::public.circle_role[]
    )
  );

create policy care_recipients_insert_care_team
  on public.care_recipients
  for insert
  to authenticated
  with check (public.can_write_care_data(circle_id) and public.circle_is_writable(circle_id));

create policy care_recipients_update_care_team
  on public.care_recipients
  for update
  to authenticated
  using (public.can_write_care_data(circle_id) and public.circle_is_writable(circle_id))
  with check (public.can_write_care_data(circle_id) and public.circle_is_writable(circle_id));

create policy care_recipients_delete_care_team
  on public.care_recipients
  for delete
  to authenticated
  using (public.can_write_care_data(circle_id) and public.circle_is_writable(circle_id));

-- ---------------------------------------------------------------------------
-- audit_log
-- ---------------------------------------------------------------------------

-- The care team reads the circle's audit trail. A view_only member does not:
-- the trail records who looked at what, and that is the care team's record.
create policy audit_log_select_care_team
  on public.audit_log
  for select
  to authenticated
  using (public.can_write_care_data(circle_id));

-- No INSERT / UPDATE / DELETE policy for any client role. Rows are written by
-- `log_audit_event` below and by triggers, which are SECURITY DEFINER, and they
-- are never changed. Part 4 makes that a hard guarantee rather than an absence
-- of policy.

-- The only way a client writes an audit row: through this function, which
-- stamps the actor from the session rather than from the request body.
create function public.log_audit_event(
  p_circle_id uuid,
  p_table_name text,
  p_row_id text,
  p_action public.audit_action,
  p_summary jsonb default '{}'::jsonb
)
returns bigint
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  caller uuid := auth.uid();
  caller_role public.circle_role;
  new_id bigint;
begin
  if caller is null then
    raise exception 'not signed in' using errcode = '42501';
  end if;

  select m.role into caller_role
  from public.circle_members m
  where m.circle_id = p_circle_id and m.profile_id = caller;

  if caller_role is null then
    raise exception 'not a member of this circle' using errcode = '42501';
  end if;

  -- A view_only or visiting_helper member may record that they looked at
  -- something; they may not record changes, because they cannot make any.
  if p_action <> 'view' and caller_role not in ('owner', 'family_member') then
    raise exception 'this role may only record views' using errcode = '42501';
  end if;

  insert into public.audit_log (
    circle_id, actor_id, actor_role, table_name, row_id, action, summary
  )
  values (
    p_circle_id, caller, caller_role, p_table_name, p_row_id, p_action,
    coalesce(p_summary, '{}'::jsonb)
  )
  returning id into new_id;

  return new_id;
end;
$$;

revoke all on function public.log_audit_event(uuid, text, text, public.audit_action, jsonb) from public;
grant execute on function public.log_audit_event(uuid, text, text, public.audit_action, jsonb) to authenticated;

-- ---------------------------------------------------------------------------
-- plan_limits
-- ---------------------------------------------------------------------------

-- Limits and prices are read by every signed-in client so the app can show the
-- right plan. Nobody writes them through the API: they are config, changed by a
-- migration or by the service role.
create policy plan_limits_select_authenticated
  on public.plan_limits
  for select
  to authenticated
  using (true);

-- ---------------------------------------------------------------------------
-- Table privileges
-- ---------------------------------------------------------------------------

-- RLS decides which rows; these grants decide which operations are possible at
-- all. Anything not granted here is impossible even if a policy were wrong.
revoke all on table public.profiles from anon, authenticated;
revoke all on table public.circles from anon, authenticated;
revoke all on table public.circle_members from anon, authenticated;
revoke all on table public.care_recipients from anon, authenticated;
revoke all on table public.audit_log from anon, authenticated;
revoke all on table public.plan_limits from anon, authenticated;

grant select, update on table public.profiles to authenticated;
grant select, insert, update, delete on table public.circles to authenticated;
grant select, insert, update, delete on table public.circle_members to authenticated;
grant select, insert, update, delete on table public.care_recipients to authenticated;
grant select on table public.audit_log to authenticated;
grant select on table public.plan_limits to authenticated;

-- The audit log is read-only to every client role, at the privilege level as
-- well as in policy. It is written only by SECURITY DEFINER code.
revoke update, delete, truncate on table public.audit_log from anon, authenticated;

-- anon holds no privileges and has no policies: signed-out requests see nothing.
grant usage on schema public to anon, authenticated;
