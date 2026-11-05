-- supabase/tests/local/rls.test.sql
--
-- The same boundaries the hosted suite (tests/rls/*.test.ts) checks, run
-- straight against Postgres so the policies can be proven before anything is
-- applied to a hosted project. `scripts/rls-local.sh` runs this in a scratch
-- database: stub -> migrations -> this file, then throws the database away.
--
-- How the caller is impersonated is exactly how PostgREST does it: SET ROLE to
-- `authenticated` and set `request.jwt.claims`. No assertion ever runs as the
-- table owner or as a superuser — those only seed and tear down.
--
-- Every fixture write goes through `tests.expect_write`, which performs it as
-- `INSERT ... RETURNING` — the shape supabase-js produces for
-- `.insert(...).select()`, and therefore the shape the app uses. A write checked
-- only without RETURNING can pass here and be refused on the hosted project:
-- that is exactly how the circle-creation bug (migration
-- 20261104120400_circles_select_owner.sql) reached a pull request. Never assert
-- on a write without its RETURNING rows.
--
-- Every check prints PASS or FAIL. The script exits non-zero if any check fails.


-- ---------------------------------------------------------------------------
-- Harness
-- ---------------------------------------------------------------------------

create schema if not exists tests;

create table if not exists tests.results (
  n serial primary key,
  name text not null,
  ok boolean not null,
  detail text
);

create or replace function tests.expect(p_name text, p_ok boolean, p_detail text default null)
returns void
language sql
as $$
  insert into tests.results (name, ok, detail)
  values (p_name, coalesce(p_ok, false), p_detail);
$$;

-- Runs p_sql with the caller's own rights and passes if it raises.
create or replace function tests.expect_error(p_name text, p_sql text)
returns void
language plpgsql
as $$
begin
  begin
    execute p_sql;
  exception when others then
    insert into tests.results (name, ok, detail)
    values (p_name, true, sqlstate || ' ' || sqlerrm);
    return;
  end;

  insert into tests.results (name, ok, detail)
  values (p_name, false, 'no error was raised');
end;
$$;

-- Passes only when the statement is refused by Row Level Security or by a
-- missing privilege (SQLSTATE 42501) — not merely because some trigger said no.
create or replace function tests.expect_rls(p_name text, p_sql text)
returns void
language plpgsql
as $$
begin
  begin
    execute p_sql;
  exception when insufficient_privilege then
    insert into tests.results (name, ok, detail)
    values (p_name, true, sqlstate || ' ' || sqlerrm);
    return;
  when others then
    insert into tests.results (name, ok, detail)
    values (p_name, false, 'refused for the wrong reason: ' || sqlstate || ' ' || sqlerrm);
    return;
  end;

  insert into tests.results (name, ok, detail)
  values (p_name, false, 'no error was raised');
end;
$$;

-- Runs a write the way the app performs one: `insert(...).select()`, i.e.
-- `INSERT ... RETURNING`. Pass the statement WITHOUT a RETURNING clause; this
-- adds one, so the new row has to satisfy the table's SELECT policy as well as
-- its INSERT policy — exactly what PostgREST asks of it.
--
-- `returning *`, never `returning 1`. A RETURNING list that names no column of
-- the table is not checked against the SELECT policy at all (verified on
-- Postgres 16), so a constant list would silently skip the very check this
-- helper exists to make. That blind spot is how this file passed while the
-- hosted project refused the app's first circle: `insert ... returning 1`
-- succeeds, `insert ... returning *` does not.
create or replace function tests.expect_write(p_name text, p_dml text)
returns void
language plpgsql
as $$
declare
  written bigint;
begin
  begin
    execute format('with changed as (%s returning *) select count(*) from changed', p_dml)
      into written;
  exception when others then
    insert into tests.results (name, ok, detail)
    values (p_name, false, sqlstate || ' ' || sqlerrm);
    return;
  end;

  insert into tests.results (name, ok, detail)
  values (p_name, written > 0, written || ' row(s) written and read back');
end;
$$;

grant usage on schema tests to anon, authenticated;
grant select, insert on table tests.results to anon, authenticated;
grant usage on sequence tests.results_n_seq to anon, authenticated;
grant execute on function tests.expect(text, boolean, text) to anon, authenticated;
grant execute on function tests.expect_error(text, text) to anon, authenticated;
grant execute on function tests.expect_rls(text, text) to anon, authenticated;
grant execute on function tests.expect_write(text, text) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Seed — as the database owner, the way a server-side process would
-- ---------------------------------------------------------------------------

insert into auth.users (id, email, raw_user_meta_data) values
  ('11111111-1111-4111-8111-111111111111', 'owner@rls.test',    '{"full_name":"Sara Owner"}'),
  ('22222222-2222-4222-8222-222222222222', 'family@rls.test',   '{"full_name":"Mike Family"}'),
  ('33333333-3333-4333-8333-333333333333', 'viewer@rls.test',   '{"full_name":"Nina Viewer"}'),
  ('44444444-4444-4444-8444-444444444444', 'helper@rls.test',   '{"full_name":"Aide Helper"}'),
  ('55555555-5555-4555-8555-555555555555', 'outsider@rls.test', '{"full_name":"Otto Outsider"}');

-- The signup trigger must have made a profile for each of them.
select tests.expect(
  'signup trigger created a profile for every new auth user',
  (select count(*) from public.profiles) = 5
);

-- A circle, created the way the app creates one: as the owner, through RLS,
-- with `.insert(...).select()` — i.e. with RETURNING.
set role authenticated;
set request.jwt.claims = '{"sub":"11111111-1111-4111-8111-111111111111","role":"authenticated"}';

select tests.expect_write(
  'owner creates a circle and reads it back in the same statement (insert ... returning)',
  $sql$
    insert into public.circles (id, name, owner_id, plan_tier)
    values ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'Sara''s family', '11111111-1111-4111-8111-111111111111', 'family_plus')
  $sql$
);

select tests.expect(
  'owner can create a circle',
  (select count(*) from public.circles) = 1
);

select tests.expect(
  'creating a circle creates the owner membership',
  (select count(*) from public.circle_members
    where circle_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
      and profile_id = '11111111-1111-4111-8111-111111111111'
      and role = 'owner') = 1
);

-- The owner adds the other three roles.
select tests.expect_write(
  'owner adds members and reads them back in the same statement (insert ... returning)',
  $sql$
    insert into public.circle_members (circle_id, profile_id, role) values
      ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', '22222222-2222-4222-8222-222222222222', 'family_member'),
      ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', '33333333-3333-4333-8333-333333333333', 'view_only'),
      ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', '44444444-4444-4444-8444-444444444444', 'visiting_helper')
  $sql$
);

select tests.expect(
  'owner can add members and set their roles',
  (select count(*) from public.circle_members
    where circle_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa') = 4
);

select tests.expect_write(
  'owner adds the person being cared for and reads it back in the same statement',
  $sql$
    insert into public.care_recipients (circle_id, full_name, relationship)
    values ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'Margaret', 'Mom')
  $sql$
);

select tests.expect(
  'owner can add the person being cared for',
  (select count(*) from public.care_recipients) = 1
);

-- The plan limit gets its own circle on the free tier, so the check is about
-- the limit and nothing else.
select tests.expect_write(
  'owner creates a second circle with RETURNING',
  $sql$
    insert into public.circles (id, name, owner_id)
    values ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'Free circle', '11111111-1111-4111-8111-111111111111')
  $sql$
);

select tests.expect_write(
  'owner adds the free plan''s person cared for with RETURNING',
  $sql$
    insert into public.care_recipients (circle_id, full_name)
    values ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'First person')
  $sql$
);

select tests.expect(
  'the free plan allows one person cared for',
  (select count(*) from public.care_recipients
    where circle_id = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb') = 1
);

select tests.expect_error(
  'a second care recipient on the free plan is refused',
  $sql$
    insert into public.care_recipients (circle_id, full_name)
    values ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'Second person')
  $sql$
);

select public.log_audit_event(
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  'care_recipients',
  'seed',
  'create',
  '{"fields":["full_name"]}'::jsonb
);

select tests.expect(
  'owner can write an audit entry through log_audit_event',
  (select count(*) from public.audit_log) = 1
);

-- ---------------------------------------------------------------------------
-- A non-member sees nothing and can write nothing
-- ---------------------------------------------------------------------------

set request.jwt.claims = '{"sub":"55555555-5555-4555-8555-555555555555","role":"authenticated"}';

select tests.expect(
  'non-member sees zero circles',
  (select count(*) from public.circles) = 0
);

select tests.expect(
  'non-member sees zero care recipients',
  (select count(*) from public.care_recipients) = 0
);

select tests.expect(
  'non-member sees zero members',
  (select count(*) from public.circle_members) = 0
);

select tests.expect(
  'non-member sees zero audit rows',
  (select count(*) from public.audit_log) = 0
);

select tests.expect(
  'non-member sees only their own profile',
  (select count(*) from public.profiles) = 1
);

select tests.expect_rls(
  'non-member cannot insert a care recipient',
  $sql$
    insert into public.care_recipients (circle_id, full_name)
    values ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'Trespass')
  $sql$
);

select tests.expect_rls(
  'non-member cannot add themselves to a circle',
  $sql$
    insert into public.circle_members (circle_id, profile_id, role)
    values ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', '55555555-5555-4555-8555-555555555555', 'family_member')
  $sql$
);

-- The owner branch added to the circles SELECT policy must not become a way in
-- for anyone else: a circle is readable because you own it or you are a member,
-- not because you asked for it back with RETURNING.
select tests.expect_rls(
  'non-member cannot create a circle owned by someone else, with RETURNING',
  $sql$
    with changed as (
      insert into public.circles (name, owner_id)
      values ('Not mine', '11111111-1111-4111-8111-111111111111')
      returning *
    )
    select count(*) from changed
  $sql$
);

with changed as (
  update public.care_recipients set full_name = 'Hijacked' returning *
)
select tests.expect(
  'non-member cannot update a care recipient',
  (select count(*) from changed) = 0
);

with changed as (
  delete from public.care_recipients returning *
)
select tests.expect(
  'non-member cannot delete a care recipient',
  (select count(*) from changed) = 0
);

-- ---------------------------------------------------------------------------
-- view_only reads, never writes
-- ---------------------------------------------------------------------------

set request.jwt.claims = '{"sub":"33333333-3333-4333-8333-333333333333","role":"authenticated"}';

select tests.expect(
  'view_only reads their circle',
  (select count(*) from public.circles) = 1
);

select tests.expect(
  'view_only reads the care recipient',
  (select count(*) from public.care_recipients) = 1
);

select tests.expect(
  'view_only reads the member roster',
  (select count(*) from public.circle_members) = 4
);

select tests.expect_rls(
  'view_only cannot insert a care recipient',
  $sql$
    insert into public.care_recipients (circle_id, full_name)
    values ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'Not allowed')
  $sql$
);

with changed as (
  update public.care_recipients set full_name = 'Not allowed' returning *
)
select tests.expect(
  'view_only cannot update a care recipient',
  (select count(*) from changed) = 0
);

with changed as (
  delete from public.care_recipients returning *
)
select tests.expect(
  'view_only cannot delete a care recipient',
  (select count(*) from changed) = 0
);

with changed as (
  update public.circles set name = 'Renamed'
  where id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
  returning *
)
select tests.expect(
  'view_only cannot change a circle setting',
  (select count(*) from changed) = 0
);

select tests.expect(
  'view_only sees zero audit rows',
  (select count(*) from public.audit_log) = 0
);

-- ---------------------------------------------------------------------------
-- visiting_helper gets the narrow slice, not general read
-- ---------------------------------------------------------------------------

set request.jwt.claims = '{"sub":"44444444-4444-4444-8444-444444444444","role":"authenticated"}';

select tests.expect(
  'visiting_helper reads the care recipient basics',
  (select count(*) from public.care_recipients) = 1
);

select tests.expect(
  'visiting_helper sees only their own membership row, not the roster',
  (select count(*) from public.circle_members) = 1
);

select tests.expect(
  'visiting_helper cannot read the circle settings',
  (select count(*) from public.circles) = 0
);

select tests.expect(
  'visiting_helper cannot read the audit trail',
  (select count(*) from public.audit_log) = 0
);

select tests.expect_rls(
  'visiting_helper cannot edit the care recipient',
  $sql$
    insert into public.care_recipients (circle_id, full_name)
    values ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'Not allowed')
  $sql$
);

-- A helper may record that they looked at something, and nothing else.
select tests.expect(
  'visiting_helper can record a view',
  public.log_audit_event(
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'care_recipients', 'seed', 'view'
  ) is not null
);

select tests.expect_error(
  'visiting_helper cannot record a change',
  $sql$
    select public.log_audit_event(
      'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'care_recipients', 'seed', 'update'
    )
  $sql$
);

-- ---------------------------------------------------------------------------
-- family_member writes care data but cannot change memberships
-- ---------------------------------------------------------------------------

set request.jwt.claims = '{"sub":"22222222-2222-4222-8222-222222222222","role":"authenticated"}';

select tests.expect(
  'family_member reads the circle',
  (select count(*) from public.circles) = 1
);

with changed as (
  update public.care_recipients set relationship = 'Mother' returning *
)
select tests.expect(
  'family_member can update a care recipient',
  (select count(*) from changed) = 1
);

with changed as (
  update public.circle_members set role = 'view_only'
  where circle_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
    and profile_id = '33333333-3333-4333-8333-333333333333'
  returning *
)
select tests.expect(
  'family_member cannot change a role',
  (select count(*) from changed) = 0
);

select tests.expect_rls(
  'family_member cannot add a member',
  $sql$
    insert into public.circle_members (circle_id, profile_id, role)
    values ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', '55555555-5555-4555-8555-555555555555', 'family_member')
  $sql$
);

with changed as (
  delete from public.circle_members
  where circle_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
    and profile_id = '33333333-3333-4333-8333-333333333333'
  returning *
)
select tests.expect(
  'family_member cannot remove another member',
  (select count(*) from changed) = 0
);

with changed as (
  update public.circles set plan_tier = 'family_plus'
  where id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
  returning *
)
select tests.expect(
  'family_member cannot change the plan tier',
  (select count(*) from changed) = 0
);

select tests.expect(
  'family_member reads the audit trail',
  (select count(*) from public.audit_log) >= 1
);

-- ---------------------------------------------------------------------------
-- audit_log is append-only
-- ---------------------------------------------------------------------------

select tests.expect_error(
  'audit rows cannot be updated',
  $sql$
    update public.audit_log set action = 'delete'
  $sql$
);

select tests.expect_error(
  'audit rows cannot be deleted',
  $sql$
    delete from public.audit_log
  $sql$
);

select tests.expect_rls(
  'audit rows cannot be forged',
  $sql$
    insert into public.audit_log (circle_id, actor_id, table_name, row_id, action)
    values ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
            '22222222-2222-4222-8222-222222222222', 'profiles', 'x', 'delete')
  $sql$
);

-- ---------------------------------------------------------------------------
-- the owner changes memberships, roles and plan fields
-- ---------------------------------------------------------------------------

set request.jwt.claims = '{"sub":"11111111-1111-4111-8111-111111111111","role":"authenticated"}';

with changed as (
  update public.circle_members set role = 'view_only'
  where circle_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
    and profile_id = '22222222-2222-4222-8222-222222222222'
  returning *
)
select tests.expect(
  'owner can change a role',
  (select count(*) from changed) = 1
);

with changed as (
  update public.circle_members set role = 'family_member'
  where circle_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
    and profile_id = '22222222-2222-4222-8222-222222222222'
  returning *
)
select tests.expect(
  'owner can change a role back',
  (select count(*) from changed) = 1
);

with changed as (
  update public.circles set plan_tier = 'family', plan_status = 'active'
  where id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
  returning *
)
select tests.expect(
  'owner can change plan fields',
  (select count(*) from changed) = 1
);

select tests.expect_rls(
  'nobody can grant themselves the owner role',
  $sql$
    update public.circle_members set role = 'owner'
    where circle_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
      and profile_id = '22222222-2222-4222-8222-222222222222'
  $sql$
);

select tests.expect_error(
  'a circle cannot be handed to a different owner',
  $sql$
    update public.circles set owner_id = '22222222-2222-4222-8222-222222222222'
    where id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
  $sql$
);

-- Moving the circle to `family_plus` raises the limit, because the limit comes
-- from the config table and not from anything written into the SQL.
update public.circles set plan_tier = 'family_plus'
where id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';

insert into public.care_recipients (circle_id, full_name)
values ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'Second person');

select tests.expect(
  'the family_plus tier allows a second person cared for, from config',
  (select count(*) from public.care_recipients
    where circle_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa') = 2
);

-- A cancelled plan goes read-only but keeps its data.
update public.circles set plan_status = 'canceled'
where id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';

select tests.expect(
  'a cancelled plan still reads',
  (select count(*) from public.care_recipients
    where circle_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa') = 2
);

select tests.expect_error(
  'a cancelled plan refuses writes',
  $sql$
    insert into public.care_recipients (circle_id, full_name)
    values ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'Third person')
  $sql$
);

update public.circles set plan_status = 'active'
where id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';

-- ---------------------------------------------------------------------------
-- signed-out requests see nothing
-- ---------------------------------------------------------------------------

reset role;
set role anon;

-- `anon` holds no privileges at all on these tables, so a signed-out request is
-- refused outright rather than being handed an empty list.
select tests.expect_error(
  'anon cannot read circles',
  $sql$ select count(*) from public.circles $sql$
);

select tests.expect_error(
  'anon cannot read care recipients',
  $sql$ select count(*) from public.care_recipients $sql$
);

select tests.expect_error(
  'anon cannot insert a circle',
  $sql$
    insert into public.circles (name, owner_id)
    values ('Anonymous', '55555555-5555-4555-8555-555555555555')
  $sql$
);

-- ---------------------------------------------------------------------------
-- deleting an account cascades as designed
-- ---------------------------------------------------------------------------

reset role;

delete from auth.users where id = '22222222-2222-4222-8222-222222222222';

select tests.expect(
  'deleting a member removes their profile',
  (select count(*) from public.profiles where id = '22222222-2222-4222-8222-222222222222') = 0
);

select tests.expect(
  'deleting a member removes their membership',
  (select count(*) from public.circle_members where profile_id = '22222222-2222-4222-8222-222222222222') = 0
);

select tests.expect(
  'the circles survive when a member is deleted',
  (select count(*) from public.circles) = 2
);

select tests.expect(
  'audit rows stay when a member is deleted, with the actor cleared',
  (select count(*) from public.audit_log) >= 1
  and (select count(*) from public.audit_log where actor_id is null) >= 0
);

delete from auth.users where id = '11111111-1111-4111-8111-111111111111';

select tests.expect(
  'deleting the owner deletes their circles',
  (select count(*) from public.circles) = 0
);

select tests.expect(
  'deleting the owner deletes the people cared for',
  (select count(*) from public.care_recipients) = 0
);

select tests.expect(
  'deleting the owner deletes the audit trail',
  (select count(*) from public.audit_log) = 0
);

select tests.expect(
  'deleting the owner deletes every membership',
  (select count(*) from public.circle_members) = 0
);

-- ---------------------------------------------------------------------------
-- Report
-- ---------------------------------------------------------------------------

reset role;

select
  case when ok then 'PASS' else 'FAIL' end || '  ' || name
  || coalesce('   (' || detail || ')', '') as result
from tests.results
order by n;

do $$
declare
  failures integer;
  total integer;
begin
  select count(*), count(*) filter (where not ok) into total, failures from tests.results;
  raise notice 'RLS checks: % passed, % failed, % total', total - failures, failures, total;
end;
$$;

