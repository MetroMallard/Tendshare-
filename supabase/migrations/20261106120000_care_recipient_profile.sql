-- 20261106120000_care_recipient_profile.sql
--
-- Tendshare — the person profile, Task 7: the basics the family types about the
-- person they care for, their doctors and pharmacies, their allergies and
-- conditions exactly as the family worded them, and their insurance cards.
--
-- Forward-only. Never edit after it has been applied; add a new migration.
--
-- ## What this migration is, and is not
--
-- This is a notebook, not a medical record. `care_recipient_conditions` has a
-- `label` the family typed and a note; there is no picklist, no severity, no
-- interaction check and no advice anywhere in this file or the screens that read
-- it. Tendshare organizes care; it never gives it.
--
-- ## The visiting helper's boundary, in the database
--
-- The owner's directive is that a visiting helper sees the person they are
-- helping — name, photo, relationship — and nothing more. A screen that simply
-- does not ask is not a boundary: an aide with the app's own anon key and a
-- session could ask directly. So the boundary is here, three ways:
--
--   1. **New tables get no policy for `visiting_helper`.** `has_circle_role` is
--      asked for owner / family_member / view_only and the answer for a helper is
--      no. Contacts, conditions and insurance are invisible to them.
--   2. **Writes need `can_write_care_data`**, which is owner or family_member
--      only. View-only reads and changes nothing; a helper changes nothing.
--   3. **`care_recipients.notes` is not granted to any client role at all.** Row
--      Level Security works on rows, not columns, and `care_recipients` must stay
--      readable to a helper for the name and photo. A free-text note is exactly
--      where a family types something health-related ("don't leave her alone"),
--      so the column is reachable only through `care_recipient_notes()`, which
--      refuses a visiting helper outright. The rest of the row is granted column
--      by column, so a helper reading the row cannot reach the note even with a
--      hand-written query.
--
-- ## The audit rule
--
-- Every write below ships its audit row in this same migration, as triggers, in
-- the same transaction as the change — the owner's standing rule. The payload is
-- ids, enums and field *names*: `{"fields": ["phone"]}`, never the phone number,
-- never an allergy. An allergy is health data; copying one into a log row would
-- turn the audit trail into a second copy of the thing it is meant to protect.

-- ---------------------------------------------------------------------------
-- 1. The basics the table did not have yet
-- ---------------------------------------------------------------------------
--
-- `full_name`, `date_of_birth`, `relationship` and `photo_url` already exist
-- (Task 3). Nothing here duplicates them.

alter table public.care_recipients
  add column preferred_name text
    check (preferred_name is null or char_length(btrim(preferred_name)) between 1 and 80),
  add column phone text
    check (phone is null or char_length(btrim(phone)) between 1 and 40),
  add column notes text
    check (notes is null or char_length(notes) <= 2000);

comment on column public.care_recipients.preferred_name is
  'What the family calls them. "Margaret" may be "Peg" to everyone who knows her.';
comment on column public.care_recipients.phone is
  'The person''s own phone number, as typed. No formatting or validation beyond a length cap.';
comment on column public.care_recipients.notes is
  'Free text the family typed. Not granted to any client role: readable only through care_recipient_notes(), which a visiting helper cannot call.';
comment on column public.care_recipients.photo_url is
  'Path of the photo inside the private care-media bucket. Never a public URL — see 20261106120100_care_media_bucket.sql.';

-- ---------------------------------------------------------------------------
-- 2. Two small enums, so a typo cannot invent a category
-- ---------------------------------------------------------------------------

create type public.care_contact_kind as enum ('doctor', 'pharmacy', 'other');
create type public.care_condition_kind as enum ('allergy', 'condition');

comment on type public.care_condition_kind is
  'Allergy or condition, as the family typed it. There is no severity, no code and no clinical vocabulary on purpose.';

-- ---------------------------------------------------------------------------
-- 3. Doctors and pharmacies — one table, two lists
-- ---------------------------------------------------------------------------
--
-- Both lists are short and typed by hand, and they behave identically: a name, a
-- phone number to tap, an address to map. Two tables would be the same table
-- twice. `is_primary` is what makes one of them "her doctor" in a list of four.

