# Public site map

- `src/app/page.tsx`: homepage composition and major editorial content.
- `src/app/precios/page.tsx` and `src/components/PricingSection.tsx`: pricing page and plan cards. Plans, feature bullets, and prices are currently authored in this component; compare with app policy before changing.
- `src/app/soporte`, `privacidad`, `terminos`: support and legal pages with their own metadata.
- `src/components/Header.tsx`: shared navigation; `CtaSection.tsx`, `FAQSection.tsx`, `StatsSection.tsx`, `TestimonialsCarousel.tsx`, `AnimatedFeatures.tsx`, `AnimatedBackground.tsx`: reusable homepage sections.
- `src/app/layout.tsx`: global metadata, icons, Open Graph/Twitter fields, structured data, and viewport. `src/app/opengraph-image.tsx`, `twitter-image.tsx`, `sitemap.ts`, and `robots.ts` support discovery.
- `src/app/globals.css`: active global styles. Other similarly named CSS files are present; verify imports before editing.

The site and app are separate workspaces with different Next and Tailwind versions. The public domain is `secondbrainapp.com`; CTAs target `app.secondbrainapp.com`. Verify both destinations in the deployed environment after changing navigation or sign-up flows.

## SEO and regression checks

`src/app/sitemap.ts` and `src/app/robots.ts` are the only sources for those metadata routes. Do not add `public/sitemap.xml` or `public/robots.txt`: static files override the generated endpoints and can hide newer pages. Preserve the social crawler rules in the TypeScript metadata source. Run the landing unit suite and all public pages at desktop/mobile widths using [docs/TESTING.md](../../../../docs/TESTING.md).

Plan claims must match implemented quotas in `secondbrain/src/lib/subscription-policy.ts` and the server catalogue. All tiers use the same AI models; do not claim better model quality, priority support or experimental features without an implementation. Elite chat has finite monthly quotas; only statistics reports are unlimited. Prices and pricing structured-data copy use euros. Graph period changes consume no report access. Paid checkout availability is controlled by the app's explicit feature flag.
