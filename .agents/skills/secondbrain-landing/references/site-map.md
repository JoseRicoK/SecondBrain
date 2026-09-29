# Public site map

- `src/app/page.tsx`: homepage composition and major editorial content.
- `src/app/precios/page.tsx` and `src/components/PricingSection.tsx`: pricing page and plan cards. Plans, feature bullets, and prices are currently authored in this component; compare with app policy before changing.
- `src/app/soporte`, `privacidad`, `terminos`: support and legal pages with their own metadata.
- `src/components/Header.tsx`: shared navigation; `CtaSection.tsx`, `FAQSection.tsx`, `StatsSection.tsx`, `TestimonialsCarousel.tsx`, `AnimatedFeatures.tsx`, `AnimatedBackground.tsx`: reusable homepage sections.
- `src/app/layout.tsx`: global metadata, icons, Open Graph/Twitter fields, structured data, and viewport. `src/app/opengraph-image.tsx`, `twitter-image.tsx`, `sitemap.ts`, and `robots.ts` support discovery.
- `src/app/globals.css`: active global styles. Other similarly named CSS files are present; verify imports before editing.

The site and app are separate workspaces with different Next and Tailwind versions. The public domain is `secondbrainapp.com`; CTAs target `app.secondbrainapp.com`. Verify both destinations in the deployed environment after changing navigation or sign-up flows.
