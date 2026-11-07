-- 20261107120100_medications_audit_fields.sql
--
-- Tendshare — one correction to the medication audit trigger, found by the
-- hosted RLS suite in the same pull request that added it.
--
-- `audit_medication_change()` excluded `id`, `circle_id`, `created_by` and the
-- bookkeeping columns from the `fields` list, but not `care_recipient_id`. The
-- result was a create event reading
-- `{"fields": ["care_recipient_id", "form", "name", …]}`: an id the family
-- never typed, sitting in a list that is meant to mean "these are the things
-- that changed". A screen rendering the change history would show "care
-- recipient" as an edit nobody made.
--
-- Including it was not a privacy problem — the payload rule allows ids — but it
-- was the wrong *meaning*, and Task 7's equivalent trigger already excludes the
-- column. This migration makes the two agree.
--
-- Forward-only: 20261107120000_medications.sql is applied and is not edited.
-- `create or replace` keeps the function's identity, so its revokes from that
-- migration still hold; they are restated here so the file reads on its own.

create or replace function public.audit_medication_change()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  target_circle uuid;
  target_medication uuid;
  target_row text;
  actor uuid := auth.uid();
  actor_role public.circle_role;
  row_json jsonb;
  changed jsonb;
  summary jsonb;
begin
  if tg_op = 'DELETE' then
    row_json := to_jsonb(old);
    target_row := old.id::text;
  else
    row_json := to_jsonb(new);
    target_row := new.id::text;
  end if;

  if tg_table_name = 'medications' then
    target_circle := (row_json ->> 'circle_id')::uuid;
    target_medication := (row_json ->> 'id')::uuid;
  else
    target_medication := (row_json ->> 'medication_id')::uuid;
    target_circle := public.medication_circle_id(target_medication);
  end if;

  if target_circle is null
    or not exists (select 1 from public.circles c where c.id = target_circle)
  then
    if tg_op = 'DELETE' then
      return old;
    end if;
    return new;
  end if;

  select m.role into actor_role
  from public.circle_members m
  where m.circle_id = target_circle and m.profile_id = actor;

  if tg_op = 'INSERT' then
    select coalesce(jsonb_agg(entry.key order by entry.key), '[]'::jsonb) into changed
    from jsonb_each(row_json) entry
    -- A field the family left blank is not a field they filled in, and an id is
    -- not a field they typed. This is the list Task 7's trigger produces.
    where entry.value <> 'null'::jsonb
      and entry.key not in (
        'id', 'circle_id', 'care_recipient_id', 'medication_id',
        'created_by', 'created_at', 'updated_at'
      );
  elsif tg_op = 'UPDATE' then
    select coalesce(jsonb_agg(diff.key order by diff.key), '[]'::jsonb) into changed
    from (
      select fresh.key
      from jsonb_each(to_jsonb(new)) fresh
      join jsonb_each(to_jsonb(old)) before on before.key = fresh.key
      where fresh.value is distinct from before.value
        and fresh.key not in ('created_at', 'updated_at')
    ) diff;

    if changed = '[]'::jsonb then
      return new;
    end if;
  else
    changed := '[]'::jsonb;
  end if;

  summary := jsonb_build_object('medication_id', target_medication, 'fields', changed);

  if tg_op = 'UPDATE' and (changed ? 'archived_at') then
    summary := summary || jsonb_build_object('archived', (new.archived_at is not null));
  end if;

  insert into public.audit_log (
    circle_id, actor_id, actor_role, table_name, row_id, action, summary
  )
  values (
    target_circle, actor, actor_role, tg_table_name, target_row,
    (case tg_op when 'INSERT' then 'create' when 'UPDATE' then 'update' else 'delete' end)::public.audit_action,
    summary
  );

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

revoke all on function public.audit_medication_change() from public, anon, authenticated;

notify pgrst, 'reload schema';
