---
name: secondbrain-landing
description: Build, edit, or review the public SecondBrain marketing site in the secondbrain-landing workspace, including pricing, SEO, legal pages, and mobile presentation. Do not use for the private diary app.
---

# SecondBrain landing

Work in the `secondbrain-landing/` workspace, a separate Next.js 15 App Router and React 19 app using Tailwind 4, Framer Motion, and Lucide icons. Read [references/site-map.md](references/site-map.md) when changing page structure, shared sections, links, or metadata.

The public site is Spanish and sends sign-up traffic to `https://app.secondbrainapp.com`. Reuse its existing sections, gradient palette, motion language, and mobile breakpoints. Keep substantive claims, prices, included features, and structured data aligned with `secondbrain/src/middleware/subscription.ts`, checkout configuration, and actual availability; verify claims before publishing them. Preserve readable content when animations are reduced or unavailable.

When adding or editing a public page, check metadata, canonical URL, sitemap/robots as relevant, links, keyboard access, and narrow-screen layout. Run `npm run build` from `secondbrain-landing/`; its `prebuild` checks for numbered conflict copies. Update the site map when page structure changes. Use `secondbrain-app` for private app changes and `secondbrain-operations` for domains or deployment.
