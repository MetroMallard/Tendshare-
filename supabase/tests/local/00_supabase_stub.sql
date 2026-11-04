-- supabase/tests/local/00_supabase_stub.sql
--
-- A stand-in for the parts of a Supabase database that our migrations expect to
-- already exist: the `auth` schema, `auth.users`, `auth.uid()` and the three
-- API roles. Applied only by `scripts/rls-local.sh` against a scratch database.
-- This file is NEVER applied to a hosted project — Supabase provides all of it.
--
-- It is deliberately faithful to the hosted definitions, because the point of
-- running locally is to exercise the same policies the hosted project will run:
--   * `auth.uid()` reads the request JWT claims, exactly as Supabase defines it;
--   * `anon` and `authenticated` are ordinary, non-owner roles, so RLS applies
--     to them the way it does through PostgREST;
--   * the tables are owned by `postgres`, the role that also owns them on a
--     hosted project.

do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then
    create role anon nologin noinherit;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then
    create role authenticated nologin noinherit;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then
    create role service_role nologin noinherit bypassrls;
  end if;
end;
$$;

create schema if not exists auth;

grant usage on schema auth to anon, authenticated, service_role;

create table if not exists auth.users (
  id uuid primary key default gen_random_uuid(),
  email text,
  raw_user_meta_data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

grant select on auth.users to service_role;

-- Supabase's own definition: the caller's user id comes from the JWT claims the
-- API sets on the connection before running the query.
create or replace function auth.uid()
returns uuid
language sql
stable
as $$
  select coalesce(
    nullif(current_setting('request.jwt.claim.sub', true), ''),
    (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub')
  )::uuid;
$$;

create or replace function auth.role()
returns text
language sql
stable
as $$
  select coalesce(
    nullif(current_setting('request.jwt.claim.role', true), ''),
    (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role')
  );
$$;

grant execute on function auth.uid() to anon, authenticated, service_role;
grant execute on function auth.role() to anon, authenticated, service_role;
