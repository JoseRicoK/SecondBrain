# Public site map

- `src/app/page.tsx`: visual server-rendered homepage with concise copy, a prominent product mockup, feature artwork, registration CTAs and illustrated guide links. Detailed SEO prose belongs in the guides.
- `ProductPreview.tsx`: client island with diary/voice/chat/charts view buttons and a motion pause control. Default diary markup is server-rendered. Demo content is explicitly fictitious, never loaded from production diaries; this is an illustrative mockup, not a live authenticated app. Do not add real provider calls or microphone requests here.
- `ProductArtwork.tsx`: reusable diary, waveform, conversation and SVG graph artwork. Server feature cards reuse it; the small client mockup imports it for its panels. CSS animations use transforms, respect reduced motion and pause via the preview's `data-motion` state. Infinite motion starts only after hydration; the rest of the page stays readable without JavaScript.
- The chat mockup demonstrates recalling 15 fictitious meetings with Laura. Its numbered history is clipped and progressively masked behind the illustrative composer; keep the question, answer total and first items readable at mobile widths. The compact feature card shares the question/total without the full list.
- `src/app/landing-visual.css`: visual homepage/mockup/card styles, shared CTA and responsive breakpoints; imported after `globals.css` in the root layout. Keep these styles separate from legacy liquid effects.
- In the people illustration, scope the full-size connection SVG with `.people-art > svg`. A descendant selector also matches the nested Lucide icon and stretches it across the central circle; preserve the icon's own size/stroke.
- `src/app/precios/page.tsx` and `PricingSection.tsx`: server-rendered euro prices and dynamic plan limits. `src/lib/plans.ts` validates the app public catalogue, revalidates every 60 seconds with a three-second request timeout and fails closed for paid checkout. A fallback must identify its limits as reference values.
- `src/app/[slug]/page.tsx`: statically generated guides from `src/lib/content.ts`, with distinct metadata and Article/BreadcrumbList. Unknown guides return 404 through `notFound()`.
- `src/app/soporte`, `privacidad`, `terminos`: informative/legal pages with distinct metadata, shared header/footer and factual provider descriptions.
- `Header.tsx`: accessible client mobile navigation with expanded/control state, Escape/focus restoration and height-limited overflow. `Footer.tsx`, `CtaSection.tsx`, `FAQSection.tsx`, `PricingSection.tsx` are server components. FAQ uses native exclusive `details/summary` and works without JavaScript.
- `src/lib/site.ts`: canonical domain, app/signup URL, editorial revision date, metadata helper and JSON-LD escaping. The canonical public host is `www.lumadiary.com`, the destination of the apex redirect; verify the deployed redirect before changing it.
- `src/app/layout.tsx`: global Organization/WebSite metadata, accessible viewport allowing zoom and skip link. Page-specific software/article markup stays on the relevant page. Social images, sitemap and robots are generated routes.

The public site and private app have separate Next/Tailwind versions. CTAs target `https://app.lumadiary.com/signup?plan=free`. Pro/Elite signups preserve their selected plan only while the server allows paid checkout; when disabled, disclose unavailability and offer free registration. Never use a cached marketing response to authorize a payment.

## SEO and regression checks

`src/app/sitemap.ts` and `robots.ts` are the only metadata-route sources. Do not add `public/sitemap.xml` or `public/robots.txt`, and do not block `/_next/`. Include all public guides, distinct absolute canonic/social URLs and an editorial modification date rather than request time.

Keep features and quotas aligned with the server catalogue. All tiers use the same AI models. Do not add unimplemented priority support, model upgrades, invented reviews/user counts or clinical outcomes. Elite chats have finite monthly quotas; its statistics reports are unlimited. Graph period changes consume no report access. Software offers reflect actual checkout availability; do not invent ratings for rich-result eligibility.

Read [the SEO guide](../../../../docs/LANDING-SEO.md). Run unit/catalogue tests and public desktop/mobile browser flows, including no-JavaScript content, native FAQ, menu keyboard focus, canonical URLs and unknown-route 404. Verify the normal landing build and [shared testing guide](../../../../docs/TESTING.md). Use the root lockfile and installation, never a separate workspace lockfile.
