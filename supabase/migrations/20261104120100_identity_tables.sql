-- 20261104120000_identity_tables.sql
--
-- Tendshare — identity and authorisation core, part 2 of 4: the tables.
--
-- Forward-only. Never edit after it has been applied; add a new migration.
--
-- This is the shape every later feature table copies:
--   * uuid primary key (or an identity column for the append-only log);
--   * created_at / updated_at, both server-set, updated_at by trigger;
--   * foreign keys with a deliberate ON DELETE rule;
--   * the indexes the RLS policies and the app's list queries actually use;
--   * Row Level Security enabled and forced (see part 3).
--
-- ON DELETE rules, and why:
--   * auth.users -> profiles: CASCADE. Deleting an account must delete the
--     person's data (the brief promises full account and data deletion).
--   * profiles -> circles.owner_id: CASCADE. A circle cannot exist without its
--     owner, so deleting the owner's account takes the circle and everything
--     hanging off it with it.
--   * profiles -> circle_members.profile_id: CASCADE. A deleted person leaves
--     no membership behind.
--   * circles -> circle_members / care_recipients / audit_log: CASCADE. All
--     circle-scoped data goes when the circle goes.
--   * profiles -> *.created_by / invited_by / actor_id: SET NULL. The record
--     belongs to the circle, not to the person who happened to create it, so
--     it survives with the attribution removed.

-- ---------------------------------------------------------------------------
-- profiles — one row per auth user
-- ---------------------------------------------------------------------------

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null
    check (char_length(btrim(display_name)) between 1 and 80),
  avatar_url text
    check (avatar_url is null or char_length(avatar_url) <= 2048),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.profiles is
  'One row per auth.users row. Created by a trigger on signup; the client may only read and rename its own row.';
comment on column public.profiles.avatar_url is
  'Storage object path or signed URL. Never a public URL: the bucket is private.';

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- circles — the family circle
-- ---------------------------------------------------------------------------

