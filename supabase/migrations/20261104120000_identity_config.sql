-- 20261104120000_identity_config.sql
--
-- Tendshare — identity and authorisation core, part 1 of 4: the vocabulary.
--
-- Forward-only migration. Never edit this file after it has been applied to a
-- project; add a new timestamped migration instead.
--
-- What lives here:
--   * the enums that describe roles, plans and audited actions;
--   * `plan_limits`, the single config table for plan limits and prices.
--
-- Plan limits and prices are CONFIG, not business rules baked into SQL. The
-- triggers and the app both read them from `public.plan_limits`, so changing a
-- limit is a row update, not a migration. The brief (PROJECT_BRIEF.md → Plans)
-- is the source of truth for the seed values below.

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------

-- The four roles from the brief. Order matters only for readability.
create type public.circle_role as enum (
  'owner',
  'family_member',
  'view_only',
  'visiting_helper'
);

create type public.plan_tier as enum (
  'free',
  'family',
  'family_plus'
);

-- `canceled` / `expired` mean the circle is read-only: nothing is deleted when
-- a plan ends, the extra features simply stop accepting writes.
create type public.plan_status as enum (
  'trialing',
  'active',
  'past_due',
  'canceled',
  'expired'
);

-- What can be recorded against a sensitive record. `view` is deliberately
-- included: the brief requires an audit log of *views* as well as changes.
create type public.audit_action as enum (
  'view',
  'create',
  'update',
  'delete',
  'export',
  'invite'
);

-- ---------------------------------------------------------------------------
-- Plan configuration
-- ---------------------------------------------------------------------------

-- One row per plan tier. `null` in a limit column means "no limit".
-- These are the only place limits are written down: no number is repeated in a
-- trigger, a policy or the app.
create table public.plan_limits (
  tier public.plan_tier primary key,
  -- How many people a circle may care for (Free 1, Family Plus 3).
  max_care_recipients integer not null check (max_care_recipients > 0),
  -- How many members a circle may have; null = unlimited.
  max_members integer check (max_members is null or max_members > 0),
  -- How many documents a circle may store; null = unlimited.
  max_documents integer check (max_documents is null or max_documents > 0),
  -- Prices in cents, so no floating point ever touches money.
  monthly_price_cents integer not null default 0 check (monthly_price_cents >= 0),
  annual_price_cents integer not null default 0 check (annual_price_cents >= 0),
  -- Length of the trial granted when a circle is created, in days (0 = none).
  trial_days integer not null default 0 check (trial_days >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.plan_limits is
  'Plan limits and prices as config. Read by the server-side limit triggers and by the app; never hardcode these numbers elsewhere.';

insert into public.plan_limits
  (tier, max_care_recipients, max_members, max_documents, monthly_price_cents, annual_price_cents, trial_days)
values
  -- Free: one circle, 1 person cared for, up to 3 members, 10 documents.
  ('free', 1, 3, 10, 0, 0, 0),
  -- Family: unlimited members and documents, cost split, $7.99 / $69, 14-day trial.
  ('family', 1, null, null, 799, 6900, 14),
  -- Family Plus: up to 3 people cared for, everything in Family, $12.99 / $109.
  ('family_plus', 3, null, null, 1299, 10900, 14);

-- ---------------------------------------------------------------------------
-- updated_at bookkeeping
-- ---------------------------------------------------------------------------

create function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

comment on function public.set_updated_at() is
  'Generic BEFORE UPDATE trigger: keeps updated_at honest without trusting the client.';
