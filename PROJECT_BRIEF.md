# PROJECT_BRIEF — Tendshare

> Source of truth for what we are building. Derived from the owner's brief.
> Keep this file updated as decisions are made. Last updated: 2026-10-29.

## What we are building

**Tendshare** — the calm, shared home for a family caring for an aging parent or sick relative.

Meds, appointments with "who's covering", documents, costs split fairly between siblings, and updates, shared live across every family member's phone, tablet and computer.

**Users:** stressed adult children, often 40–65, not tech people.

**Privacy and security are product features, not a later pass.** Encryption in transit and at rest; private storage buckets reached only through signed URLs; an audit log of views and changes to sensitive records; an optional Face ID / passcode lock; data export and full account and data deletion; and no health details in lock-screen notifications by default. The **FTC Health Breach Notification Rule** applies to this app and we build to it from the first schema.

## How to work

1. First, create `PROJECT_BRIEF.md` at the repo root from this brief, and keep it updated.
2. Write a short plan, then ship **ONE pull request per phase** below, in order. Wait for review before starting the next phase.
3. Every feature ships with **loading, empty, error and offline** states. TypeScript strict, **no `any`**. **Row Level Security on every table.** Unit tests for business logic (cost split and balances, coverage, reminders). **Database migrations only.** Keep `CHANGELOG.md` updated.
4. **Every write asks for the row back.** The client writes with `.insert(...).select()`, which is `INSERT ... RETURNING`, and RLS checks the returned row against the table's **SELECT** policy as well as its INSERT policy. A policy that can only recognise the row through something a trigger writes in the same statement will refuse a legal insert — that reached a pull request once, fixed forward-only in `20261104120400_circles_select_owner.sql`. Prove writes with `pnpm test:rls` against the hosted project, not only `pnpm test:rls:local`.

## Hard rules

- **Tendshare organizes care; it never gives it.** No medical advice, dosing suggestions, interaction checks, diagnoses or health claims anywhere in the app, emails or store copy. Medication entries are exactly what the family types.
- **Health data never goes to ad or tracking SDKs.** Analytics events carry no medication, condition, document or note content. No selling or sharing data. (The FTC Health Breach Notification Rule applies to apps like this.)
- Encryption in transit and at rest, private storage buckets with signed URLs, optional Face ID / passcode lock, full account and data deletion, data export.
- **Sensitive changes are audited as they ship, never in a later pass.** Any task that touches medications, documents, costs, the care recipient's details or circle membership writes its `audit_log` rows in the same pull request. Append-only, never client-writable (security-definer function or trigger with a pinned `search_path`), recording who changed what and when. A task that ships a sensitive write without its audit row is not done.

## Platforms and stack

- iOS, Android and web from one codebase.
- Turborepo + pnpm monorepo.
- Expo + Expo Router (react-native-web for web).
- Supabase (Postgres, Auth, Storage, Realtime, Edge Functions).
- TanStack Query + Zustand.
- A shared design system package.
- RevenueCat for payments.
- Resend for email.
- PostHog (health fields stripped) and Sentry, both disabled when no key is set.
- Vitest and Maestro for tests.

## Product decisions from research (4 Nov 2026)

`docs/RESEARCH.md` holds the market and competitor research. These follow from it and bind every task unless the owner says otherwise:

1. **The four standouts are never cut and never feel like add-ons:** who's covering, sibling cost split with settle-up, the emergency sheet, and med check-offs. They lead in onboarding, the landing page and store screenshots.
2. **Fairness is kind, never scorekeeping.** No rankings, no "Mike did nothing this month."
3. **Polish and reliability beat feature count.** Families abandon care apps that glitch. Loading, empty, error and offline states are part of "done", not extras.
4. **The emergency sheet prints cleanly on Letter and A4 and works fully offline.** It has to be at least as good as Caregiver Binder: Kinwatch's.
5. **`SECURITY.md` lists every outside service the app talks to.** The FTC Health Breach Notification Rule applies: sharing health data with a third party without permission counts as a breach.
6. **No health claims** in App Store or Play Store copy, emails, onboarding or anywhere in the product. We organize care; we never give it.
7. **Product name, tagline and colours live in one brand config file**, not scattered through the code. The name has had no formal trademark review, so a rename must stay cheap.

