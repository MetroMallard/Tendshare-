-- 20261104120400_circles_select_owner.sql
--
-- Tendshare — identity and authorisation, part 5: a circle's owner can always
-- read their own circle.
--
-- Forward-only. Never edit after it has been applied; add a new migration.
--
-- ## The defect this fixes
--
-- Creating the first circle failed with
-- `new row violates row-level security policy for table "circles"` (42501) —
-- but only when the insert asked for the row back:
--
--   insert into public.circles (name, owner_id) values (...);            -- 201
--   insert into public.circles (name, owner_id) values (...) returning *; -- 42501
--
-- `.insert({...}).select().single()` is exactly the second statement, and it is
-- the idiomatic Supabase client call — the one the app makes when it creates a
-- circle and needs the id, and the one the RLS fixture makes. So this was not a
-- test-only problem: it was the app's very first write.
--
-- Why the two differ:
--
--   * INSERT ... RETURNING has to satisfy the table's SELECT policy for each
--     returned row, in addition to the INSERT policy for the new row;
--   * `circles_select_care_team` answered "may you see this circle?" with
--     `has_circle_role(id, ...)`, which reads `circle_members`;
--   * the owner's membership row is written by the AFTER INSERT trigger
--     `circles_create_owner_membership` — during the same statement, after the
--     snapshot the policy is evaluated against was taken. At RETURNING time the
--     policy therefore cannot see the membership, and the row it has just
--     legally created is invisible to it.
--
-- The insert was never wrong. Only the read-back was refused.
--
-- ## The fix
--
-- Stop making an owner's view of their own circle depend on a row a trigger
-- creates afterwards. `owner_id` is on the row itself, so `owner_id =
-- auth.uid()` is already true at RETURNING time.
--
-- Least privilege is unchanged. This grants nothing new: a circle's owner could
-- already read their circle as soon as the trigger had run (a moment later, in
-- the next statement), and every other role is checked exactly as before —
-- family_member and view_only still read through their membership,
-- visiting_helper still cannot read a circle at all, and a non-member still
-- sees nothing.
--
-- ## The same reasoning, checked against the other tables
--
-- The class of bug is: a client `insert().select()` whose SELECT policy depends
-- on a row a trigger creates in the same statement. Audited across the schema;
-- `circles` was the only instance.
--
--   * `circle_members` — safe. Its SELECT policy is
--     `profile_id = auth.uid() or has_circle_role(circle_id, ...)`. Nothing
--     triggers a membership row into existence except the circle trigger, and
--     the INSERT policy requires the caller to be the circle's owner already,
--     so the membership the policy reads was committed by an earlier statement.
--   * `care_recipients` — safe. Its SELECT policy reads `has_circle_role`,
--     i.e. a membership row that must already exist for the insert to be
--     allowed at all. `care_recipients_set_created_by` fills `created_by` in a
--     BEFORE trigger, but no policy depends on that column.
--   * `profiles` — safe, and not by policy: there is no INSERT policy and no
--     INSERT privilege for any client role. Profiles are created only by the
--     `on_auth_user_created` trigger, and the client reads its own row with a
--     separate statement (`id = auth.uid()` is on the row itself).
--
-- `supabase/tests/local/rls.test.sql` now performs every fixture insert with
-- RETURNING, so the local harness can no longer pass while the hosted project
-- refuses the statement shape the app actually uses.

-- Replaces `circles_select_care_team`. The name changes because the rule does:
-- ownership now answers the question without consulting the membership table.
drop policy circles_select_care_team on public.circles;

create policy circles_select_owner_or_care_team
  on public.circles
  for select
  to authenticated
  using (
    owner_id = auth.uid()
    or public.has_circle_role(
      id,
      array['owner', 'family_member', 'view_only']::public.circle_role[]
    )
  );

comment on policy circles_select_owner_or_care_team on public.circles is
  'The care team reads the circle. The owner reads their own circle from owner_id alone, so INSERT ... RETURNING (i.e. .insert().select()) works before the owner-membership trigger row is visible to the policy.';
