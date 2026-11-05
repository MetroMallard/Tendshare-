# Tendshare

The calm, shared home for a family caring for an aging parent or a sick relative.
One place for the family's own medication list, appointments and who is covering
them, documents, shared costs and updates — on every family member's phone, tablet
and computer.

**Tendshare organizes care; it never gives it.** There is no medical advice, no
dosing suggestions, no interaction checks and no diagnoses anywhere in this codebase.

> **Status: Phase 1, slice 1 — app shell only.** The five tabs render, the theme
> follows the system light/dark setting, and CI runs typecheck, lint and tests.
> Auth, onboarding, care circles, Supabase and every feature are still to come.

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
- **Design tokens.** Until `@tendshare/ui` lands, the app reads colours, spacing,
  radii and type sizes from `apps/app/src/theme/tokens.ts`, which carries a
  `TODO(design-system)` marker. The design-system slice replaces it.
- **Copy.** Short, kind, plain. Nothing in this app gives medical advice.
- **No analytics or tracking SDKs.** Health data never reaches one.
- **Migrations only** for the database: `supabase/migrations/`, applied with
  `pnpm db:migrate`. Never edit the hosted schema by hand.
