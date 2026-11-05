# Changelog

All notable changes to Tendshare are recorded here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and the project follows
[Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

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
