-- 20261108120000_medication_history_dose_time.sql
--
-- Tendshare — the change history learns *which* dose a tick was for. Task 8,
-- part two: the screens. Forward-only; the schema from part one is not redesigned.
--
-- ## Why this is needed
--
-- `medication_history()` (20261107120000_medications.sql, section 10) returns
-- field names, timestamps, the event type and the actor's name — enough for
-- "Sara changed strength, 6 Nov". It is not enough for the tick, which is the
-- event a family actually asks about: the audit row for a tick already carries
-- `dose_date` and `dose_time` in its summary (see `audit_med_checkoff`), but the
-- function never projected them, so the best a screen could say was "Priya
-- ticked a dose" with no time on it.
--
-- This adds two columns to the result and nothing else. No table changes, no
-- policy changes, no new privilege: the same three roles are refused or allowed
-- exactly as before, and a visiting helper is still refused outright.
--
-- ## Why DROP and not CREATE OR REPLACE
--
-- Postgres will not change a function's return type in place. The function is
-- dropped and recreated with the same name, arguments and body plus the two new
-- columns, and the grants are restated because a dropped function takes its
-- privileges with it. Nothing calls it between the two statements: this runs in
-- one transaction, and no session can see the intermediate state.

drop function if exists public.medication_history(uuid, uuid, integer);

create function public.medication_history(
  p_circle_id uuid,
  p_medication_id uuid default null,
  p_limit integer default 50
)
returns table (
  occurred_at timestamptz,
  event text,
  action public.audit_action,
  table_name text,
  row_id text,
  medication_id uuid,
  fields jsonb,
  actor_name text,
  actor_role public.circle_role,
  -- New in this migration: the slot a tick was for. Null on every row that is
  -- not a tick, and on any row written before the check-off trigger recorded it.
  dose_date date,
  dose_time time
)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  safe_limit integer := greatest(1, least(coalesce(p_limit, 50), 200));
begin
  if not public.has_circle_role(
    p_circle_id,
    array['owner', 'family_member', 'view_only']::public.circle_role[]
  ) then
    raise exception 'this history is not shared with your role' using errcode = '42501';
  end if;

  if p_medication_id is not null
    and public.medication_circle_id(p_medication_id) is distinct from p_circle_id
  then
    raise exception 'that medication is not in this circle' using errcode = '42501';
  end if;

  return query
  select
    a.occurred_at,
    coalesce(a.summary ->> 'event', a.action::text) as event,
    a.action,
    a.table_name,
    a.row_id,
    (a.summary ->> 'medication_id')::uuid as medication_id,
    coalesce(a.summary -> 'fields', '[]'::jsonb) as fields,
    p.display_name as actor_name,
    a.actor_role,
    -- Cast through text: a malformed value in an old row must not make the whole
    -- history unreadable, and `nullif` keeps a missing key as a null date.
    nullif(a.summary ->> 'dose_date', '')::date as dose_date,
    nullif(a.summary ->> 'dose_time', '')::time as dose_time
  from public.audit_log a
  left join public.profiles p on p.id = a.actor_id
  where a.circle_id = p_circle_id
    and a.table_name in ('medications', 'medication_times', 'med_checkoffs')
    and (p_medication_id is null or (a.summary ->> 'medication_id')::uuid = p_medication_id)
  order by a.occurred_at desc, a.id desc
  limit safe_limit;
end;
$$;

comment on function public.medication_history(uuid, uuid, integer) is
  'The circle''s medication change history: field names, timestamps, event type, the actor''s name and — for a tick — the dose slot. Refuses a visiting helper and another circle.';

revoke all on function public.medication_history(uuid, uuid, integer) from public, anon;
grant execute on function public.medication_history(uuid, uuid, integer) to authenticated;

notify pgrst, 'reload schema';