## Brand

- **Name:** Tendshare.
- **Feel:** calm, warm, trustworthy, quietly premium — like One Medical or MyChart. Never clinical-cold or cutesy.
- **Colors:** deep navy and soft teal with warm off-white backgrounds. If this file already documents the theme, follow it exactly.
- Large readable type (body 17px+), generous spacing, big tap targets, gentle animations, dynamic type and WCAG AA.
- **Copy is short, kind and plain:** "Who can take Mom to cardiology Thursday?" — not "Unassigned event".

## Plans

**Free** — one family circle, 1 person cared for, up to 3 members, med list, calendar, updates feed, 10 documents.

**Family** — one payer covers the circle, monthly/yearly: unlimited members and documents, cost split and settle-up, fairness view, emergency sheet PDF, reminders. 14-day trial when a circle is created.

**Family Plus** — up to 3 people cared for, everything in Family.

- Invited members join free.
- When a plan ends **nothing is deleted**: extra features go read-only.
- **Gate features server-side.**
- Prices and limits are **config values**; start at Family $7.99/month or $69/year, Family Plus $12.99/month or $109/year.

## Phase 1 — Foundation

- Monorepo, app shell (tabs: Today, Calendar, Meds, Money, More), CI (typecheck, lint, tests on every PR), README with exact run steps.
- Design system with the brand tokens and core components, light and dark, and a hidden component gallery screen.
- Auth: Sign in with Apple, Google and email code. Onboarding (3 screens max): your name and photo; who you're caring for (name, photo, relationship); invite family now or later.
- Care circles and roles: owner, family member, view-only (e.g. a grandchild), and visiting helper (an aide who can check off meds and visits with a code, no account). Multiple circles with a switcher.

## Phase 2 — Core care

- **Person profile:** basics, doctors and pharmacies (tap to call or map), allergies and conditions as typed by the family, insurance cards (photos).
- **Med list:** name, strength, instructions as written, schedule, prescriber, pharmacy, refill date, photo of the bottle. Today view shows doses to check off, who confirmed each and when. Refill reminders. Change history ("Dr. Patel changed dose, logged by Sara, Oct 3").
- **Calendar and coverage:** appointments and visits with an owner; open slots highlighted with "I'll take it"; swap requests; notes from the visit with photos; sync to phone calendars.
- **Updates feed:** short posts and photos for the family, reactions, "after the appointment" notes, a weekly summary.
- **Document vault:** folders (Legal, Insurance, Medical records, Bills, Care plans, custom), any file type, camera scan to PDF, owner-only locked folders (e.g. power of attorney), expiry reminders.

## Phase 3 — Standouts

- **Cost split:** log expenses with receipt photo, category and who paid; split evenly, by agreed shares, or one person; running balances and a settle-up summary ("Mike owes Sara $142"); monthly PDF/CSV export. **Tendshare records; it never moves money.**
- **Fairness view:** this month's visits, rides, expenses and hours per member, gently presented, never shaming.
- **Emergency sheet:** one-tap PDF and offline view with meds, allergies, doctors, insurance and contacts; share link that expires.

## Phase 4 — Growth and money

- Invites by link, code or text with deep links.
- Push notifications and email (welcome, appointment reminders, uncovered appointment alerts, missed check-off nudge, weekly family digest), all with toggles and unsubscribe; **no health details on the lock screen by default**.
- Subscriptions and paywall exactly as in PLANS, with restore purchases and clear terms and privacy links. **Soft upgrade prompts, never blocked data.**

## Phase 5 — Launch

