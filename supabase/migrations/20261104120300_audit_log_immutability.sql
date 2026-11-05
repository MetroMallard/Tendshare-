-- 20261104120300_audit_log_immutability.sql
--
-- Tendshare — identity and authorisation core, part 4 of 4: the audit log is
-- append-only, and stays that way.
--
-- Forward-only. Never edit after it has been applied; add a new migration.
--
-- Part 3 already removes UPDATE / DELETE / TRUNCATE from every client role and
-- gives no client an UPDATE or DELETE policy. This file makes the guarantee
-- independent of grants and policies, so a future migration that carelessly
-- re-grants something cannot quietly make the trail editable.
--
-- ## The two carve-outs, and why they exist
--
-- The brief requires both "nothing may delete audit rows" and "full account and
-- data deletion". Those meet at exactly two places, and an unconditional
-- trigger would break the second:
--
--   1. `audit_log.actor_id` is `on delete set null`. Deleting a person's
--      account makes Postgres issue
--      `UPDATE ONLY audit_log SET actor_id = NULL WHERE actor_id = $1`.
--      The trigger below allows exactly that one change — the entry stays, and
--      stops identifying the person, which is what deleting an account means
--      for a history table.
--   2. Deleting a circle cascades its audit rows away. There is therefore no
--      BEFORE DELETE trigger: DELETE is blocked for every client by the absence
--      of a DELETE policy and by the revoked privilege, and is possible only for
--      the table owner (the migration/admin role, which is not reachable from
--      the API) and for the foreign-key cascade from `circles`.
--
-- Everything else — any other UPDATE, any TRUNCATE — is refused outright.
--
-- The RLS suite proves all of it: a member's UPDATE and DELETE of an audit row
-- change nothing, deleting a member anonymises their entries instead of
-- destroying them, and deleting the circle removes everything.

create function public.audit_log_reject_mutation()
returns trigger
language plpgsql
as $$
begin
  -- The one permitted UPDATE: the foreign key nulling the actor when an account
  -- is deleted. Every other column must be byte-for-byte unchanged.
  if tg_op = 'UPDATE'
     and new.actor_id is null
     and old.actor_id is not null
     and (to_jsonb(new) - 'actor_id') = (to_jsonb(old) - 'actor_id') then
    return new;
  end if;

  raise exception 'audit_log is append-only: % is not allowed', tg_op
    using errcode = '42501',
          hint = 'Audit rows are a record of what happened. Write a new row instead.';
end;
$$;

comment on function public.audit_log_reject_mutation() is
  'Blocks every UPDATE and TRUNCATE of public.audit_log except the foreign key anonymising a deleted actor.';

create trigger audit_log_reject_update
  before update on public.audit_log
  for each row execute function public.audit_log_reject_mutation();

create trigger audit_log_reject_truncate
  before truncate on public.audit_log
  for each statement execute function public.audit_log_reject_mutation();

-- Belt and braces: the privileges are already revoked in part 3, and repeating
-- them here means a later migration that re-grants them has to delete a line
-- from this file first.
revoke update, delete, truncate on table public.audit_log from anon, authenticated;