create table public.circles (
  id uuid primary key default gen_random_uuid(),
  name text not null
    check (char_length(btrim(name)) between 1 and 80),
  owner_id uuid not null references public.profiles (id) on delete cascade,
  -- Plan fields are written by the server (RevenueCat webhook / service role).
  -- The owner may change them too, which is what "only the owner can change
  -- circle settings and plan fields" means in practice.
  plan_tier public.plan_tier not null default 'free',
  plan_status public.plan_status not null default 'active',
  trial_ends_at timestamptz,
  current_period_end timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.circles is
  'A family circle. One payer covers the circle; invited members join free.';

create index circles_owner_id_idx on public.circles (owner_id);

create trigger circles_set_updated_at
  before update on public.circles
  for each row execute function public.set_updated_at();

-- A circle cannot silently change hands: the owner membership row and
-- circles.owner_id would drift apart. Transfer is a deliberate future feature.
create function public.circles_prevent_owner_change()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if new.owner_id is distinct from old.owner_id then
    raise exception 'circle ownership cannot be transferred; ask the owner to invite the new owner instead'
      using errcode = '42501';
  end if;
  return new;
end;
$$;

create trigger circles_prevent_owner_change
  before update on public.circles
  for each row execute function public.circles_prevent_owner_change();

-- ---------------------------------------------------------------------------
-- circle_members — who is in the circle, and as what
-- ---------------------------------------------------------------------------

create table public.circle_members (
  id uuid primary key default gen_random_uuid(),
  circle_id uuid not null references public.circles (id) on delete cascade,
  profile_id uuid not null references public.profiles (id) on delete cascade,
  role public.circle_role not null,
  invited_by uuid references public.profiles (id) on delete set null,
  -- A visiting helper (a paid aide, a neighbour) is linked by a short code
  -- rather than by invitation. The code is only ever stored as a hash, never
  -- in plain text, and it expires. Issuing and redeeming the code is a later
  -- task; this is only the column and the shape it needs.
  helper_code_hash text
    check (helper_code_hash is null or helper_code_hash ~ '^[a-f0-9]{64}$'),
  helper_code_expires_at timestamptz,
  helper_label text
    check (helper_label is null or char_length(btrim(helper_label)) between 1 and 80),
  joined_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint circle_members_circle_profile_key unique (circle_id, profile_id),

  -- Helper-only columns may only be set on a visiting_helper row.
  constraint circle_members_helper_fields_only_for_helper check (
    role = 'visiting_helper'
    or (helper_code_hash is null and helper_code_expires_at is null)
  )
);

comment on table public.circle_members is
  'Membership and role. One row per (circle, profile); exactly one owner row per circle.';
comment on column public.circle_members.helper_code_hash is
  'SHA-256 hex of the visiting helper code. Plain codes are never stored.';

create index circle_members_profile_id_idx on public.circle_members (profile_id);
create unique index circle_members_one_owner_per_circle
  on public.circle_members (circle_id)
  where role = 'owner';
create unique index circle_members_helper_code_hash_key
  on public.circle_members (helper_code_hash)
  where helper_code_hash is not null;

create trigger circle_members_set_updated_at
  before update on public.circle_members
  for each row execute function public.set_updated_at();

-- Creating a circle creates its owner membership in the same transaction, so a
-- circle can never exist without an owner member. SECURITY DEFINER because the
-- inserting client has no read access to the brand-new circle yet.
create function public.circles_create_owner_membership()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  insert into public.circle_members (circle_id, profile_id, role, joined_at)
  values (new.id, new.owner_id, 'owner', now());
  return new;
end;
$$;

create trigger circles_create_owner_membership
  after insert on public.circles
  for each row execute function public.circles_create_owner_membership();

-- The owner membership row and circles.owner_id must agree, in both directions.
create function public.circle_members_validate_owner()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  circle_owner uuid;
begin
  select c.owner_id into circle_owner from public.circles c where c.id = new.circle_id;

  if circle_owner is null then
    raise exception 'circle % does not exist', new.circle_id using errcode = '23503';
  end if;

  if new.role = 'owner' and new.profile_id <> circle_owner then
    raise exception 'the owner role belongs to the circle owner'
      using errcode = '42501';
  end if;

  return new;
end;
$$;

create trigger circle_members_validate_owner
  before insert or update on public.circle_members
  for each row execute function public.circle_members_validate_owner();

-- ---------------------------------------------------------------------------
-- care_recipients — the person being cared for
-- ---------------------------------------------------------------------------

create table public.care_recipients (
  id uuid primary key default gen_random_uuid(),
  circle_id uuid not null references public.circles (id) on delete cascade,
  full_name text not null
    check (char_length(btrim(full_name)) between 1 and 120),
  date_of_birth date
    check (date_of_birth is null or date_of_birth > date '1900-01-01'),
  relationship text
    check (relationship is null or char_length(btrim(relationship)) between 1 and 60),
  photo_url text
    check (photo_url is null or char_length(photo_url) <= 2048),
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.care_recipients is
  'The person a circle cares for. Holds basics only (name, date of birth, relationship, photo); medical detail belongs in its own table so it can be granted to different roles.';

create index care_recipients_circle_id_idx on public.care_recipients (circle_id);

create trigger care_recipients_set_updated_at
  before update on public.care_recipients
  for each row execute function public.set_updated_at();

-- Attribution is set by the database, not trusted from the client.
create function public.care_recipients_set_created_by()
returns trigger
language plpgsql
as $$
begin
  new.created_by := auth.uid();
  return new;
end;
$$;

create trigger care_recipients_set_created_by
  before insert on public.care_recipients
  for each row execute function public.care_recipients_set_created_by();

-- The plan limit is enforced server-side, from the config table. SECURITY
-- DEFINER so the count and the row lock are not filtered by the caller's own
-- read rights: the limit must hold even for a caller who can only see part of
-- the circle's data.
create function public.care_recipients_enforce_plan_limit()
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
  -- Serialise inserts per circle so two simultaneous adds cannot both pass.
  perform 1 from public.circles c where c.id = new.circle_id for update;

  select c.plan_tier into circle_tier from public.circles c where c.id = new.circle_id;

  select l.max_care_recipients into allowed
  from public.plan_limits l
  where l.tier = circle_tier;

  if allowed is null then
    raise exception 'no plan limits configured for tier %', circle_tier using errcode = '55000';
  end if;

  select count(*) into existing
  from public.care_recipients r
  where r.circle_id = new.circle_id;

  if existing >= allowed then
    raise exception 'the % plan cares for % person(s); upgrade to add another', circle_tier, allowed
      using errcode = 'P0001';
  end if;

  return new;
end;
$$;

create trigger care_recipients_enforce_plan_limit
  before insert on public.care_recipients
  for each row execute function public.care_recipients_enforce_plan_limit();

-- ---------------------------------------------------------------------------
-- audit_log — append-only record of views and changes to sensitive records
-- ---------------------------------------------------------------------------

create table public.audit_log (
  id bigint generated always as identity primary key,
  circle_id uuid not null references public.circles (id) on delete cascade,
  -- SET NULL, not CASCADE: the entry is the circle's history. When a member's
  -- account is deleted the entry stays and stops identifying them, which is
  -- what "delete my data" and "keep an audit trail" both require.
  actor_id uuid references public.profiles (id) on delete set null,
  actor_role public.circle_role,
  table_name text not null
    check (table_name ~ '^[a-z][a-z0-9_]{0,62}$'),
  row_id text not null
    check (char_length(row_id) between 1 and 64),
  action public.audit_action not null,
  -- Minimal, non-health payload: ids, counts, field *names*. Never a medication
  -- name, a note, a document title or any free text the family typed. The size
  -- cap is there to stop this becoming a shadow copy of the data.
  summary jsonb not null default '{}'::jsonb
    check (pg_column_size(summary) <= 512),
  occurred_at timestamptz not null default now()
);

comment on table public.audit_log is
  'Append-only. No client may update or delete a row; see part 4 of this migration set.';
comment on column public.audit_log.summary is
  'Minimal non-health payload (ids, counts, field names). Never free text or health content.';

create index audit_log_circle_occurred_at_idx
  on public.audit_log (circle_id, occurred_at desc);
create index audit_log_actor_id_idx
  on public.audit_log (actor_id, occurred_at desc);
create index audit_log_row_idx
  on public.audit_log (table_name, row_id, occurred_at desc);

-- ---------------------------------------------------------------------------
-- Signup: one profile per new auth user
-- ---------------------------------------------------------------------------

-- Runs as the function owner because the auth server is not a circle member and
-- has no rights in public.
create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  suggested_name text;
begin
  suggested_name := coalesce(
    nullif(btrim(new.raw_user_meta_data ->> 'full_name'), ''),
    nullif(btrim(new.raw_user_meta_data ->> 'name'), ''),
    nullif(split_part(coalesce(new.email, ''), '@', 1), ''),
    'Someone'
  );

  insert into public.profiles (id, display_name)
  values (new.id, left(suggested_name, 80))
  on conflict (id) do nothing;

  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