- Privacy and security pass (RLS tests per table, storage policies, audit log of who viewed or changed what), accessibility audit, performance (cold start under 2 s).
- Maestro end-to-end tests, demo seed data, privacy policy and terms, App Store and Play Store metadata, EAS builds, and a landing page with pricing and a waitlist.

---

## Build tasks (0–15)

**One task per pull request. Each task must be small enough to finish inside a single session. Every merge gets a phone-sized (390px) QA check before it is reported done.**

| #   | Task                                                                                                                                                        | PR      | State                                                                                                                                          |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- | ------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| 0   | `PROJECT_BRIEF.md` at the repo root, kept current                                                                                                           | —       | ✅ Done                                                                                                                                        |
| 1   | Monorepo (Turborepo + pnpm), app shell with 5 tabs, CI, README, CHANGELOG                                                                                   | Phase 1 | ✅ Done — PR #1                                                                                                                                |
| 2   | Design system package: brand tokens (light + dark), one brand config file (name, tagline, colours), core components, hidden component gallery               | Phase 1 | ✅ Done — PR #2                                                                                                                                |
| 3   | Supabase schema, migrations, Row Level Security policies + RLS tests per table                                                                              | Phase 1 | ✅ Done — PR #3. Six migrations applied to the hosted project; RLS suite green (68 hosted, 67 local)                                           |
| 4   | Auth: **email code + Google now**; Sign in with Apple deferred until the owner's Apple Developer account exists — **must ship before App Store submission** | Phase 1 | ✅ Done — PR #4. Email code proven against the hosted project; Google built, provider not yet enabled in Supabase; Apple stubbed               |
| 5   | Onboarding, 3 screens: your name and photo → who you're caring for → invite family                                                                          | Phase 1 | ✅ Done — PR #5. 3 screens with real writes, resumable draft and a circle guard; initials only, invites deferred to Task 11                    |
| 6   | Care circles, the four roles, and the circle switcher                                                                                                       | Phase 1 | ✅ Done — PR #6. Capability map, device-local switcher, members screen with role changes and removal; membership changes write the audit trail |
| 7   | Person profile: basics, doctors and pharmacies, allergies and conditions as typed, insurance cards                                                          | Phase 2 | ✅ Done — PR #7. Private `care-media` bucket with signed URLs, three new tables forced under RLS, audit rows in the same PR, and the visiting helper narrowed to photo + full name + relationship only |
| 8   | Med list, Today check-off with who confirmed and when, refill reminders, change history                                                                     | Phase 2 | 🟡 Schema, RLS, audit and capability map merged; the screens are the next PR — `medications`, `medication_times` and `med_checkoffs` forced under RLS, doses derived from the schedule, one check-off row per slot, a helper reads the list and may write only their own tick, and 28 hosted RLS tests prove it |
| 9   | Calendar and coverage: appointment owners, "I'll take it", swap requests, visit notes, phone calendar sync                                                  | Phase 2 | ⬜ Not started                                                                                                                                 |
| 10  | Updates feed: posts, photos, reactions, after-appointment notes, weekly summary                                                                             | Phase 2 | ⬜ Not started                                                                                                                                 |
| 11  | Document vault: folders, any file type, camera scan to PDF, owner-only locked folders, expiry reminders                                                     | Phase 2 | ⬜ Not started                                                                                                                                 |
| 12  | Cost split: expenses with receipts, three split modes, balances, settle-up, monthly PDF/CSV export                                                          | Phase 3 | ⬜ Not started                                                                                                                                 |
| 13  | Fairness view: visits, rides, expenses and hours per member, gently presented                                                                               | Phase 3 | ⬜ Not started                                                                                                                                 |
| 14  | Emergency sheet: fully offline view, one-tap PDF that prints cleanly on Letter and A4, expiring share link                                                  | Phase 3 | ⬜ Not started                                                                                                                                 |
| 15  | Invites by link/code/text with deep links; notifications and email with toggles; subscriptions and paywall                                                  | Phase 4 | ⬜ Not started                                                                                                                                 |

