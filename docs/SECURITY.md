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

## Storage and photos (Task 7)

**Supabase Storage** is part of the Supabase row above — the same project, the same
contract, no new third party. What it now holds:

- **One private bucket, `care-media`** (`public = false`, 10 MB image limit, JPEG / PNG /
  WebP / HEIC only). It holds the photo of the person being cared for and photos of
  insurance cards. **No public objects, ever.**
- **Reads go through signed URLs with a five-minute expiry**
  (`SIGNED_URL_TTL_SECONDS`). Creating a signature is itself an RLS-checked request, so a
  visiting helper, a member of another circle and a signed-out visitor are refused a URL
  rather than handed a short-lived one.
- **Object paths start with the circle id**, and every `storage.objects` policy asks
  `has_circle_role()` about that first folder. There is no policy for `anon`.
- **No analytics or error SDK ever receives a photo.** PostHog and Sentry are not called
  anywhere in the upload path; nothing about an image — not its path, not its size, not
  the fact that one exists — is put in an event or an error message. A failed upload
  becomes one of four fixed sentences in `src/profile/profileActions.ts`.
- **Deleting a card deletes its object** (best effort): Storage is not cascaded by SQL, so
  the app removes the object after the row. Full account deletion must remove the
  circle's folder — added to the open items below.

## Not yet reviewed

Any service not in the table above. Do not add one without a row here and the owner's decision.

## Open items

- Confirm Resend's per-email data policy before the first reminder email ships (Task 15).
- Confirm Expo push payload contents before notifications ship (Task 15).
- ~~Add the audit log of views and changes to sensitive records, and confirm where it is stored.~~ **Done (Task 3).** The audit log is `public.audit_log` in the same Supabase Postgres — no third party, so nothing new to review. It is append-only: Row Level Security is enabled and forced, no client role holds UPDATE or DELETE, and a trigger refuses every UPDATE and TRUNCATE except the foreign key that clears the actor when an account is deleted. It stores a minimal non-health payload (ids, counts, field names) capped at 512 bytes, never free text or health content.
- Data export and full account/data deletion must cover Supabase Storage as well as Postgres — verify with a real deletion test before Phase 5.
- **Task 7:** confirm that deleting a circle or an account removes its `care-media` objects. Today only an insurance card's photo is removed when the card is deleted.

## Auth data flow (Task 4)

**What Supabase Auth stores.** `auth.users` (email address, a bcrypt/scrypt hash of nothing —
there is no password — the user id, created/last-sign-in timestamps, provider identities), the
one-time code and its short expiry, and refresh tokens. All inside the Supabase project.

**What we store.** In the app: the session (access token, refresh token, expiry) in
`expo-secure-store` on iOS/Android with `WHEN_UNLOCKED_THIS_DEVICE_ONLY`, and in `localStorage` on
the web, which has no keychain. In Postgres: one `public.profiles` row per auth user, created by the
on-signup trigger — display name and optional avatar path, nothing else. The address a code was sent
to is held in memory only, never persisted, and cleared on sign-out and on relaunch.

**What never leaves.**

- The **service role key** is never in the app, never in a `.env` file in this repo, never in a
  bundle. `readSupabaseConfig` refuses any key whose JWT role is not `anon`, so a paste mistake fails
  loudly instead of shipping a policy bypass.
- **No analytics or crash SDK is involved in auth.** Nothing here calls PostHog or Sentry, and no
  error message, email address or token is written to a log. Failures become one of nine fixed
  sentences in `src/auth/errors.ts`; the raw GoTrue message is dropped because it can echo the
  address that was typed.
- The UI never reveals whether an email is registered: a wrong code and an expired code get identical
  copy, and "send a code" always reports success.
- **OAuth (Google).** The browser/native auth sheet talks to Google and to `…/auth/v1/callback` on the
  Supabase project; the app only ever sees a PKCE code and then a session. The provider's identity
  token never reaches app code. Availability is read from the public `GET /auth/v1/settings` with the
  anon key; if Google is not enabled the screen says so and offers email instead — no dead button.
- **Sign out** clears the device first, then revokes every refresh token for the account (global
  scope), so a session left open on a lost phone dies too.

**Untested / owner action.** Google is not enabled in the Supabase project yet, so the flow is built
but unverified against a live provider. Enabling it needs a Google Cloud OAuth client plus the
Supabase dashboard (Authentication → Providers → Google), with `…/auth/v1/callback` as the redirect
and the app's origins/scheme on the allow list. Apple sign-in is deliberately not built (no Apple
Developer account); its entry exists in `AUTH_PROVIDERS` with `built: false`.
