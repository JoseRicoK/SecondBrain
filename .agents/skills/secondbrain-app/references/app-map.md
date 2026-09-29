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
- `StatisticsWrapper.tsx` dynamically loads `Statistics.tsx` without SSR; it requests a bundled server report, with separately authorized mood/people graph reads. Regenerating a report consumes one access; changing a graph period consumes none. No personal statistics are cached in localStorage.
- `Settings.tsx`, `UserHeader.tsx`, `WelcomeManager.tsx`/`WelcomeModal.tsx`: account settings, navigation, and first-use state.
- `src/hooks/useSubscription.ts` and `src/middleware/subscription.ts`: effective plan, feature limits, and monthly usage; `src/lib/subscription-state.ts` shares one server snapshot across consumers and ignores obsolete identity requests. Keep displayed plan behavior consistent with these modules and the server routes.

## UI conventions

- UI copy is primarily Spanish. Preserve keyboard, focus, and touch behavior, especially the mobile sidebar, people panel, calendar, and modal flows.
- Styles use Tailwind utility classes plus `src/app/globals.css` and CSS modules for PeopleManager, PersonalChat, Statistics, and WelcomeModal. Reuse the established palette and responsive breakpoints rather than adding a parallel design system.
- Assets live under `public/`; `next.config.ts` permits Google profile images and sets CSP/security headers. Review CSP when adding an external API, frame, font, or image host.

## State and regression checks

AI requests run on the server; model identifiers and reasoning baselines are centralized in `src/lib/ai-models.ts`. Both audio recorder paths retain `MediaRecorder.mimeType` (or the emitted chunk's type) when creating the Blob. The transcription route assigns a matching filename without converting the recording bytes. See the operations integration reference for model/API compatibility.

Personal and person chats derive quota loading from `useSubscription.loading`: disable sending and show a loading status until it resolves. A missing usage result is a load failure, not an exhausted quota; keep those messages distinct. The API still checks real limits independently of these UI controls.

`useDiaryStore` invalidates pending loads/saves when the selected date or request changes. Clear prior entries and audio on date changes. Only reuse an entry ID when both its owner and date match the current save. Keep the store error visible in the integrated diary and preserve drafts after failed persistence. `useSubscription` clears plan/usage on logout and ignores obsolete requests. The Auth provider also ignores profile responses from an earlier session after logout, account changes or unmount. Google-linked identities use the providers array consistently. Audio preview object URLs and microphone tracks must be released, and duration limits must use current recorder state rather than an old React closure. Follow [the test matrix](../../../../docs/TESTING.md) when changing these flows.

Subscription state refreshes after successful/quota-limited cost-bearing requests, across tab notifications, on focus and every visible minute. Display the UTC reset time and loading/error states; a load failure never means zero consumption. Derive subscription details from the shared snapshot when rendering settings. Feedback reply email is the authenticated account email. Cancellation refreshes shared state without reloading the page.

Statistics use a seven-day range including today; month/year exclude future diary dates. Guard asynchronous graph/report state against account switches and newer requests. A cached report may be reused for 30 minutes; explicit summary/citation refresh rebuilds the complete report. Keep this cost visible in the UI. Checkout remains visible but disabled when unavailable and lazily loads Stripe only after an enabled action. Existing subscriptions use the customer portal; checkout-return UI distinguishes payment confirmation from plan synchronization.