### Decisions log

- **2026-11-05** — **One capability map** (`apps/app/src/circles/roles.ts`) is the only
  place that decides what a role may do. Screens ask it, never `role === 'owner'`, so the
  UI cannot offer an action RLS rejects. Plain-language names live there too.
- **2026-11-05** — **The active circle is remembered per device**, in the keychain on
  device and `localStorage` on web, keyed by profile id. Not a global setting: the phone
  in the kitchen and the laptop in the office are different people's views. If the
  remembered circle is gone (removed, deleted) the app falls back to the first circle
  rather than to no circle. **One circle shows no switcher.**
- **2026-11-05** — **View only does not see costs.** It sees the care records and changes
  nothing; the family's money is for the people paying it. Visiting helper sees no
  documents and no money, and may check off meds and visits — Task 8's med-check-off
  policy must grant that narrow write.
- **2026-11-05** — **Audit rows are written by triggers**, in the same transaction as the
  change, with the actor from the session. A rename records `{"fields": ["name"]}`, never
  the name: the payload stays ids, enums and field names. No screen reads the trail yet
  (that is the Phase 5 privacy pass); the data is already there.
- **2026-11-05** — **The owner cannot be demoted**, and the free plan's 3-member cap is
  enforced by a trigger reading `plan_limits`. Both refuse a write; neither removes
  anything already there.

**Launch (Phase 5) follows task 15:** privacy and security pass (RLS and storage policy tests, audit log), accessibility audit, performance budget (cold start under 2 s), Maestro end-to-end tests, demo seed data, privacy policy and terms, App Store and Play Store metadata, EAS builds, and the landing page with pricing and a waitlist.

### Decisions log

