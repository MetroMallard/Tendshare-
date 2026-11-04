# RESEARCH — market, competitors and product decisions

> Researched 4 November 2026. Supplied by the owner.
> Use this when making product decisions that the numbered tasks do not explicitly cover.
> It sits alongside `PROJECT_BRIEF.md` (the build contract) and `SECURITY.md` (every outside service we talk to).

## Market

AARP (October 2026): **63 million US family caregivers**, spending about **$11,500 a year out of pocket** — roughly **31% of household income**. Money and fairness between siblings is a real pain point, not just scheduling.

## Competitors and our edge

| Product | What it does | Price | Where we win |
| --- | --- | --- | --- |
| **Caring Village** (closest) | Calendar, tasks, meds, documents, chat | $14.99–24.99/month | **No sibling cost split.** We are cheaper at $7.99 and we lead with fairness. |
| **Caregiver Binder: Kinwatch** | Meds, documents, printable care summary and emergency sheet | $9.99/month, iPhone/iCloud only | We are cross-platform (Android and web too). Our emergency sheet has to be **at least as good as theirs**. |
| **Kin: Family Care Coordinator** | Med check-offs, visiting-caregiver check-in codes | Free | They have **no documents and no money features**. |
| **CaringBridge**, **Lotsa Helping Hands** | Updates and volunteer sign-ups only | Free | Lotsa's reviews complain about glitches — **reliability is a selling point for us**. |

## What this means for the build

1. **Our four standouts are who's covering, sibling cost split with settle-up, the emergency sheet, and med check-offs.** Never cut them or make them feel like add-ons. They lead in onboarding, the landing page and store screenshots.
2. **Fairness features must feel kind, never like scorekeeping.** No rankings, no "Mike did nothing this month."
3. **Polish and reliability beat feature count.** Families give up on care apps that glitch.
4. **The emergency sheet must print cleanly on Letter and A4 and work fully offline.**
5. **Privacy:** the FTC Health Breach Notification Rule covers apps like ours. Sharing health data with any third party without permission counts as a breach. **List every outside service the app talks to in `SECURITY.md`.**
6. **App Store and Play Store copy, emails and onboarding make no health claims.** We organize care; we never give it.

## Naming

Keep the product name, tagline and colours in **one brand config file**, not scattered through the code. The name has not had a formal trademark review yet, so a rename should be cheap if it is ever needed.

## Tone for all copy

Warm, plain and reassuring, never fear-based. "Who can take Mom to cardiology Thursday?" — not "Unassigned event."
