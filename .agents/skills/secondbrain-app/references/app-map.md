# Private app map

## Screens

- `src/app/page.tsx`: signed-in diary workspace; coordinates `Sidebar`, personal chat, settings, statistics, people panel, audio, and the current entry. Auth UI appears when there is no session.
- `src/app/login`, `signup`, `reset-password`: Supabase Auth entry points. `src/components/Auth.tsx` owns the combined sign-in/sign-up behavior.
- `src/app/subscription`: plan selection and checkout UI; `src/app/dashboard`: Stripe checkout return and verification; `src/app/admin`: existing admin screen, whose server actions still need server authorization.
- `src/app/layout.tsx`: Spanish document metadata, viewport, `AuthWrapper`, welcome manager, and chunk error handling.

## Components and state

- `src/contexts/SupabaseAuthContext.tsx` and `src/hooks/useAuth.ts`: session, app user, profile, provider, and sign-out. Profile load/create runs after a session arrives.
- `src/lib/store.ts`: Zustand current date, current diary entry, editing, and transcriptions. `Sidebar.tsx` changes date and marks dates that have entries; the page fetches the selected entry.
- `src/components/DiaryEditor.tsx`: reusable editor presentation; the main page also contains integrated editing and save handlers. Trace which path a screen actually renders before editing.
- `PeopleManager.tsx`: people list, details and editing, search, and `PersonChat`. Person details are dated entries grouped by category.
- `PersonalChat.tsx` and `PersonalChatButton.tsx`: chat about the user's diary. `PersonChat.tsx`: chat scoped to a person.
- `AudioRecorder.tsx`, `TranscriptionsList.tsx`: browser recording, transcription request, and entry association. Recording requires a current entry.
- `StatisticsWrapper.tsx` dynamically loads `Statistics.tsx` without SSR; it uses mood/people/summary API routes and subscription checks.
- `Settings.tsx`, `UserHeader.tsx`, `WelcomeManager.tsx`/`WelcomeModal.tsx`: account settings, navigation, and first-use state.
- `src/hooks/useSubscription.ts` and `src/middleware/subscription.ts`: effective plan, feature limits, and monthly usage. Keep displayed plan behavior consistent with these modules and the server routes.

## UI conventions

- UI copy is primarily Spanish. Preserve keyboard, focus, and touch behavior, especially the mobile sidebar, people panel, calendar, and modal flows.
- Styles use Tailwind utility classes plus `src/app/globals.css` and CSS modules for PeopleManager, PersonalChat, Statistics, and WelcomeModal. Reuse the established palette and responsive breakpoints rather than adding a parallel design system.
- Assets live under `public/`; `next.config.ts` permits Google profile images and sets CSP/security headers. Review CSP when adding an external API, frame, font, or image host.