- **2026-10-29** — Product renamed from the earlier "Kinwell" prototype to **Tendshare**. The existing navy/teal design tokens, component library and onboarding patterns carry over into the shared design system package.
- **2026-10-29** — Web is served by this platform as the live surface; iOS/Android store builds run on the owner's EAS account.
- **2026-10-29** — Work is broken into numbered tasks 0–15, one pull request each, sized to one session. Every merge is QA-checked at 390px before it is reported done.
- **2026-11-04** — Brand background is the warm **`#F7F3EC`** (owner's call). **System font on iOS/Android; Inter on web** — no bundled font on device.
- **2026-11-04** — Product name, tagline and colours live in `packages/ui/src/brand.ts`. Tagline: "Care for someone you love, shared with your family."
- **2026-11-04** — PRs merge only on **green CI plus a completed 390px phone QA**. No merge on local checks alone from Task 2 onward.
- **2026-11-05** — Onboarding writes `profiles.display_name`, then `circles`, then `care_recipients`, in that order, and **undoes the circle** if the person cannot be added: a circle with nobody in it spends the free plan's one person and shows Today nothing. If the undo fails, the circle id is kept in the draft and the next attempt adopts it.
- **2026-11-05** — The onboarding draft is stored in the keychain (device) / `localStorage` (web) as it is typed. It holds three answers and never health data, and it is deleted when the circle is created or "Start over" is pressed.
- **2026-11-05** — Screen 1 shows **initials only**; photo upload belongs with the person profile once the storage bucket and signed-URL rules exist. Screen 3 **does not send invitations** — invites are Task 11, behind `features.invitesEnabled`, and the screen says nothing has been sent.
- **2026-11-05** — (owner) **Every task that touches meds, documents or costs writes to the audit log as it ships, not later.** Task 6 starts the pattern with membership and role changes; Tasks 7–11 extend it. Design polish items are batched for a later design pass rather than blocking a task.
- **2026-11-06** — **The name, domain and support address are settled:** Tendshare, on
  **tendshare.app**, with **support@tendshare.app** reaching the owner (mail to it is
  forwarded through the domain's MX records). The owner's trademark search came back
  clean, so store listings, screenshots and printed material may carry the name. The
  support address lives only in `packages/ui/src/brand.ts`.
- **2026-11-06** — **The profile's note is not granted to any client role.** Row Level
  Security works on rows, and `care_recipients` has to stay readable to a visiting helper
  for the name and photo. A free-text note is where a family types something
  health-related, so `notes` is reachable only through `care_recipient_notes()`, which
  refuses a helper. Everything else on the row is granted column by column. The three new
  profile tables (`contacts`, `conditions`, `insurance`) have no policy for
  `visiting_helper` at all, and `canSeeCareDetails` in the capability map says the same
  thing on screen.
- **2026-11-06** — (owner) **A visiting helper may tick off a dose and nothing else.**
  No med edits, no history changes, no costs and no documents. Task 8 encodes this as
  one narrow write path in the RLS policy plus the capability map, and proves it with a
  hosted RLS test: a helper's tick succeeds and writes an audit row, and every other
  write is refused.
- **2026-11-06** — (owner) **App icon chosen: option B, "two people, one heart"** — teal on
  navy, the designer's pick. It is the app icon, the splash screen and the favicon; the
  splash keeps the mark on navy with the name beneath it. The three candidates were shown
  at true home-screen size (60pt on a 390pt screen) before the decision. Store-listing
  artwork and the printed material derive from this one mark.
- **2026-11-06** — **A visiting helper sees the med list, and that is not a contradiction.**
  Task 7 narrowed a helper to the person's photo, full name and relationship. Task 8 adds
  that a helper also sees the med list, because a helper cannot tick a dose they cannot
  see — and the owner's directive is precisely that they may tick. The line to hold is
  therefore: *"the person's name, photo and relationship, plus the med list they are asked
  to check off — and nothing else."* They still get no care details (phone, date of birth,
  preferred name, notes), no doctors, allergies, conditions or insurance, no documents, no
  money, no roster, no audit log and no photo of a medicine bottle.
- **2026-11-06** — **A tick is a fact, not a claim.** The check-off row's `taken_by` is set
  by a database trigger from the session, never from the request body, so a helper cannot
  attribute a dose to someone else. A mistaken tick is corrected by deleting it and
  ticking again — there is no update path for a helper — so both facts (the delete and the
  new tick) reach the audit trail rather than one silently rewriting the other.
- **2026-11-06** — **Dose instances are derived, not stored.** The schedule holds the
  clock times the family typed; the only row a dose ever creates is its check-off, keyed
  by med, date and time. Nothing has to run at midnight to create tomorrow's rows (there
  is no scheduler, and a client may be offline), so a dose can never render as
  "not scheduled" when it is really "not taken" — the worst failure this product has.
  There is no quantity or dose-amount column anywhere, and there must not be one.

- **2026-11-06 — owner settled what happens when a plan lapses.** A circle whose paid
  plan ends drops to Free. **Every free feature keeps working, including med
  check-offs.** Only the paid extras (cost split and settle-up, the fairness view,
  the emergency sheet PDF) go **read-only** — still readable, never writable again
  until the plan returns. If the circle is over a free limit (members, documents),
  **nothing is removed**; they simply cannot add more. This settles the open
  question left on Task 8: ticking a dose is a free feature, so a lapsed circle
  keeps checking off doses, and the check-off must never be gated on plan state.

- **2026-11-07 — owner rule: migrations go through the Supabase CLI, nothing else.**
  Every schema change is applied with `npx --yes supabase@latest db push --db-url
  "$SUPABASE_DB_URL"` so Supabase's own migration history is the record of what ran.
  No hand-written Postgres client, no pasted SQL, no manual inserts into
  `supabase_migrations.schema_migrations`. `/home/team/shared/tools/pg.py` exists only
  because this box has no psql/psycopg2/pg, and it is restricted to **read-only** checks.
