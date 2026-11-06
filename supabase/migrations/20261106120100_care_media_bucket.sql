-- 20261106120100_care_media_bucket.sql
--
-- Tendshare — the private bucket Task 5 deferred, Task 7 ships: photos of the
-- person being cared for and photos of their insurance cards.
--
-- Forward-only. Never edit after it has been applied; add a new migration.
--
-- ## Why a bucket and not just a column
--
-- Task 5 shipped initials only, because there was nowhere safe to put a photo.
-- `profiles.avatar_url` and `care_recipients.photo_url` have existed since Task 3
-- with the comment "storage object path or signed URL. Never a public URL: the
-- bucket is private" — this is that bucket.
--
-- ## The rules, and how each one is enforced
--
--   * **Private.** `public = false`. Supabase Storage serves an object without a
--     token only from a public bucket, and this one has no public path at all.
--   * **No anonymous read.** There is no policy on `storage.objects` for `anon`.
--     With RLS enabled and no policy, the answer is no, and that is the whole
--     mechanism — not a client that remembers to ask for a signature.
--   * **Signed URLs with a short expiry.** The app asks Storage to sign a path
--     for five minutes (`SIGNED_URL_TTL_SECONDS` in
--     `apps/app/src/profile/storage.ts`). Creating that signature is itself an
--     RLS-checked request: a visiting helper cannot sign a path they cannot read,
--     so the expiry is the second line of defence rather than the first.
--   * **One circle cannot reach another's files.** Every object path starts with
--     the circle id, and every policy asks `has_circle_role()` about that first
--     folder. A path that does not start with a circle id resolves to `null` and
--     matches nothing, so a hand-written path cannot climb out.
--
-- ## What is stored where
--
--   {circle_id}/{care_recipient_id}/photo-{epoch}.{ext}
--   {circle_id}/{care_recipient_id}/insurance-{row_id}-{epoch}.{ext}
--
-- The circle id is first on purpose: it is the only part of the path a policy can
-- check without joining to a row, which keeps the policy simple enough to read.

-- ---------------------------------------------------------------------------
-- 1. The bucket
-- ---------------------------------------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'care-media',
  'care-media',
  false,
  10485760,
  array['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif']
)
on conflict (id) do update
  set public = false,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- ---------------------------------------------------------------------------
-- 2. Reading a circle id out of an object path, safely
-- ---------------------------------------------------------------------------
--
-- Casting the first folder to uuid inside a policy would raise on any path that
-- is not one — an error in a policy is a failed request, not a "no". This
-- returns `null` for anything that is not a uuid, and `has_circle_role(null, …)`
-- answers no, which is the answer we want.
--
-- IMMUTABLE and STABLE-free on purpose: it touches nothing but its argument, so
-- it can be used in an index or a policy without surprises.

create function public.storage_circle_id(object_name text)
returns uuid
language sql
immutable
as $$
  select case
    when object_name ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}(/|$)'
      then split_part(object_name, '/', 1)::uuid
    else null
  end;
$$;

comment on function public.storage_circle_id(text) is
  'The circle id at the front of a care-media object path, or null when the path does not start with one.';

revoke all on function public.storage_circle_id(text) from public, anon;
grant execute on function public.storage_circle_id(text) to authenticated;

-- ---------------------------------------------------------------------------
-- 3. Policies on storage.objects, scoped to the circle in the path
-- ---------------------------------------------------------------------------
--
-- The same three roles that may read the care records may read the photos that
-- belong to them; the same two that may write may upload. A visiting helper is
-- in neither list — their view of the person is the name, photo and relationship
-- on the profile screen, which is read from the database row, not from here.

create policy care_media_select_care_team
  on storage.objects
  for select
  to authenticated
  using (
    bucket_id = 'care-media'
    and public.has_circle_role(
      public.storage_circle_id(name),
      array['owner', 'family_member', 'view_only']::public.circle_role[]
    )
  );

create policy care_media_insert_care_team
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'care-media'
    and public.can_write_care_data(public.storage_circle_id(name))
    and public.circle_is_writable(public.storage_circle_id(name))
  );

create policy care_media_update_care_team
  on storage.objects
  for update
  to authenticated
  using (
    bucket_id = 'care-media'
    and public.can_write_care_data(public.storage_circle_id(name))
    and public.circle_is_writable(public.storage_circle_id(name))
  )
  with check (
    bucket_id = 'care-media'
    and public.can_write_care_data(public.storage_circle_id(name))
    and public.circle_is_writable(public.storage_circle_id(name))
  );

create policy care_media_delete_care_team
  on storage.objects
  for delete
  to authenticated
  using (
    bucket_id = 'care-media'
    and public.can_write_care_data(public.storage_circle_id(name))
    and public.circle_is_writable(public.storage_circle_id(name))
  );

-- No policy for `anon`, and none for a role that is not in a circle: signed out
-- and signed in-but-unrelated both read nothing.
