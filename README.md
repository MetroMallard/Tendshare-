# Tendshare

The calm, shared home for a family caring for an aging parent or a sick relative.
One place for the family's own medication list, appointments and who is covering
them, documents, shared costs and updates — on every family member's phone, tablet
and computer.

**Tendshare organizes care; it never gives it.** There is no medical advice, no
dosing suggestions, no interaction checks and no diagnoses anywhere in this codebase.

> **Status: Phase 1, slice 2 — app shell and authentication.** The five tabs
> render, the theme follows the system light/dark setting, and CI runs typecheck,
> lint and tests. Sign-in by emailed one-time code works against the hosted
> Supabase project, and Google is wired but switched off on the project. Care
> circles, onboarding and every feature screen are still to come.

## What is here

```
tendshare/
├── apps/
│   └── app/            Expo + Expo Router app (iOS, Android, web)
│       ├── app/        routes — (tabs)/ holds the five tabs, +not-found.tsx
│       └── src/        non-route code: theme, navigation, components
├── packages/
│   ├── config/         shared tsconfig, ESLint flat config, Prettier
│   ├── types/          reserved — no implementation yet (see its README)
│   └── ui/             reserved — design system comes next (see its README)
├── .github/workflows/  CI: typecheck, lint, test
├── turbo.json          Turborepo task graph
└── vitest.config.ts    tests run from the root over every workspace
```

## Prerequisites

| Tool           | Version                       | Notes                                             |
| -------------- | ----------------------------- | ------------------------------------------------- |
| Node.js        | 22 LTS or newer (`>=22`)      | `node --version`                                  |
| pnpm           | 12.16.1                       | `corepack enable` picks this up from package.json |
| Xcode          | Latest, with an iOS simulator | macOS only, for `pnpm ios`                        |
| Android Studio | Latest, with an emulator      | For `pnpm android`                                |

The repo pins pnpm through the `packageManager` field, so with Corepack enabled
(`corepack enable`) the right pnpm version is used automatically:

```bash
corepack enable
node --version    # v22.x or newer
pnpm --version    # 12.16.1
```

## Install

From the repository root:

```bash
pnpm install
```

That installs every workspace (`apps/*`, `packages/*`) in one pass.

## Run the app

**Web** (the surface the team reviews first):

```bash
pnpm dev:web
```