create table public.care_recipient_contacts (
  id uuid primary key default gen_random_uuid(),
  circle_id uuid not null references public.circles (id) on delete cascade,
  care_recipient_id uuid not null references public.care_recipients (id) on delete cascade,
  kind public.care_contact_kind not null default 'doctor',
  name text not null
    check (char_length(btrim(name)) between 1 and 120),
  organisation text
    check (organisation is null or char_length(btrim(organisation)) between 1 and 120),
  phone text
    check (phone is null or char_length(btrim(phone)) between 1 and 40),
  address text
    check (address is null or char_length(btrim(address)) between 1 and 300),
  notes text
    check (notes is null or char_length(notes) <= 1000),
  -- "Her main doctor" rather than "one of four". Not made unique by the
  -- database: two rows marked primary is a cosmetic muddle, and a client that
  -- has to unset the old one first would fail on a flaky connection.
  is_primary boolean not null default false,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.care_recipient_contacts is
  'Doctors and pharmacies, typed by the family. Readable to owner, family member and view-only; never to a visiting helper.';

create index care_recipient_contacts_recipient_idx
  on public.care_recipient_contacts (care_recipient_id, kind);
create index care_recipient_contacts_circle_idx
  on public.care_recipient_contacts (circle_id);

create trigger care_recipient_contacts_set_updated_at
  before update on public.care_recipient_contacts
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- 4. Allergies and conditions, as the family typed them
-- ---------------------------------------------------------------------------

create table public.care_recipient_conditions (
  id uuid primary key default gen_random_uuid(),
  circle_id uuid not null references public.circles (id) on delete cascade,
  care_recipient_id uuid not null references public.care_recipients (id) on delete cascade,
  kind public.care_condition_kind not null,
  label text not null
    check (char_length(btrim(label)) between 1 and 120),
  notes text
    check (notes is null or char_length(notes) <= 1000),
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.care_recipient_conditions is
  'Allergies and conditions as the family typed them. A notebook, not a medical record: no codes, no severity, no advice.';

create index care_recipient_conditions_recipient_idx
  on public.care_recipient_conditions (care_recipient_id, kind);
create index care_recipient_conditions_circle_idx
  on public.care_recipient_conditions (circle_id);

create trigger care_recipient_conditions_set_updated_at
  before update on public.care_recipient_conditions
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- 5. Insurance cards
-- ---------------------------------------------------------------------------
--
-- The card number and the group number are typed; the photo of the card is an
-- object in the private bucket. `image_path` is a path, never a URL: a stored
-- public URL would outlive every policy that protects it.

create table public.care_recipient_insurance (
  id uuid primary key default gen_random_uuid(),
  circle_id uuid not null references public.circles (id) on delete cascade,
  care_recipient_id uuid not null references public.care_recipients (id) on delete cascade,
  plan_name text not null
    check (char_length(btrim(plan_name)) between 1 and 120),
  member_id text
    check (member_id is null or char_length(btrim(member_id)) between 1 and 80),
  group_number text
    check (group_number is null or char_length(btrim(group_number)) between 1 and 80),
  image_path text
    check (image_path is null or char_length(image_path) <= 1024),
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.care_recipient_insurance is
  'Insurance cards. The photo is an object in the private care-media bucket, reached only through a short-lived signed URL.';
comment on column public.care_recipient_insurance.image_path is
  'Path inside the care-media bucket, prefixed with the circle id. Never a public URL.';

create index care_recipient_insurance_recipient_idx
  on public.care_recipient_insurance (care_recipient_id);
create index care_recipient_insurance_circle_idx
  on public.care_recipient_insurance (circle_id);

create trigger care_recipient_insurance_set_updated_at
  before update on public.care_recipient_insurance
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- 6. Attribution is the database's, not the client's
-- ---------------------------------------------------------------------------

create function public.care_recipient_child_set_created_by()
returns trigger
language plpgsql
as $$
begin
  new.created_by := auth.uid();
  return new;
end;
$$;

create trigger care_recipient_contacts_set_created_by
  before insert on public.care_recipient_contacts
  for each row execute function public.care_recipient_child_set_created_by();

create trigger care_recipient_conditions_set_created_by
  before insert on public.care_recipient_conditions
  for each row execute function public.care_recipient_child_set_created_by();

create trigger care_recipient_insurance_set_created_by
  before insert on public.care_recipient_insurance
  for each row execute function public.care_recipient_child_set_created_by();

-- ---------------------------------------------------------------------------
-- 7. Row Level Security: enabled and forced, on every new table
-- ---------------------------------------------------------------------------
--
-- No plan limit trigger on any of these three. The free plan caps documents at
-- ten; doctors, allergies and insurance cards are not documents and are not
-- capped by the brief, so adding a cap here would be inventing a rule the
-- product never promised.

alter table public.care_recipient_contacts enable row level security;
alter table public.care_recipient_conditions enable row level security;
alter table public.care_recipient_insurance enable row level security;

alter table public.care_recipient_contacts force row level security;
alter table public.care_recipient_conditions force row level security;
alter table public.care_recipient_insurance force row level security;

-- One policy per table for the role that owns it — the same shape and the same
-- reason as Task 3: FORCE RLS applies to the table owner too, and the SECURITY
-- DEFINER triggers below run as the owner. It is not reachable from the API.
do $$
declare
  owner_role name;
  target_table text;
begin
  select r.rolname into owner_role
  from pg_class c
  join pg_roles r on r.oid = c.relowner
  where c.oid = 'public.care_recipient_contacts'::regclass;

  foreach target_table in array array[
    'care_recipient_contacts', 'care_recipient_conditions', 'care_recipient_insurance'
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

-- The care team reads. `visiting_helper` is deliberately absent: that is the
-- boundary the owner asked for, and it is enforced here rather than in a screen.
create policy care_recipient_contacts_select_care_team
  on public.care_recipient_contacts
  for select
  to authenticated
  using (
    public.has_circle_role(
      circle_id,
      array['owner', 'family_member', 'view_only']::public.circle_role[]
    )
  );

create policy care_recipient_conditions_select_care_team
  on public.care_recipient_conditions
  for select
  to authenticated
  using (
    public.has_circle_role(
      circle_id,
      array['owner', 'family_member', 'view_only']::public.circle_role[]
    )
  );

create policy care_recipient_insurance_select_care_team
  on public.care_recipient_insurance
  for select
  to authenticated
  using (
    public.has_circle_role(
      circle_id,
      array['owner', 'family_member', 'view_only']::public.circle_role[]
    )
  );

-- Owner and family member write; view-only and the helper do not.
create policy care_recipient_contacts_insert_care_team
  on public.care_recipient_contacts
  for insert
  to authenticated
  with check (public.can_write_care_data(circle_id) and public.circle_is_writable(circle_id));

create policy care_recipient_contacts_update_care_team
  on public.care_recipient_contacts
  for update
  to authenticated
  using (public.can_write_care_data(circle_id) and public.circle_is_writable(circle_id))
  with check (public.can_write_care_data(circle_id) and public.circle_is_writable(circle_id));

create policy care_recipient_contacts_delete_care_team
  on public.care_recipient_contacts
  for delete
  to authenticated
  using (public.can_write_care_data(circle_id) and public.circle_is_writable(circle_id));

create policy care_recipient_conditions_insert_care_team
  on public.care_recipient_conditions
  for insert
  to authenticated
  with check (public.can_write_care_data(circle_id) and public.circle_is_writable(circle_id));

create policy care_recipient_conditions_update_care_team
  on public.care_recipient_conditions
  for update
  to authenticated
  using (public.can_write_care_data(circle_id) and public.circle_is_writable(circle_id))
  with check (public.can_write_care_data(circle_id) and public.circle_is_writable(circle_id));

create policy care_recipient_conditions_delete_care_team
  on public.care_recipient_conditions
  for delete
  to authenticated
  using (public.can_write_care_data(circle_id) and public.circle_is_writable(circle_id));

create policy care_recipient_insurance_insert_care_team
  on public.care_recipient_insurance
  for insert
  to authenticated
  with check (public.can_write_care_data(circle_id) and public.circle_is_writable(circle_id));

create policy care_recipient_insurance_update_care_team
  on public.care_recipient_insurance
  for update
  to authenticated
  using (public.can_write_care_data(circle_id) and public.circle_is_writable(circle_id))
  with check (public.can_write_care_data(circle_id) and public.circle_is_writable(circle_id));

create policy care_recipient_insurance_delete_care_team
  on public.care_recipient_insurance
  for delete
  to authenticated
  using (public.can_write_care_data(circle_id) and public.circle_is_writable(circle_id));

-- ---------------------------------------------------------------------------
-- 8. Table privileges
-- ---------------------------------------------------------------------------

revoke all on table public.care_recipient_contacts from anon, authenticated;
revoke all on table public.care_recipient_conditions from anon, authenticated;
revoke all on table public.care_recipient_insurance from anon, authenticated;

grant select, insert, update, delete on table public.care_recipient_contacts to authenticated;
grant select, insert, update, delete on table public.care_recipient_conditions to authenticated;
grant select, insert, update, delete on table public.care_recipient_insurance to authenticated;

-- `care_recipients` is granted column by column so that `notes` is not in the
-- list. RLS decides which rows; this decides which columns, and it is the only
-- mechanism that can hold a helper to the name, photo and relationship they are
-- meant to see. A helper selecting the row still gets it — without the note.
revoke select on table public.care_recipients from authenticated;
grant select (
  id, circle_id, full_name, preferred_name, date_of_birth, relationship, phone,
  photo_url, created_by, created_at, updated_at
) on table public.care_recipients to authenticated;

-- ---------------------------------------------------------------------------
-- 9. The note, for the people allowed to read it
-- ---------------------------------------------------------------------------
--
-- SECURITY DEFINER because the caller has no SELECT privilege on the column.
-- Pinned search_path so a shadowed `care_recipients` cannot be substituted.
-- A visiting helper is refused rather than given null: an empty note and a
-- refused note are different answers, and the second is the true one.

create function public.care_recipient_notes(p_care_recipient_id uuid)
returns text
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  target_circle uuid;
  note text;
begin
  select r.circle_id, r.notes into target_circle, note
  from public.care_recipients r
  where r.id = p_care_recipient_id;

  if target_circle is null then
    return null;
  end if;

  if not public.has_circle_role(
    target_circle,
    array['owner', 'family_member', 'view_only']::public.circle_role[]
  ) then
    raise exception 'this note is not shared with your role' using errcode = '42501';
  end if;

  return note;
end;
$$;

comment on function public.care_recipient_notes(uuid) is
  'The free-text note on a person, for owner, family member and view-only. A visiting helper is refused.';

revoke all on function public.care_recipient_notes(uuid) from public, anon;
grant execute on function public.care_recipient_notes(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- 10. Audit: the basics
-- ---------------------------------------------------------------------------
--
-- Field names only. `{"fields": ["date_of_birth"]}` says a birthday changed and
-- never what it changed to — the trail is a record of activity, not a copy of the
-- family's answers. The `exists` guard is the account-deletion case Task 6
-- documented: profiles -> circles -> care_recipients cascades, and an audit row
-- pointing at a circle that is being deleted would either abort the deletion the
-- person asked for or vanish with it a moment later.

create function public.audit_care_recipient_change()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  target_circle uuid;
  target_row text;
  actor uuid := auth.uid();
  actor_role public.circle_role;
  changed jsonb;
begin
  if tg_op = 'DELETE' then
    target_circle := old.circle_id;
    target_row := old.id::text;
  else
    target_circle := new.circle_id;
    target_row := new.id::text;
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
    select coalesce(jsonb_agg(entry.key order by entry.key), '[]'::jsonb) into changed
    from jsonb_each(to_jsonb(new)) entry
    -- `is not null` would keep a JSON null, which `to_jsonb` produces for every
    -- empty column: a field the family left blank is not a field they filled in.
    where entry.value <> 'null'::jsonb
      and entry.key not in ('id', 'circle_id', 'created_by', 'created_at', 'updated_at');
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
  end if;

  insert into public.audit_log (
    circle_id, actor_id, actor_role, table_name, row_id, action, summary
  )
  values (
    target_circle, actor, actor_role, 'care_recipients', target_row,
    (case tg_op when 'INSERT' then 'create' when 'UPDATE' then 'update' else 'delete' end)::public.audit_action,
    jsonb_build_object('fields', coalesce(changed, '[]'::jsonb))
  );

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

comment on function public.audit_care_recipient_change() is
  'Appends an audit row when the person profile changes. Records field names, never the values.';

create trigger care_recipients_audit_insert
  after insert on public.care_recipients
  for each row execute function public.audit_care_recipient_change();

create trigger care_recipients_audit_update
  after update on public.care_recipients
  for each row execute function public.audit_care_recipient_change();

create trigger care_recipients_audit_delete
  before delete on public.care_recipients
  for each row execute function public.audit_care_recipient_change();

-- ---------------------------------------------------------------------------
-- 11. Audit: doctors, pharmacies, allergies, conditions, insurance cards
-- ---------------------------------------------------------------------------
--
-- One function for three tables, because the three behave the same way: a row
-- that belongs to a person, whose changes are interesting only as a list of
-- field names. The diff is computed from the row itself rather than a hand-kept
-- list of columns, so a column added later is audited without anyone remembering
-- to come back here.
--
-- `kind` is included when the row has one. It is an enum — "doctor", "allergy" —
-- and knowing that an allergy was added without knowing which allergy is exactly
-- the level of detail the audit trail is allowed.

create function public.audit_care_recipient_child_change()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  target_circle uuid;
  target_row text;
  actor uuid := auth.uid();
  actor_role public.circle_role;
  row_json jsonb;
  changed jsonb;
  summary jsonb;
begin
  if tg_op = 'DELETE' then
    target_circle := old.circle_id;
    target_row := old.id::text;
    row_json := to_jsonb(old);
  else
    target_circle := new.circle_id;
    target_row := new.id::text;
    row_json := to_jsonb(new);
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
    select coalesce(jsonb_agg(entry.key order by entry.key), '[]'::jsonb) into changed
    from jsonb_each(row_json) entry
    where entry.value <> 'null'::jsonb
      and entry.key not in (
        'id', 'circle_id', 'care_recipient_id', 'created_by', 'created_at', 'updated_at'
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

  summary := jsonb_build_object('fields', changed);

  if row_json ? 'kind' and (row_json ->> 'kind') is not null then
    summary := summary || jsonb_build_object('kind', row_json ->> 'kind');
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

comment on function public.audit_care_recipient_child_change() is
  'Appends an audit row for a contact, condition or insurance card change. Field names and the kind enum only.';

create trigger care_recipient_contacts_audit_insert
  after insert on public.care_recipient_contacts
  for each row execute function public.audit_care_recipient_child_change();

create trigger care_recipient_contacts_audit_update
  after update on public.care_recipient_contacts
  for each row execute function public.audit_care_recipient_child_change();

create trigger care_recipient_contacts_audit_delete
  before delete on public.care_recipient_contacts
  for each row execute function public.audit_care_recipient_child_change();

create trigger care_recipient_conditions_audit_insert
  after insert on public.care_recipient_conditions
  for each row execute function public.audit_care_recipient_child_change();

create trigger care_recipient_conditions_audit_update
  after update on public.care_recipient_conditions
  for each row execute function public.audit_care_recipient_child_change();

create trigger care_recipient_conditions_audit_delete
  before delete on public.care_recipient_conditions
  for each row execute function public.audit_care_recipient_child_change();

create trigger care_recipient_insurance_audit_insert
  after insert on public.care_recipient_insurance
  for each row execute function public.audit_care_recipient_child_change();

create trigger care_recipient_insurance_audit_update
  after update on public.care_recipient_insurance
  for each row execute function public.audit_care_recipient_child_change();

create trigger care_recipient_insurance_audit_delete
  before delete on public.care_recipient_insurance
  for each row execute function public.audit_care_recipient_child_change();

-- ---------------------------------------------------------------------------
-- 12. None of the trigger functions is callable by a client
-- ---------------------------------------------------------------------------

revoke all on function public.audit_care_recipient_change() from public, anon, authenticated;
revoke all on function public.audit_care_recipient_child_change() from public, anon, authenticated;
revoke all on function public.care_recipient_child_set_created_by() from public, anon, authenticated;

-- Make the new tables and columns visible to PostgREST immediately.
notify pgrst, 'reload schema';
