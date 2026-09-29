# Data model and request path

## Tables

| Table | Key relationships | Core fields and rules |
| --- | --- | --- |
| `profiles` | `uid` → `auth.users.id` | Email, display name, Google flag, first-use fields, and `subscription` JSONB. The client cannot update the subscription column. |
| `diary_entries` | `user_id` → `auth.users.id` | Unique `(user_id, date)`; text, mentioned people, mood values, timestamps. Date is a date-only value. |
| `people` | `user_id` → `auth.users.id` | Unique `(user_id, name)`; relationship, category, description, mention count, and `details` JSONB. Detail categories contain dated `{ value, date }` entries. |
| `audio_transcriptions` | `entry_id` → `diary_entries.id` | Transcription and audio URL; ownership follows the parent entry. |
| `mood_data` | `user_id` → `auth.users.id` | Unique `(user_id, date)`; levels and analysis summary. |

RLS scopes rows to `auth.uid()` or, for transcriptions, the entry owner. Inspect actual policies and grants before editing; a successful UI check does not prove tenant isolation. Deleting an Auth user cascades through the owner tables and dependent transcriptions.

## Code ownership

- `src/lib/supabase.ts`: browser anon client and server service-role client.
- `src/lib/supabase-operations.ts`: types and CRUD for diary, people, transcriptions, mood, and Auth helpers.
- `src/lib/subscription-operations.ts`: profile/subscription mapping and monthly usage in `subscription` JSONB.
- `src/contexts/SupabaseAuthContext.tsx`: session-to-app-user/profile synchronization; `src/hooks/useAuth.ts` exposes it.
- `src/lib/api-auth.ts`: bearer-token authentication for route handlers; `src/lib/authenticated-fetch.ts` adds the access token from the current session.
- `src/middleware/subscription.ts`: free/pro/elite limits and effective-plan checks; despite its directory name, this is application policy, not Next.js request middleware.
- `src/app/api/account`, `subscription`, `statistics`, `stripe`, chat, transcription, and AI routes contain server behavior. Trace the requested route, helper, and client caller together.

## Auth behavior

Email/password, Google OAuth, email verification, password reset, and account deletion use Supabase Auth. The reset helper sends an explicit `redirectTo` based on the current origin. A Google-linked account may have `email` as its primary provider while `app_metadata.providers` includes `google`; use that provider array when deciding whether Google is available.

For a new private route: authenticate first; validate payload shape and size; derive or check the owner from the verified token; fetch only owner-scoped resources; enforce plan/usage on the server when it has a cost; return no personal data in logs or error details. Webhooks instead verify the provider signature using the raw body.

## Ownership and regression checks

Account deletion calls `POST /api/account` with the current bearer token; the server derives the account ID. AI extraction with an entry ID calls `getEntryByIdForUser` before model or database writes, and requires the entry date to match. Verify Stripe session ownership before returning payment status and never include another session in an error response. Background expiry must check write errors before counting a profile as expired. Run the API/data suites and local PostgreSQL security tests described in [docs/TESTING.md](../../../../docs/TESTING.md); simulated browser responses do not establish RLS.
