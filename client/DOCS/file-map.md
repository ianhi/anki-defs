# Client File Map

## Entry Points

- `src/main.tsx` -- React entry point, QueryClient config, scroll restoration fix
- `src/App.tsx` -- Main app component, layout, modal routing (settings, help, onboarding)
- `src/index.css` -- CSS entry with Tailwind v4 (`@theme` tokens, dark mode)
- `src/vite-env.d.ts` -- Vite client types (import.meta.env)

## Components (`src/components/`)

- `Chat.tsx` -- Primary chat interface, passes draft persistence to MessageInput
- `MessageList.tsx` -- Message rendering (no avatar icons, full-width on mobile)
- `MessageInput.tsx` -- Text input with word focus UI (Focus bar, Ctrl+B, auto-resize, draft persistence)
- `CardPreview.tsx` -- Flashcard preview with editing, TTS, cloze checkboxes, add/skip/queue
- `Settings.tsx` -- Tabbed settings modal (AI Provider, Anki, Preferences)
- `HeaderDeckSelector.tsx` -- Unified deck selector (short name on mobile, full-screen picker)
- `OnboardingModal.tsx` -- First-run setup wizard (3 steps: provider, deck, usage tips)
- `HelpPage.tsx` -- In-app help/documentation page
- `ErrorBoundary.tsx` -- React error boundary
- `KeyringWarning.tsx` -- Reusable insecure storage consent dialog
- `SessionCardsPanel.tsx` -- Session card panel (removed from header, used internally)
- `HistoryPanel.tsx` -- Word history sidebar
- `TokenDisplay.tsx` -- Token/cost display in header
- `PromptPreview.tsx` -- Debug prompt preview (via ?demo=prompts)
- `RetryUxDemo.tsx` -- Debug retry UX demo (via ?demo=retry)
- `ui/` -- Base UI primitives (Badge, Button, Card, Input, Label, Select)

## Hooks (`src/hooks/`)

- `useChat.ts` -- Chat state + SSE streaming + input draft persistence (Zustand + persist)
- `useAnki.ts` -- TanStack Query hooks for Anki API calls (sync invalidates all queries)
- `useSettings.ts` -- Zustand settings store (persisted)
- `useSessionCards.ts` -- Session card tracking + pending queue
- `useTokenUsage.ts` -- Token/cost accumulation
- `usePlatform.ts` -- Platform detection (web/android/anki-addon)

## Lib (`src/lib/`)

- `api.ts` -- API client (REST fetch wrappers + SSE stream + distractor generation)
- `focus.ts` -- Word focus/highlight logic (parse tokens, toggle `**` markers, `isEnglishToTarget` detection)
- `utils.ts` -- Utilities: `buildNoteFields`, `buildClozeFields`, `buildMCClozeFields`,
  `sentenceToCloze`, `markdownBoldToHtml`, `cn`, `generateId`
- `logger.ts` -- Structured console logging with levels (`createLogger`)
- `tts.ts` -- Text-to-speech using browser SpeechSynthesis API (voice detection, selection)

## Adding a New API Endpoint (Client Side)

1. Add fetch wrapper in `src/lib/api.ts`
2. Add TanStack Query hook in `src/hooks/`
3. Types come from `shared/types.ts` (imported as `shared`)