Open the URL the dev server prints (usually <http://localhost:8081>). The five
tabs — Today, Calendar, Meds, Money, More — render and switch.

**iOS simulator** (macOS with Xcode installed):

```bash
pnpm ios
```

**Android emulator** (Android Studio with an AVD running):

```bash
pnpm android
```

**Any runtime, dev server only** — press `w`, `i` or `a` in the terminal to pick a
platform:

```bash
pnpm dev
```

## Environment variables

The app reads exactly two values, both from `apps/app/src/lib/env.ts`. Expo
inlines `EXPO_PUBLIC_*` variables **at build time**, so they must be set in the
shell that starts the dev server — exporting them in another terminal does
nothing.

| Variable                        | What it is                                       |
| ------------------------------- | ------------------------------------------------ |
| `EXPO_PUBLIC_SUPABASE_URL`      | the project URL, e.g. `https://xxxx.supabase.co` |
| `EXPO_PUBLIC_SUPABASE_ANON_KEY` | the project's **anon** (public) key              |

```bash
export EXPO_PUBLIC_SUPABASE_URL='https://xxxx.supabase.co'
export EXPO_PUBLIC_SUPABASE_ANON_KEY='eyJhbGciOi...'   # anon / publishable key
pnpm dev:web
```

The anon key is the only key that may ever ship in the app. The service-role key
must never appear in `apps/`, in an `EXPO_PUBLIC_*` variable, or in the web
bundle: it bypasses Row Level Security.

With neither variable set the app still starts and shows a clear "not configured
yet" sign-in screen instead of a broken form — that is the `notConfigured`
session state, and it is what CI and a fresh clone see.

The test suites read different names, because they run on Node rather than in the
app bundle:

| Variable                    | Used by                                |
| --------------------------- | -------------------------------------- |
| `SUPABASE_URL`              | `pnpm test:rls`, `pnpm test:auth:live` |
| `SUPABASE_ANON_KEY`         | both                                   |
| `SUPABASE_SERVICE_ROLE_KEY` | both — setup and teardown only         |

```bash
export SUPABASE_URL='https://xxxx.supabase.co'
export SUPABASE_ANON_KEY='eyJhbGciOi...'          # anon / publishable
export SUPABASE_SERVICE_ROLE_KEY='eyJhbGciOi...'  # service role, never in the app
```

### `/auth-preview` — every auth state, on purpose

Auth is a set of states that are hard to reach by hand: the offline notice, the
resend cooldown, a wrong code, the "not configured" screen. `/auth-preview` draws
every one of them, one at a time, and is the fastest way to review the sign-in
work.

1. Start the dev server: `pnpm dev:web`.
2. Open `/auth-preview` — for example <http://localhost:8081/auth-preview>.
3. Pick a state from the buttons on the left, and **Light** or **Dark** above
   them. The preview draws the real screen inside a 390px-wide frame and pins the
   scheme inside that frame, so what you see is what a phone shows.

`/auth-preview` and `/gallery` are hidden routes: they hold no care data, they
are not linked from the app, and the route guard lets them through in any session
state so QA and the owner can always reach them. They are not the shell — a
signed-out visitor still cannot see a tab.

## Check the work

Run these from the repository root. They are the same three commands CI runs.

```bash
pnpm typecheck   # tsc --noEmit across the root and every workspace
pnpm lint        # ESLint (flat config) across the monorepo
pnpm test        # Vitest, run once
```

Useful extras:

```bash
pnpm test:watch    # Vitest in watch mode
pnpm format        # Prettier, write
pnpm format:check  # Prettier, check only
```

## Database

The schema lives in `supabase/migrations/` as timestamped, forward-only SQL. A
migration that has been applied is never edited; add a new file instead. The
first four files are the identity and authorisation core — `profiles`,
`circles`, `circle_members`, `care_recipients` and the append-only `audit_log` —
and they are the pattern every later feature table copies.

**Apply them.** Either with the script (needs a Postgres connection string, which
is a different secret from the API keys — Supabase dashboard → Project settings →
Database → Connection string → _Session pooler_, with the database password in
it):

```bash
SUPABASE_DB_URL='postgresql://...' pnpm db:migrate
```

or by pasting the files into the Supabase SQL editor in filename order. The
script records what it has run in `supabase_migrations.schema_migrations`, so
running it twice is safe.

### Row Level Security tests

`pnpm test` never touches a database: CI has no secrets. The RLS suite is its own
command.

```bash
# Against the hosted project. Needs SUPABASE_URL, SUPABASE_ANON_KEY and
# SUPABASE_SERVICE_ROLE_KEY, and the migrations applied.
pnpm test:rls
```

Every assertion runs as a real signed-in user — the anon key plus a JWT from
`signInWithPassword`. The service role is used only to create and delete auth
users in setup and teardown, because it bypasses RLS and would prove nothing.
The suite creates its own data (everything is prefixed `rls-test-`), deletes it
again, and skips cleanly when the credentials are absent, so it is safe to leave
out of CI.

There is also a local pre-flight that needs no hosted project, only a Postgres
you can reach with CREATEDB:

```bash
RLS_LOCAL_ADMIN_URL='postgres://postgres:postgres@127.0.0.1:5432/postgres' \
  pnpm test:rls:local
```

It builds a scratch database, applies the Supabase stub (auth schema, `auth.uid()`,
the API roles) and every migration, runs `supabase/tests/local/rls.test.sql`, and
drops the database afterwards.

### Live auth test

The RLS suite proves the database. This one proves the **sign-in flow**, against
the hosted project, with the same clients the app builds:

```bash
# Needs SUPABASE_URL, SUPABASE_ANON_KEY and SUPABASE_SERVICE_ROLE_KEY.
pnpm test:auth:live
```

It creates one throwaway user, asks the Auth server to mint a real one-time code
(`generateLink`), verifies that code through an anon-key client (`verifyOtp`), and
asserts that:

- a session comes back, and it is stored where the app reads it;
- the `profiles` row exists for that user — written by the `handle_new_user()`
  trigger, because the test never inserts one and RLS grants no INSERT on
  `profiles`;
- the minted code is accepted by the app's own input rules in
  `apps/app/src/auth/code.ts` without being truncated;
- `refreshSession()` works, so a session survives a restart days later;
- `signOut()` leaves no session and no access to the row it could read a moment
  before.

It deletes the user afterwards and skips cleanly when the credentials are absent.

**What it does not prove: that the code email is delivered.** Nothing reads a
mailbox. Delivery depends on a real SMTP sender being configured on the project,
so until that exists the flow is proven up to the point the mail leaves the
server, and no further.

## Known platform caveats

- **iOS and Android store builds cannot be produced on this machine.** `pnpm ios`
  and `pnpm android` run the app against a local simulator/emulator through the
  Expo dev server. Building an `.ipa` or `.aab` for the App Store or Play Store
  needs EAS (`eas build`) under **the owner's own Expo/EAS account** and the
  corresponding Apple Developer and Google Play credentials.
- The app is a custom Expo app (no Expo Go dependency), so native code changes
  require `npx expo prebuild` and a native build toolchain.
- `apps/app/ios` and `apps/app/android` are generated by `expo prebuild` and are
  git-ignored; do not edit them by hand.

## Conventions

- **TypeScript strict, no `any`.** `@typescript-eslint/no-explicit-any` is an
  error, as are unused locals and unchecked index access. No `@ts-ignore` or
  `@ts-expect-error` to dodge a real type problem.
- **One config, one place.** TypeScript, ESLint and Prettier settings live in
  `packages/config`; every workspace extends them.
- **Design tokens.** Colours, spacing, radii and type sizes live in
  `packages/ui/src/tokens`, behind `useTheme()`. A screen never hard-codes one.
- **Copy.** Short, kind, plain. Nothing in this app gives medical advice.
- **No analytics or tracking SDKs.** Health data never reaches one.
- **Migrations only** for the database: `supabase/migrations/`, applied with
  `pnpm db:migrate`. Never edit the hosted schema by hand.
