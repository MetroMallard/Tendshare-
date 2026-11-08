-- 20261107120000_medications.sql
--
-- Tendshare — the medication list, the clock times the family typed, and the
-- one row a dose ever creates: its check-off. Task 8, part one: the schema, the
-- Row Level Security, the audit trail and the capability contract. The screens
-- are part two.
--
-- Forward-only. Never edit after it has been applied; add a new migration.
--
-- ## A notebook, not a prescription
--
-- `medications` stores what the family typed: a name, a strength ("500 mg"), a
-- form ("tablet"), instructions ("with food"). There is no dose-amount column,
-- no quantity column, no dosage calculator, no interaction check and no advice
-- anywhere in this file — and there must never be one. Tendshare organizes
-- care; it never gives it. A column named `dose_mg` would turn a notebook into
-- a recommendation the moment a screen rendered it.
--
-- ## Dose instances are derived, never stored
--
-- `medication_times` holds the clock times the family typed. A dose is
-- (medication, date, time) computed on the phone from that schedule. Nothing
-- has to run at midnight to create tomorrow's rows — there is no scheduler, and
-- a client may be offline — so a dose can never render as "not scheduled" when
-- it is really "not taken", which is the worst failure this product has.
--
-- The only row a dose ever writes is `med_checkoffs`, keyed by
-- (medication, date, time) and therefore unique: one slot, one tick.
--
-- ## A tick is a fact, not a claim
--
-- `taken_by` and `taken_at` are stamped by a trigger from the session, never
-- from the request body, so a visiting helper cannot attribute a dose to
-- somebody else or backdate it. There is **no update path** on
-- `med_checkoffs` — not a policy, not a privilege. A mistaken tick is undone by
-- deleting the row and ticking again, so both facts (the undo and the new tick)
-- reach the audit trail instead of one silently rewriting the other.
--
-- ## The visiting helper's one write, in the database
--
-- The owner's directive (2026-11-06): *a visiting helper may tick off a dose and
-- nothing else.* A screen that simply does not draw the button is not a
-- boundary: an aide holds the app's own anon key and a real session, so the
-- boundary has to be here.
--
--   * **select** on `medications` and `medication_times` — a helper cannot tick
--     a dose they cannot see.
--   * **select and insert** on `med_checkoffs`, and **delete only where
--     `taken_by = auth.uid()`** — their own tick, undone.
--   * **no insert, update or delete on `medications` or `medication_times`**, no
--     history function, no other member's tick.
--
-- Note the deliberate asymmetry with the 2026-11-06 note that a helper gets "no
-- history": a helper **does** read the circle's check-offs, because the Today
-- screen has to show them which slots are already ticked. Hiding that would
-- turn a second tap into a unique-constraint error rather than a calm "already
-- done". "No history" is enforced where it belongs — `medication_history()`
-- refuses the role outright, and `audit_log` has no policy for it.
--
-- ## Plan state never gates a dose
--
-- The owner settled on 2026-11-06 that a lapsed circle keeps every free
-- feature, med check-offs explicitly included. So **no policy in this file
-- calls `circle_is_writable()`**. A circle that dropped to Free can still edit
-- its med list and still tick doses; only the paid extras (cost split, the
-- fairness view, the emergency sheet PDF) go read-only.
--
-- ## The audit rule
--
-- Every write below ships its audit row in this same migration, as triggers, in
-- the same transaction as the change. The payload is ids, enums and field
-- *names*: `{"fields": ["strength"]}`, never "500 mg", never "with food". A
-- medicine name is health data; copying one into a log row would make the audit
-- trail a second copy of the thing it exists to protect.
--
-- The change history the UI needs ("Dr. Patel changed dose, logged by Sara,
-- Oct 3") is exposed by exactly one narrow, circle-scoped function,
-- `medication_history()`, which refuses a visiting helper. `audit_log` itself
-- stays as it is: append-only, never client-writable, not broadly readable.

-- ---------------------------------------------------------------------------
-- 1. The medication list
-- ---------------------------------------------------------------------------
--
-- `archived_at` is the soft stop. A medicine that is no longer taken stops
-- appearing in the list; nothing is deleted, so the history of what was taken
-- (and who said so) survives — the emergency sheet and the change history both
-- depend on it.

create table public.medications (
  id uuid primary key default gen_random_uuid(),
  circle_id uuid not null references public.circles (id) on delete cascade,
  care_recipient_id uuid not null references public.care_recipients (id) on delete cascade,
  name text not null
    check (char_length(btrim(name)) between 1 and 120),
  -- What the family typed, verbatim: "500 mg", "2 puffs", "one teaspoon". A
  -- string, never a number with a unit, because a number invites arithmetic and
  -- arithmetic here is dosing advice.
  strength text
    check (strength is null or char_length(btrim(strength)) between 1 and 60),
  form text
    check (form is null or char_length(btrim(form)) between 1 and 60),
  instructions text
    check (instructions is null or char_length(instructions) <= 1000),
  starts_on date,
  ends_on date,
  refill_due_on date,
  -- How many days before `refill_due_on` the family wants to be reminded.
  refill_reminder_days integer not null default 7
    check (refill_reminder_days between 0 and 90),
  archived_at timestamptz,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint medications_dates_sane check (
    ends_on is null or starts_on is null or ends_on >= starts_on
  )
);

comment on table public.medications is
  'Medicines exactly as the family typed them. No dose amount, no quantity, no advice: Tendshare organizes care, it never gives it.';
comment on column public.medications.strength is
  'Free text as typed ("500 mg"). Never parsed, never used to compute a dose.';
comment on column public.medications.instructions is
  'What the family wrote ("with food"). Not advice from Tendshare — it is a note.';
comment on column public.medications.archived_at is
  'Soft stop. Set when a medicine is no longer taken; the row and its history stay.';

create index medications_recipient_idx
  on public.medications (care_recipient_id, archived_at);
create index medications_circle_idx
  on public.medications (circle_id);

create trigger medications_set_updated_at
  before update on public.medications
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- 2. The clock times the family typed
-- ---------------------------------------------------------------------------
--
-- No `circle_id` here: the circle is the medication's, and duplicating it would
-- create a second thing to keep in step. Policies reach it through
-- `medication_circle_id()` below.

create table public.medication_times (
  id uuid primary key default gen_random_uuid(),
  medication_id uuid not null references public.medications (id) on delete cascade,
  time_of_day time not null,
  label text
    check (label is null or char_length(btrim(label)) between 1 and 40),
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  -- One medication cannot be scheduled twice at the same minute. Two rows at
  -- 08:00 would derive two identical doses, and the second tick would collide
  -- with the first for no reason a family could understand.
  constraint medication_times_medication_time_key unique (medication_id, time_of_day)
);

comment on table public.medication_times is
  'The clock times the family typed ("morning", 08:00). Doses are derived from these; nothing is generated at midnight.';
comment on column public.medication_times.label is
  'Free text as typed ("morning", "with breakfast"). Optional.';

create index medication_times_medication_idx
  on public.medication_times (medication_id, time_of_day);

create trigger medication_times_set_updated_at
  before update on public.medication_times
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- 3. The check-off — the only row a dose ever creates
-- ---------------------------------------------------------------------------
--
-- `taken_by` is nullable for one reason: `on delete set null`. When a person
-- deletes their account the tick they made stays (the dose was taken; that is a
-- fact about the person being cared for, not about the account), and it stops
-- identifying them. Every insert sets it from the session.

create table public.med_checkoffs (
  id uuid primary key default gen_random_uuid(),
  circle_id uuid not null references public.circles (id) on delete cascade,
  medication_id uuid not null references public.medications (id) on delete cascade,
  dose_date date not null,
  dose_time time not null,
  taken_by uuid references public.profiles (id) on delete set null,
  taken_at timestamptz not null default now(),
  created_at timestamptz not null default now(),

  -- One slot, one tick. A second tap is a duplicate, not a second dose.
  constraint med_checkoffs_slot_key unique (medication_id, dose_date, dose_time)
);

comment on table public.med_checkoffs is
  'One row per ticked dose slot. No update path: a mistake is undone by deleting and ticking again, so both facts are audited.';
comment on column public.med_checkoffs.taken_by is
  'Set by trigger from auth.uid() on insert. Never from the request body.';
comment on column public.med_checkoffs.taken_at is
  'Set by trigger to now() on insert. A tick cannot be backdated.';

create index med_checkoffs_circle_date_idx
  on public.med_checkoffs (circle_id, dose_date);
create index med_checkoffs_medication_idx
  on public.med_checkoffs (medication_id, dose_date);
create index med_checkoffs_taken_by_idx
  on public.med_checkoffs (taken_by);

-- ---------------------------------------------------------------------------
-- 4. Reaching a medication's circle from a child row
-- ---------------------------------------------------------------------------
--
-- SECURITY DEFINER so the policy on `medication_times` and `med_checkoffs` can
-- ask about the parent without re-entering the parent's policies (the same
-- recursion problem the identity migration documents). Pinned `search_path` so
-- a shadowed `medications` cannot be substituted. A missing medication answers
-- null, which every policy treats as "no".

