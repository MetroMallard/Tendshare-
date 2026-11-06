# Changelog

All notable changes to Tendshare are recorded here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and the project follows
[Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- **Task 7 — the person profile (in review, PR open).**
  - **Schema, forward-only** (`20261106120000_care_recipient_profile.sql`):
    `care_recipients` gains `preferred_name`, `phone` and `notes` (it already had
    `date_of_birth` and `photo_url`), plus three new tables — `care_recipient_contacts`
    (doctors, pharmacies and other, one table for both lists), `care_recipient_conditions`
    (allergies and conditions exactly as the family typed them: no picklist, no severity,
    no advice) and `care_recipient_insurance` (plan, member ID, group number, card photo
    path). RLS enabled **and forced** on all three, policies built on the existing
    `has_circle_role()` helpers, no recursion, and **no plan-limit trigger**: nothing in
    the brief caps doctors, allergies or cards.
  - **The visiting helper's boundary, in the database.** `canSeeCareDetails` is a new
    capability — true for owner, family member and view-only, false for `visiting_helper`.
    The three new tables have no policy for that role, and `care_recipients.notes` is not
    granted to any client role at all: it is reachable only through
    `care_recipient_notes()`, which refuses a helper. Rows stay readable for name, photo
    and relationship; the note does not.
  - **Audit as it ships.** `SECURITY DEFINER` triggers with pinned `search_path` and
    revoked execute append an `audit_log` row in the same transaction as every write to
    the profile, its contacts, conditions and insurance cards. Payloads are ids, enums and
    **field names** only — `{"fields":["preferred_name","date_of_birth"]}`, never a value,
    so an allergy never lands in the log.
  - **Private storage** (`20261106120100_care_media_bucket.sql`): the `care-media` bucket,
    `public = false`, 10 MB image limit, object paths prefixed with the circle id, and
    `storage.objects` policies scoped to circle membership through `has_circle_role()`.
    No policy for `anon`; signed URLs live five minutes. `Avatar` now accepts a signed
    `uri` and falls back to initials.
  - **App modules** (pure and tested): profile loaders with a column-by-column read of
    `care_recipients`; form validation for basics, contacts, conditions and cards; the
    edit diff that decides what a save actually sends and which field names the audit row
    will carry; the audit vocabulary with a guard that refuses a value in a summary; and
    the signed-URL/path helper (`buildPath`, `isCareMediaPath`, `isSignedUrlStale`).
  - **`ProfileView`**: the five sections in order (basics → doctors → pharmacies →
    allergies and conditions → insurance cards), built only from `@tendshare/ui`, with
    loading skeletons, per-section empty states that say what the section is for, one
    error with a retry, an offline notice, a read-only notice for view-only, and the
    helper's narrower screen. The allergies section repeats onboarding's "This isn't
    medical information" notice.
  - **Hosted RLS suite** (`tests/rls/care-profile.rls.test.ts`, 20 tests): a family member
    adds a doctor and the audit row records field names without the name or the number;
    an allergy is audited as `{"kind":"allergy","fields":["kind","label"]}`; view-only is
    refused every write; a visiting helper reads no contacts, conditions or cards, cannot
    read the note by column or by function, and writes nothing; another circle reads
    nothing; and the bucket refuses a signed URL to a helper, a stranger and a signed-out
    visitor while serving the care team.
  - **Not yet in this pull request:** the `/profile` route and its editing sheets, the
    entry points from `/members` and Today, photo and card upload in the app, and the
    390px screenshots. The schema, RLS, audit trail and tests are complete; the screen is
    built and typed but not yet wired to navigation.
- **Task 6 — care circles, the four roles and the circle switcher.**
  - **One capability map** (`src/circles/roles.ts`) is the only place that decides what
    a role may do: `owner`, `family_member`, `view_only`, `visiting_helper` → fifteen
    capabilities (`canCheckOffMeds`, `canEditMeds`, `canInvite`, `canManageMembers`,
    `canSeeCosts`, `canEditCareRecipient`, …), fully table-tested, used by every screen
    so the UI never offers an action RLS will reject. Plain-language names only on
    screen: **Owner**, **Family member**, **View only**, **Visiting helper**.
  - **Circle switcher.** A person can be in several circles; the active one is in the
    header of every tab, switching is one tap on one row, and the choice is remembered
    per device in the keychain (`localStorage` on web) — never a global setting. With a
    single circle there is no switcher at all, just the name.
  - **Members screen** (`/members`, from More): the person being cared for at the top,
    then everyone in the circle with avatar, name, role and what that role can do, plus
    a plain-language explanation of all four roles. Owner only: change a role, remove a
    member behind a `ConfirmSheet` that says what actually happens, and rename the
    circle (soft limit 40 characters). Everyone else sees it read-only, said out loud
    rather than as greyed-out controls. No invite button — the screen says invitations
    are not built yet, in the same words as onboarding.
  - **Loading, empty, error and offline** on both the switcher and the members screen,
    plus the free plan's member cap in plain language when it is reached.
  - Hidden `/circles-preview` renders every members and switcher state at 390px in both
    schemes, built from the real components.

### Fixed

- **The role description on a member's row was cut off mid-sentence.** "Runs the circle.
  Can change anything, …" — the one sentence that tells a family member what someone is
  allowed to do, clipped because `ListRow`'s subtitle shared its width with the role badge
  and clamped at two lines. `ListRow` gains a documented `subtitleBelow` prop: the name and
  the badge keep the first line, the description gets the full width underneath and wraps
  to as many lines as it needs. Used on the roster rows and shown in the hidden gallery.
  `ListRow` also takes `accessibilityLabel`, so a row that shows a badge can say the role
  as well as the description out loud (`memberRowSpokenLabel` in `roles.ts`). The header
  eyebrow is now one line, truncated — a long circle name can no longer wrap and push a
  screen down.
- **Nothing wrote to `audit_log` on its own.** The plan promises an audit trail of
  changes to sensitive records, and until now every row was one a client chose to write
  by calling `log_audit_event()`. Migration `20261105120000_circles_membership_audit.sql`
  adds triggers that append the row in the same transaction as the change: a join, a
  role change, a removal and a circle rename are now recorded with the actor taken from
  the session, never from the request. The payload is ids, enums and field names — never
  free text a family typed.
- **The owner could demote themselves**, leaving a circle with an `owner_id` and no owner
  membership row: every `has_circle_role(… 'owner')` check would then answer no and
  nobody could run the circle again. A trigger refuses it.
- **`plan_limits.max_members` was never read**, so a free circle could hold any number of
  members. A trigger now refuses a new member past the cap, and never removes anyone
  already in the circle.
- **`pnpm db:migrate` re-ran migration 1 on any project whose migrations had been applied
  by hand** (the Supabase SQL editor records the timestamp alone). It now matches on the
  timestamp prefix, which is what the CLI records.

### Added

- **Task 5 — onboarding, three screens.** A signed-in person with no family circle is
  taken through `You` (their display name, prefilled from the identity provider or the
  email local part), `Who you're caring for` (first name and a five-word relationship
  picker) and `Invite family` (addresses, or a prominent honest skip), then lands on
  Today.
  - **Real writes, in order, under RLS:** `profiles.display_name` (an UPDATE — the
    signup trigger owns the row), then `circles` with the caller as owner, then
    `care_recipients`. Every write asks for the row back.
  - **Rollback-sane.** If the person cannot be added to a circle that was just created,
    the circle is deleted again, so a retry makes one circle rather than two. If the
    undo itself fails, the circle id is kept in the draft and the retry adopts it.
  - **Resumable.** The draft (three answers, never health data) is written to the
    keychain on device and `localStorage` on web as it is typed, with the step it was
    on, and there is a "Start over".
  - **Guarded** by `resolveOnboardingRedirect`, a pure function with a table of tests: a
    person who has a circle never sees onboarding again, and a person with none is never
    dropped into an empty app.
  - **Plan limits** are surfaced as plain language ("Your plan covers one person"), never
    a raw Postgres message.
  - **Invites are not built** (Task 11). Screen 3 says plainly that nothing has been
    sent, keeps the addresses on the device behind `features.invitesEnabled`, and makes
    "Invite them later" the primary action when no address has been added.
  - New design-system pieces: `OptionList` (a vertical radio group for choices that do
    not fit a segmented control) and a `keyboardAware` frame on `Screen`.
  - Hidden `/onboarding-preview` renders every state of the three screens at 390px in
    both schemes, built from the real view components.

### Fixed

- **Creating a circle with `.insert(...).select()` was refused by RLS.** That call —
  `INSERT ... RETURNING` — is what the app makes on its very first write, because it
  needs the new circle's id, and it has to satisfy the table's **SELECT** policy for
  the row it returns. `circles_select_care_team` only recognised the owner through
  their `circle_members` row, which the `circles_create_owner_membership` AFTER
  INSERT trigger writes during that same statement — after the snapshot the policy
  is evaluated against. So at RETURNING time the membership was invisible, and a
  legal insert came back as `42501 new row violates row-level security policy for
table "circles"`. Fixed forward-only in
  `20261104120400_circles_select_owner.sql`: the SELECT policy now reads
  `owner_id = auth.uid()` from the row itself, which is knowable before the trigger
  runs. Nothing was widened — family members and view-only members are checked
  through their membership exactly as before, a visiting helper still cannot read a
  circle, and a non-member still sees nothing. The same class of bug was audited on
  `circle_members`, `care_recipients` and `profiles`; `circles` was the only table
  where it could happen, and the reasoning is recorded in the migration.
- **The local RLS harness could not have caught it, and now can.**
  `pnpm test:rls:local` seeded its fixtures with plain `INSERT`s, so a write that
  only fails when it asks for the row back passed locally and failed against the
  hosted project — which is how the bug above reached a pull request. Every fixture
  write now goes through `tests.expect_write`, which performs it as
  `INSERT ... RETURNING` with `returning *`, the shape supabase-js produces; a
  `returning 1` list is called out in the file as the blind spot it is, because
  Postgres does not apply the SELECT policy to a RETURNING list that names no column
  of the table. Removing the fix makes the local suite fail.
- **A hosted regression test for circle creation**, `tests/rls/circle-create.rls.test.ts`:
  the owner creates a circle with `.insert().select().single()`, reads the owner
  membership the trigger made, and a signed-out client is still refused.

### Added

- **The database.** Four forward-only migrations in `supabase/migrations/` create the
  identity and authorisation core: `profiles` (one row per auth user, created by a
  signup trigger), `circles`, `circle_members` (owner / family member / view-only /
  visiting helper, with the columns a helper code will need), `care_recipients`, and
  an append-only `audit_log`. `plan_limits` holds the plan limits and prices as
  config, so no number is hardcoded in SQL or in a policy. Row Level Security is
  enabled and forced on every table; membership questions go through `security
definer` helpers with a pinned `search_path`, which is what keeps the
  `circles`/`circle_members` policies from recursing. The plan limit is enforced by
  a trigger that reads the config table.
- **An RLS test suite that bites.** `pnpm test:rls` runs against the hosted project
  as real signed-in users (anon key plus real JWTs; the service role only creates
  and deletes users in setup and teardown) and skips cleanly without credentials,
  so CI stays secret-free. `pnpm test:rls:local` proves the same 67 boundaries
  against a scratch Postgres with no hosted project at all.
- **`pnpm db:migrate`**, which applies the migrations once each and records what it
  has run.

- **The monorepo.** A Turborepo + pnpm workspace with one app (`apps/app`) and one
  shared configuration package (`packages/config`). `packages/ui` and
  `packages/types` are reserved folders with a README each and no code, so the
  design system and the shared domain types have an obvious home.
- **The app shell.** An Expo + Expo Router app that runs on iOS, Android and the web
  through react-native-web, with the five tabs the product needs — **Today,
  Calendar, Meds, Money, More** — in that order. Each tab shows a clearly marked
  placeholder card; no feature logic has been written yet.
- **A tab bar built for this audience.** Lucide icons (one consistent set), labels
  always visible under the icons, a soft pill marking the active tab so selection
  does not rely on colour alone, 48pt minimum tap targets, and a bar that stays
  aligned with the content column on a wide browser window.
- **A responsive shell.** Phone, tablet and desktop browser layouts from one
  component: 20pt gutters on a phone, a centred 720pt content column above tablet
  width, and safe-area insets respected on every screen.
- **Light and dark mode that follows the system setting**, with a small local token
  file as a stand-in until the design system package lands. Body text is 17px and
  every text/background pairing meets WCAG AA (there is a test that asserts it).
- **An error boundary** in the root layout: if a screen throws, the family sees calm
  copy and a retry button instead of a stack trace.
- **Shared configuration.** One strict tsconfig, one ESLint flat config (with
  `no-explicit-any` as an error) and one Prettier config, extended by every
  workspace.
- **Tests.** Vitest runs from the repository root. The smoke tests assert the tab
  contract (exactly five tabs, in order, each with a real screen file and a spoken
  label) and the design token contract (every colour defined, every text pairing at
  WCAG AA, body text 17px or larger, tap targets 48pt or larger).
- **CI.** GitHub Actions installs with pnpm (with caching) and runs typecheck, lint
  and test on every pull request and every push to `main`.
- **Documentation.** A README with exact run steps, prerequisites and the iOS/Android
  caveat, plus `PROJECT_BRIEF.md` as the build contract.

### Notes

- Nothing in this release touches health data: there is no Supabase, no auth, no
  network call and no analytics or tracking SDK yet.
- iOS and Android store builds need the owner's own EAS account and cannot be
  produced on this machine.

## Task 4 — Authentication: email code and Google (merged, PR #4)

- Email one-time code sign-in (Supabase OTP) with resend cooldown, a 6–8 digit code field and friendly
  copy for wrong/expired code, rate limits and no connection. Never reveals whether an address is
  known. The hosted project mints 8-digit codes; the live auth test guards the range so a 6-only field
  can never truncate a real code again.
- "Continue with Google" behind a live provider flag read from `GET /auth/v1/settings`; when the
  provider is off the screen says so and points at email. Web uses the OAuth redirect, native uses
  `expo-auth-session` + a PKCE deep-link return. Apple is one list entry away (`built: false`).
- `SessionProvider` / `useSession`: restore on launch, refresh on expiry and on foreground, secure
  storage (`expo-secure-store`, never AsyncStorage), global sign-out, and a pure route guard
  (`resolveAuthRedirect`) so signed-out people cannot reach the shell and signed-in ones never sit on
  the sign-in form.
- Sign out from the More tab behind a confirmation, clearing the device before the network call.
- Hidden `/auth-preview` route with every state at 390px in light and dark.
- `docs/SECURITY.md` gained the auth data-flow section.
