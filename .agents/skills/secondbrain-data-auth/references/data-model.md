# Data model and request path

## Tables

| Table                  | Key relationships                         | Core fields and rules                                                                                                                                         |
| ---------------------- | ----------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `profiles`             | `uid` → `auth.users.id`                   | Identity and first-use fields. `subscription` JSONB is a legacy billing projection, not the source of current usage. The client cannot update paid fields.    |
| `diary_entries`        | `user_id` → `auth.users.id`               | Unique `(user_id, date)`; text, mentioned people, mood values, timestamps. Date is a date-only value.                                                         |
| `people`               | `user_id` → `auth.users.id`               | Unique `(user_id, name)`; relationship, category, description, mention count, and `details` JSONB. Detail categories contain dated `{ value, date }` entries. |
| `audio_transcriptions` | `entry_id` → `diary_entries.id`           | Transcription and audio URL; ownership follows the parent entry.                                                                                              |
| `mood_data`            | `user_id` → `auth.users.id`               | Unique `(user_id, date)`; levels and analysis summary.                                                                                                        |
| `subscriptions`        | `user_id` → `profiles.uid`                | One typed subscription per owner; unique Stripe IDs; status, period and cancellation.                                                                         |
| `subscription_plans`   | Plan ID                                   | Server-managed monthly chat and report limits.                                                                                                                |
| `usage_counters`       | `(user_id, month, feature)`               | Confirmed and reserved usage; UTC month starts on day 1; nonnegative constraints.                                                                             |
| `usage_reservations`   | Counter FK                                | One reservation per paid operation; idempotent completion/release, 20-minute expiry.                                                                          |
| `billing_events`       | Unique provider event ID → profile        | Atomic deduplication and stale-event protection.                                                                                                              |
| `statistics_reports`   | One row → profile                         | Cached analysis output, generated at the server; JSON suits the variable report result.                                                                       |
| `billing_email_outbox` | Event ID → billing event; owner → profile | Delivery jobs, leases, attempts and status.                                                                                                                   |
| `feedback_requests`    | Request fingerprint → profile             | Server-enforced mail rate limit.                                                                                                                              |

RLS scopes rows to `auth.uid()` or, for transcriptions, the entry owner. Inspect actual policies and grants before editing; a successful UI check does not prove tenant isolation. Deleting an Auth user cascades through the owner tables and dependent transcriptions.

## Code ownership

- `src/lib/supabase.ts`: browser anon client and server service-role client.
- `src/lib/supabase-operations.ts`: types and CRUD for diary, people, transcriptions, mood, and Auth helpers.
- `src/lib/subscription-operations.ts`: profile mapping, typed subscription writes, quota reservations and authoritative monthly usage RPCs. Profiles read the `subscriptions` relationship, not the legacy JSON as billing authority.
- `src/contexts/SupabaseAuthContext.tsx`: session-to-app-user/profile synchronization; `src/hooks/useAuth.ts` exposes it.
- `src/lib/api-auth.ts`: bearer-token authentication for route handlers; `src/lib/authenticated-fetch.ts` adds the access token from the current session.
- `src/lib/subscription-policy.ts`: portable, pure plan types/defaults. `subscription-snapshot.ts` returns the server catalogue, effective plan, usage and UTC reset time. `src/middleware/subscription.ts`: compatibility plan checks; despite its directory name, this is application policy, not Next.js request middleware.
- `src/app/api/account`, `subscription`, `statistics`, `stripe`, chat, transcription, and AI routes contain server behavior. Trace the requested route, helper, and client caller together.

## Auth behavior

Email/password, Google OAuth, email verification, password reset, and account deletion use Supabase Auth. The reset helper sends an explicit `redirectTo` based on the current origin. A Google-linked account may have `email` as its primary provider while `app_metadata.providers` includes `google`; use that provider array when deciding whether Google is available.

For a new private route: authenticate first; validate payload shape and size; derive or check the owner from the verified token; fetch only owner-scoped resources; enforce plan/usage on the server when it has a cost; return no personal data in logs or error details. Webhooks instead verify the provider signature using the raw body.

## Ownership and regression checks

Account deletion calls `POST /api/account` with the current bearer token; the server derives the account ID. AI extraction with an entry ID calls `getEntryByIdForUser` before model or database writes, and requires the entry date to match. Verify Stripe session ownership before returning payment status and never include another session in an error response. Background expiry must check write errors before counting a profile as expired. Run the API/data suites and local PostgreSQL security tests described in [docs/TESTING.md](../../../../docs/TESTING.md); simulated browser responses do not establish RLS.

## Quota and billing invariants

Authenticate cost-bearing routes before `reserve_usage`. Never accept a browser counter as authority or update a whole JSON document for usage. Reserve before calling a provider, then confirm once on success or release on failure. Transactions must finish before external calls. `read_monthly_usage` reclaims expired holds. The effective paid plan requires active status and an unexpired period; plan changes preserve the same month's consumption.

`complete_statistics_report` persists the report and its charge atomically. Graph queries are free after server-side paid-plan authorization; only complete report regeneration consumes statistics quota. Summary/quote GET routes read cache only. Use actual diary mentions for rankings, and explicit read errors instead of fabricated empty statistics.

Stripe webhook signature verification precedes `apply_billing_event`. Event identity, provider timestamp, subscription mutation and mail enqueue belong to one transaction; re-read current provider state for late events. Browser checkout verification must not grant access. Preserve customer references when a paid period ends. Restrict quota and provider RPC execution to `service_role`; give the browser only owner-scoped SELECT. Trigger functions use fixed empty search paths and have no direct public execute privilege.

The executable local schema and concurrency/security checks are in `tests/database/`; release and integration contracts are documented in [docs/SUBSCRIPTIONS.md](../../../../docs/SUBSCRIPTIONS.md).
