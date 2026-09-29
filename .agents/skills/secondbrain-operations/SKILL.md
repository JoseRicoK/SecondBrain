---
name: secondbrain-operations
description: "Configure, verify, or release SecondBrain integrations and hosting: Vercel, Supabase Auth providers/SMTP, Stripe, OpenAI, Resend, domains, and environment variables. Use for deployment or credential questions in the SecondBrain repository; use other SecondBrain skills for feature code."
---

# SecondBrain operations

Read [references/integrations.md](references/integrations.md) for the current code's environment-variable contract and release checks. Verify live platform state before acting; the reference describes architecture, not current secret values or deployment status.

Keep secret values out of commits, logs, browser-visible variables, and chat. Local app secrets belong in gitignored `secondbrain/.env.local`; production and preview values belong in the corresponding Vercel project environment. Never copy test Stripe credentials to live billing or treat a successful build as proof that checkout, OAuth, or email delivery works.

The app and landing have separate build roots. Each `prebuild` blocks numbered conflict copies in source. Check the intended Vercel project, Root Directory, environment, domain, and current deployment before deploying. Validate a preview first; a production release should have working Auth redirects, email recovery, Stripe live prices and signed webhook if paid plans are offered, and an end-to-end check of the intended user flow. Checkout remains off until `STRIPE_CHECKOUT_ENABLED=true` and all payment keys are configured. Use `secondbrain-data-auth` when an integration writes user data or subscriptions. Update the integrations reference whenever its environment contract or release checks change.
