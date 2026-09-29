# Integrations and configuration

| Variable or platform setting | Code consumer | Exposure |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` | `src/lib/supabase.ts` browser client | Public by design; RLS remains mandatory. |
| `SUPABASE_SERVICE_ROLE_KEY` | `getDatabaseClient()` and protected server routes | Server secret; bypasses RLS. |
| `OPENAI_API_KEY` | AI chat, person extraction, transcription, stylization, summaries and quote routes | Server secret. Verify authorization, limits, and usage cost. |
| `RESEND_API_KEY` | Feedback API; SMTP credential for Supabase Auth when configured | Server secret. Sender domain must be verified. |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | `CheckoutForm.tsx` | Public key; match test/live mode to server key. |
| `STRIPE_SECRET_KEY`, `STRIPE_PRO_PRICE_ID`, `STRIPE_ELITE_PRICE_ID`, `STRIPE_WEBHOOK_SECRET` | Stripe route handlers and plan endpoints | Server secret except price IDs; mode, products, and webhook endpoint must match. |
| `STRIPE_CHECKOUT_ENABLED` | Plan endpoint and checkout route | Set to `true` only when accepting payments; defaults to disabled. Checkout also requires every Stripe variable above. Paid plans remain visible while checkout is disabled. |
| `CRON_SECRET` | Subscription expiration endpoint | Server secret if a scheduled request calls that route. The route rejects requests when absent. |

Auth provider settings live in the Supabase dashboard: Google OAuth client credentials, authorized redirect `https://<project-ref>.supabase.co/auth/v1/callback`, site URL/redirect allowlist, and custom SMTP. Do not paste a Google client secret into `NEXT_PUBLIC_*`. Password recovery uses the app's current origin as `redirectTo`; make sure the deployed origin is allowlisted and reachable.

The app workspace is `secondbrain/` (Next 16); the marketing workspace is `secondbrain-landing/` (Next 15). The app's Vercel Root Directory is `secondbrain`; confirm this and the correct project before changing env vars or deploying. Domain DNS is managed separately from Vercel project assignment and TLS. For a release, check `npm run build` in both workspaces; each build checks for numbered conflict copies before Next compilation. Check preview HTTP and authenticated behavior, live environment configuration, Auth redirect, mail delivery, and any payment/webhook flow being enabled. A successful build alone does not confirm the domain, external Auth, mail, or Stripe services.

Keep existing payment maintenance routes available even when new checkout is disabled. A cancellation tied to a real Stripe subscription must succeed at Stripe before the app records it as scheduled; return an error instead of inventing a renewal date if Stripe fails.
