---
name: secondbrain-app
description: Develop and debug the private SecondBrain diary app in the secondbrain workspace, including its React screens, components, state, accessibility, and responsive behavior. Use for app UI work; use secondbrain-data-auth for database or identity changes.
---

# SecondBrain app

Work in the `secondbrain/` workspace at the repository root. The app is Next.js 16 App Router, React 19, TypeScript, Tailwind 3, Zustand, Supabase Auth, and Spanish UI. Read [references/app-map.md](references/app-map.md) for the screen and component map when tracing a feature.

Before changing Next.js code, follow `secondbrain/AGENTS.md`: read the relevant versioned guide in `secondbrain/node_modules/next/dist/docs/`. Inspect the live call path before editing; some features span `src/app/page.tsx`, a component, `src/lib/store.ts`, and `src/lib/supabase-operations.ts`.

Keep authenticated state from `useAuth`/`SupabaseAuthContext`, diary date and entry state from `useDiaryStore`, and plan state from `useSubscription`. Do not duplicate those sources of truth. Keep dates as local `YYYY-MM-DD` for the diary and check month boundaries when editing calendar logic. Preserve existing personal content when changing edit/save flows.

Use `authenticatedFetch` for private API calls. Check server ownership in the route as well; client user IDs are not authorization. For changes to personal data, account identity, or RLS, load `secondbrain-data-auth`.

Verify a changed user flow at mobile and desktop widths when layout or interaction changes. Run `npm run build` from `secondbrain/` for TypeScript and Next compilation; its `prebuild` checks for numbered conflict copies. `npm run dev` runs the app locally; do not assume root and app workspaces share the same Next version. Update this skill's map when a screen or component's responsibility changes.
