---
name: secondbrain-data-auth
description: Change or review SecondBrain Supabase tables, RLS, Auth, account data, private API routes, or subscription ownership in the secondbrain workspace. Use for data and identity work; use secondbrain-app for UI-only changes.
---

# SecondBrain data and identity

Read [references/data-model.md](references/data-model.md) before changing schema, queries, auth, or private routes. Treat `secondbrain/supabase-schema.sql` as the historical bootstrap before the versioned migration chain and verify the live project before making claims about deployed SQL; capture schema changes in a new reviewed, versioned SQL file under `secondbrain/supabase/`.

Supabase Auth user UUIDs are the owner keys. Preserve `auth.users` foreign keys, one diary entry per `(user_id, date)`, one person per owner plus normalized name, and owner-scoped RLS. A client-supplied `userId`, `entryId`, or `person` is never sufficient proof of ownership.

`getDatabaseClient()` uses the service-role key on the server and bypasses RLS. Routes using it must authenticate the bearer token with `getRequestUser` or `getAuthenticatedUser`, derive or compare the owner, and check ownership of nested resources before reading or mutating. On the client, use the anon key and `authenticatedFetch` for private routes. Never put the service-role key in `NEXT_PUBLIC_*` or browser code.

The client may read/create limited profile fields but must not grant itself paid status. Reconcile subscription changes against the Stripe flow and server-side rules. Check both RLS and column grants when changing profile writes. For UI composition load `secondbrain-app`; for Stripe or deployment configuration load `secondbrain-operations`.

Verify changes with a representative authenticated owner and a different authenticated user, plus an unauthenticated request where applicable. Check that one user cannot read or modify the other's diary, people, transcriptions, mood, profile, or subscription. Run `npm run build` for application code, and update the data-model reference when current schema or ownership rules change.
