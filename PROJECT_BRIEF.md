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

## Hard rules

- **Tendshare organizes care; it never gives it.** No medical advice, dosing suggestions, interaction checks, diagnoses or health claims anywhere in the app, emails or store copy. Medication entries are exactly what the family types.
- **Health data never goes to ad or tracking SDKs.** Analytics events carry no medication, condition, document or note content. No selling or sharing data. (The FTC Health Breach Notification Rule applies to apps like this.)
- Encryption in transit and at rest, private storage buckets with signed URLs, optional Face ID / passcode lock, full account and data deletion, data export.

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

| #   | Task                                                                                                                                                        | PR      | State           |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- | ------- | --------------- |
| 0   | `PROJECT_BRIEF.md` at the repo root, kept current                                                                                                           | —       | ✅ Done         |
| 1   | Monorepo (Turborepo + pnpm), app shell with 5 tabs, CI, README, CHANGELOG                                                                                   | Phase 1 | ✅ Done — PR #1 |
| 2   | Design system package: brand tokens (light + dark), one brand config file (name, tagline, colours), core components, hidden component gallery               | Phase 1 | ✅ Done — PR #2 |
| 3   | Supabase schema, migrations, Row Level Security policies + RLS tests per table                                                                              | Phase 1 | 🚧 In progress  |
| 4   | Auth: **email code + Google now**; Sign in with Apple deferred until the owner's Apple Developer account exists — **must ship before App Store submission** | Phase 1 | ⬜ Not started  |
| 5   | Onboarding, 3 screens: your name and photo → who you're caring for → invite family                                                                          | Phase 1 | ⬜ Not started  |
| 6   | Care circles, the four roles, and the circle switcher                                                                                                       | Phase 1 | ⬜ Not started  |
| 7   | Person profile: basics, doctors and pharmacies, allergies and conditions as typed, insurance cards                                                          | Phase 2 | ⬜ Not started  |
| 8   | Med list, Today check-off with who confirmed and when, refill reminders, change history                                                                     | Phase 2 | ⬜ Not started  |
| 9   | Calendar and coverage: appointment owners, "I'll take it", swap requests, visit notes, phone calendar sync                                                  | Phase 2 | ⬜ Not started  |
| 10  | Updates feed: posts, photos, reactions, after-appointment notes, weekly summary                                                                             | Phase 2 | ⬜ Not started  |
| 11  | Document vault: folders, any file type, camera scan to PDF, owner-only locked folders, expiry reminders                                                     | Phase 2 | ⬜ Not started  |
| 12  | Cost split: expenses with receipts, three split modes, balances, settle-up, monthly PDF/CSV export                                                          | Phase 3 | ⬜ Not started  |
| 13  | Fairness view: visits, rides, expenses and hours per member, gently presented                                                                               | Phase 3 | ⬜ Not started  |
| 14  | Emergency sheet: fully offline view, one-tap PDF that prints cleanly on Letter and A4, expiring share link                                                  | Phase 3 | ⬜ Not started  |
| 15  | Invites by link/code/text with deep links; notifications and email with toggles; subscriptions and paywall                                                  | Phase 4 | ⬜ Not started  |

**Launch (Phase 5) follows task 15:** privacy and security pass (RLS and storage policy tests, audit log), accessibility audit, performance budget (cold start under 2 s), Maestro end-to-end tests, demo seed data, privacy policy and terms, App Store and Play Store metadata, EAS builds, and the landing page with pricing and a waitlist.

### Decisions log

- **2026-10-29** — Product renamed from the earlier "Kinwell" prototype to **Tendshare**. The existing navy/teal design tokens, component library and onboarding patterns carry over into the shared design system package.
- **2026-10-29** — Web is served by this platform as the live surface; iOS/Android store builds run on the owner's EAS account.
- **2026-10-29** — Work is broken into numbered tasks 0–15, one pull request each, sized to one session. Every merge is QA-checked at 390px before it is reported done.
- **2026-11-04** — Brand background is the warm **`#F7F3EC`** (owner's call). **System font on iOS/Android; Inter on web** — no bundled font on device.
- **2026-11-04** — Product name, tagline and colours live in `packages/ui/src/brand.ts`. Tagline: "Care for someone you love, shared with your family."
- **2026-11-04** — PRs merge only on **green CI plus a completed 390px phone QA**. No merge on local checks alone from Task 2 onward.
