# SECURITY — outside services and data handling

> Required by `docs/RESEARCH.md` item 5. The **FTC Health Breach Notification Rule** applies to Tendshare: sharing health data with a third party without the family's permission counts as a breach. Every service the app talks to must be listed here, with what it receives.

**Status:** living document, started 4 Nov 2026. It is incomplete until each integration lands — every task that adds an outside service must add its row **in the same pull request**.

## Rules that apply to every service below

- **No health content leaves for analytics or crash reporting.** Analytics events carry no medication names, conditions, documents, notes, photos or free text. Health fields are stripped at the source, not in a dashboard filter.
- **No selling or sharing health data.** Ever, with anyone, for any consideration.
- **Health data goes only to the services strictly needed to run the feature**, over TLS, at rest under that provider's encryption.
- **Storage buckets are private**; files are reached only through short-lived signed URLs.
- **No health details in lock-screen notifications by default.** Notifications say what to look at, never what it says.
- Every new service is a decision the owner sees before it ships.

## Services

| Service                    | What it is used for                                        | What it receives                                                                                                                                                                                                                                                | Health data?                                                                                                                 |
| -------------------------- | ---------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| **Supabase**               | Postgres database, Auth, Storage, Realtime, Edge Functions | Account identifiers, and all family-entered care data: people cared for, medications as typed, appointments, documents, expenses, notes. Since Task 3: an append-only audit log of who viewed or changed a sensitive record, with a minimal non-health payload. | **Yes** — the primary store. Row Level Security enabled **and forced** on every table; private buckets; signed URLs only.    |
| **Apple / Google sign-in** | Authentication                                             | Identity token, email address, name                                                                                                                                                                                                                             | No                                                                                                                           |
| **RevenueCat**             | Subscription state and purchase validation                 | App user id, product and entitlement state, store transaction data                                                                                                                                                                                              | No — never circle names, care data or anything typed by a family                                                             |
| **Resend**                 | Transactional email (welcome, reminders, digests)          | Email address, and the minimum content needed to be useful                                                                                                                                                                                                      | **To be decided per email type.** Default: no medication names or conditions in email bodies; send a prompt to open the app. |
| **PostHog**                | Product analytics                                          | Anonymous events — screens opened, buttons pressed. **No health fields.**                                                                                                                                                                                       | No                                                                                                                           |
| **Sentry**                 | Crash and error reporting                                  | Stack traces and device info, with health fields scrubbed before send                                                                                                                                                                                           | No                                                                                                                           |
| **Expo / EAS**             | Build pipeline and push notification delivery              | Push tokens and notification payloads                                                                                                                                                                                                                           | **Lock-screen payloads must contain no health details by default.**                                                          |

## Not yet reviewed

Any service not in the table above. Do not add one without a row here and the owner's decision.

## Open items

- Confirm Resend's per-email data policy before the first reminder email ships (Task 15).
- Confirm Expo push payload contents before notifications ship (Task 15).
- ~~Add the audit log of views and changes to sensitive records, and confirm where it is stored.~~ **Done (Task 3).** The audit log is `public.audit_log` in the same Supabase Postgres — no third party, so nothing new to review. It is append-only: Row Level Security is enabled and forced, no client role holds UPDATE or DELETE, and a trigger refuses every UPDATE and TRUNCATE except the foreign key that clears the actor when an account is deleted. It stores a minimal non-health payload (ids, counts, field names) capped at 512 bytes, never free text or health content.
- Data export and full account/data deletion must cover Supabase Storage as well as Postgres — verify with a real deletion test before Phase 5.