create function public.medication_circle_id(target_medication_id uuid)
returns uuid
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select m.circle_id from public.medications m where m.id = target_medication_id;
$$;

comment on function public.medication_circle_id(uuid) is
  'The circle a medication belongs to, or null. Used by the policies on its times and check-offs.';

revoke all on function public.medication_circle_id(uuid) from public, anon;
grant execute on function public.medication_circle_id(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- 5. Integrity: the person belongs to the circle, the author is the session
-- ---------------------------------------------------------------------------
--
-- Two foreign keys alone would allow a row whose `circle_id` is one family's and
-- whose `care_recipient_id` is another's. RLS checks the circle; this checks
-- that the two agree.

create function public.medications_validate_recipient()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  recipient_circle uuid;
begin
  select r.circle_id into recipient_circle
  from public.care_recipients r
  where r.id = new.care_recipient_id;

  if recipient_circle is null then
    raise exception 'that person does not exist' using errcode = '23503';
  end if;

  if recipient_circle <> new.circle_id then
    raise exception 'that person is not in this circle' using errcode = '42501';
  end if;

  return new;
end;
$$;

comment on function public.medications_validate_recipient() is
  'Refuses a medication whose person and circle disagree.';

create trigger medications_validate_recipient
  before insert or update of circle_id, care_recipient_id on public.medications
  for each row execute function public.medications_validate_recipient();

-- Attribution is the database's, exactly as it is for the profile tables.
create function public.medications_set_created_by()
returns trigger
language plpgsql
as $$
begin
  new.created_by := auth.uid();
  return new;
end;
$$;

create trigger medications_set_created_by
  before insert on public.medications
  for each row execute function public.medications_set_created_by();

-- The tick is a fact: who, when, and which circle — all from the session and
-- from the medication, never from the request body. This runs before the RLS
-- WITH CHECK, so the policy sees the circle the medication really belongs to
-- rather than the one a client claimed.
create function public.med_checkoffs_stamp_actor()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  caller uuid := auth.uid();
  medication_circle uuid;
  caller_role public.circle_role;
begin
  if caller is null then
    raise exception 'not signed in' using errcode = '42501';
  end if;

  select m.circle_id into medication_circle
  from public.medications m
  where m.id = new.medication_id;

  if medication_circle is null then
    raise exception 'that medication does not exist' using errcode = '23503';
  end if;

  select cm.role into caller_role
  from public.circle_members cm
  where cm.circle_id = medication_circle and cm.profile_id = caller;

  if caller_role is null then
    raise exception 'you are not in this circle' using errcode = '42501';
  end if;

  -- The policy says the same thing; this says it in one place a future policy
  -- edit cannot quietly undo, and it is what makes the error message honest.
  if caller_role not in ('owner', 'family_member', 'visiting_helper') then
    raise exception 'this role may not check off a dose' using errcode = '42501';
  end if;

  new.circle_id := medication_circle;
  new.taken_by := caller;
  new.taken_at := now();
  new.created_at := now();

  return new;
end;
$$;

comment on function public.med_checkoffs_stamp_actor() is
  'Stamps taken_by, taken_at and circle_id from the session and the medication. A helper cannot attribute a dose to anyone else.';

create trigger med_checkoffs_stamp_actor
  before insert on public.med_checkoffs
  for each row execute function public.med_checkoffs_stamp_actor();

-- ---------------------------------------------------------------------------
-- 6. Row Level Security: enabled and forced, on all three tables
-- ---------------------------------------------------------------------------
--
-- FORCE RLS applies to the table owner too, which is what the SECURITY DEFINER
-- triggers above run as — hence the single owner-role policy per table, exactly
-- as Tasks 3 and 7 do it. That role is not reachable from the API: PostgREST
-- connects as `authenticator` and switches to `anon` or `authenticated`.

alter table public.medications enable row level security;
alter table public.medication_times enable row level security;
alter table public.med_checkoffs enable row level security;

alter table public.medications force row level security;
alter table public.medication_times force row level security;
alter table public.med_checkoffs force row level security;

do $$
declare
  owner_role name;
  target_table text;
begin
  select r.rolname into owner_role
  from pg_class c
  join pg_roles r on r.oid = c.relowner
  where c.oid = 'public.medications'::regclass;

  foreach target_table in array array['medications', 'medication_times', 'med_checkoffs']
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

-- The med list, read by every role in the circle — a visiting helper included,
-- because a helper cannot tick a dose they cannot see. No `circle_is_writable`
-- anywhere: the med list is a free feature and a lapsed circle keeps it.
create policy medications_select_circle
  on public.medications
  for select
  to authenticated
  using (
    public.has_circle_role(
      circle_id,
      array['owner', 'family_member', 'view_only', 'visiting_helper']::public.circle_role[]
    )
  );

create policy medications_insert_care_team
  on public.medications
  for insert
  to authenticated
  with check (public.can_write_care_data(circle_id));

create policy medications_update_care_team
  on public.medications
  for update
  to authenticated
  using (public.can_write_care_data(circle_id))
  with check (public.can_write_care_data(circle_id));

create policy medications_delete_care_team
  on public.medications
  for delete
  to authenticated
  using (public.can_write_care_data(circle_id));

-- The times follow their medication's circle.
create policy medication_times_select_circle
  on public.medication_times
  for select
  to authenticated
  using (
    public.has_circle_role(
      public.medication_circle_id(medication_id),
      array['owner', 'family_member', 'view_only', 'visiting_helper']::public.circle_role[]
    )
  );

create policy medication_times_insert_care_team
  on public.medication_times
  for insert
  to authenticated
  with check (public.can_write_care_data(public.medication_circle_id(medication_id)));

create policy medication_times_update_care_team
  on public.medication_times
  for update
  to authenticated
  using (public.can_write_care_data(public.medication_circle_id(medication_id)))
  with check (public.can_write_care_data(public.medication_circle_id(medication_id)));

create policy medication_times_delete_care_team
  on public.medication_times
  for delete
  to authenticated
  using (public.can_write_care_data(public.medication_circle_id(medication_id)));

-- Check-offs: the care team ticks and undoes anything; a helper ticks and
-- undoes only their own. View-only is absent from every write policy, and there
-- is no UPDATE policy at all — the undo is a delete.
create policy med_checkoffs_select_circle
  on public.med_checkoffs
  for select
  to authenticated
  using (
    public.has_circle_role(
      circle_id,
      array['owner', 'family_member', 'view_only', 'visiting_helper']::public.circle_role[]
    )
  );

create policy med_checkoffs_insert_circle
  on public.med_checkoffs
  for insert
  to authenticated
  with check (
    public.has_circle_role(
      circle_id,
      array['owner', 'family_member', 'visiting_helper']::public.circle_role[]
    )
  );

create policy med_checkoffs_delete_care_team_or_own_tick
  on public.med_checkoffs
  for delete
  to authenticated
  using (
    public.can_write_care_data(circle_id)
    or (
      public.has_circle_role(circle_id, array['visiting_helper']::public.circle_role[])
      and taken_by = auth.uid()
    )
  );

-- ---------------------------------------------------------------------------
-- 7. Table privileges
-- ---------------------------------------------------------------------------
--
-- `med_checkoffs` gets no UPDATE privilege at all, so there is no update path
-- even if a policy were added by mistake later. `anon` gets nothing.

revoke all on table public.medications from anon, authenticated;
revoke all on table public.medication_times from anon, authenticated;
revoke all on table public.med_checkoffs from anon, authenticated;

grant select, insert, update, delete on table public.medications to authenticated;
grant select, insert, update, delete on table public.medication_times to authenticated;
grant select, insert, delete on table public.med_checkoffs to authenticated;

revoke update on table public.med_checkoffs from anon, authenticated;

-- ---------------------------------------------------------------------------
-- 8. Audit: the medication list and its times
-- ---------------------------------------------------------------------------
--
-- One function for both tables. The diff is computed from the row rather than a
-- hand-kept column list, so a column added later is audited without anyone
-- remembering to come back here. The summary always carries `medication_id` so
-- the history read path below can find every event for one medicine, including
-- the times rows it no longer has.
--
-- Two guards, both documented in Task 6's pattern:
--   * a circle that is being deleted writes no row (the audit row would either
--     abort the deletion the person asked for or vanish a moment later);
--   * a `medication_times` row deleted by cascade writes no row — the
--     medication's own `delete` is the event, and its times go with it. A
--     times row deleted on its own (someone removed the 8pm dose) still does.

create function public.audit_medication_change()
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
    -- A field the family left blank is not a field they filled in.
    where entry.value <> 'null'::jsonb
      and entry.key not in ('id', 'medication_id', 'circle_id', 'created_by', 'created_at', 'updated_at');
  elsif tg_op = 'UPDATE' then
    select coalesce(jsonb_agg(diff.key order by diff.key), '[]'::jsonb) into changed
    from (
      select fresh.key
      from jsonb_each(to_jsonb(new)) fresh
      join jsonb_each(to_jsonb(old)) before on before.key = fresh.key
      where fresh.value is distinct from before.value
        and fresh.key not in ('created_at', 'updated_at')
    ) diff;

    -- A re-save that changed nothing is not an event.
    if changed = '[]'::jsonb then
      return new;
    end if;
  else
    changed := '[]'::jsonb;
  end if;

  summary := jsonb_build_object('medication_id', target_medication, 'fields', changed);

  -- Archiving is an update, but it is a distinct thing to a family ("stopped",
  -- not "edited"). `audit_action` has no `archive` member and adding one to the
  -- enum is a separate, riskier migration, so the flag rides in the summary.
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

comment on function public.audit_medication_change() is
  'Appends an audit row when a medication or one of its times changes. Field names and the medication id only — never a medicine name.';

create trigger medications_audit_insert
  after insert on public.medications
  for each row execute function public.audit_medication_change();

create trigger medications_audit_update
  after update on public.medications
  for each row execute function public.audit_medication_change();

create trigger medications_audit_delete
  before delete on public.medications
  for each row execute function public.audit_medication_change();

create trigger medication_times_audit_insert
  after insert on public.medication_times
  for each row execute function public.audit_medication_change();

create trigger medication_times_audit_update
  after update on public.medication_times
  for each row execute function public.audit_medication_change();

create trigger medication_times_audit_delete
  before delete on public.medication_times
  for each row execute function public.audit_medication_change();

-- ---------------------------------------------------------------------------
-- 9. Audit: a tick and an undo, each its own event
-- ---------------------------------------------------------------------------
--
-- `dose.ticked` and `dose.unticked` carry the medication id, the dose date and
-- the dose time — the three things a family needs to read "Sara ticked the 8am
-- donepezil" back — and nothing else. No medicine name, no instructions.
--
-- A check-off deleted by cascade (its medication was deleted) writes no row:
-- nobody unticked it, and the medication's own delete is the event.

create function public.audit_med_checkoff()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  target_circle uuid;
  target_row text;
  medication uuid;
  dose_on date;
  dose_at time;
  event text;
  actor uuid := auth.uid();
  actor_role public.circle_role;
begin
  if tg_op = 'DELETE' then
    target_circle := old.circle_id;
    target_row := old.id::text;
    medication := old.medication_id;
    dose_on := old.dose_date;
    dose_at := old.dose_time;
    event := 'dose.unticked';
  else
    target_circle := new.circle_id;
    target_row := new.id::text;
    medication := new.medication_id;
    dose_on := new.dose_date;
    dose_at := new.dose_time;
    event := 'dose.ticked';
  end if;

  if not exists (select 1 from public.circles c where c.id = target_circle) then
    if tg_op = 'DELETE' then
      return old;
    end if;
    return new;
  end if;

  if not exists (select 1 from public.medications m where m.id = medication) then
    if tg_op = 'DELETE' then
      return old;
    end if;
    return new;
  end if;

  select m.role into actor_role
  from public.circle_members m
  where m.circle_id = target_circle and m.profile_id = actor;

  insert into public.audit_log (
    circle_id, actor_id, actor_role, table_name, row_id, action, summary
  )
  values (
    target_circle, actor, actor_role, 'med_checkoffs', target_row,
    (case tg_op when 'INSERT' then 'create' else 'delete' end)::public.audit_action,
    jsonb_build_object(
      'event', event,
      'medication_id', medication,
      'dose_date', dose_on,
      'dose_time', dose_at
    )
  );

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

comment on function public.audit_med_checkoff() is
  'Appends an audit row per tick (dose.ticked) and per undo (dose.unticked), carrying medication id, dose date and dose time.';

create trigger med_checkoffs_audit_insert
  after insert on public.med_checkoffs
  for each row execute function public.audit_med_checkoff();

create trigger med_checkoffs_audit_delete
  before delete on public.med_checkoffs
  for each row execute function public.audit_med_checkoff();

-- ---------------------------------------------------------------------------
-- 10. The one read path for the change history
-- ---------------------------------------------------------------------------
--
-- `audit_log` is not readable to a visiting helper and is not made broadly
-- readable here. The med change history the screens need comes from this
-- function and only this function:
--
--   * circle-scoped — a medication id from another circle is refused, not
--     filtered, so the answer is never a misleading empty list;
--   * role-scoped — owner, family member and view-only (the care team plus the
--     people watching); a visiting helper is refused outright, which is the
--     "no history" line of the 2026-11-06 decision;
--   * field *names*, timestamps, the event type and the actor's display name.
--     Never a value, never a medicine name, never an instruction.

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
  actor_role public.circle_role
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
    a.actor_role
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
  'The circle''s medication change history: field names, timestamps, event type and the actor''s name. Refuses a visiting helper and another circle.';

revoke all on function public.medication_history(uuid, uuid, integer) from public, anon;
grant execute on function public.medication_history(uuid, uuid, integer) to authenticated;

-- ---------------------------------------------------------------------------
-- 11. None of the trigger functions is callable by a client
-- ---------------------------------------------------------------------------

revoke all on function public.audit_medication_change() from public, anon, authenticated;
revoke all on function public.audit_med_checkoff() from public, anon, authenticated;
revoke all on function public.medications_validate_recipient() from public, anon, authenticated;
revoke all on function public.medications_set_created_by() from public, anon, authenticated;
revoke all on function public.med_checkoffs_stamp_actor() from public, anon, authenticated;

-- Make the new tables and functions visible to PostgREST immediately.
notify pgrst, 'reload schema';
