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
- `CardPreview.tsx` -- Flashcard preview with editing, TTS, card-type checkboxes (vocab/cloze/mcCloze) plus per-card vocab template overrides (recognition/production/listening), add/skip/queue. Sends the new domain `CreateNoteRequest` payload (deck, cardType, word, definition, etc.)
- `Settings.tsx` -- Tabbed settings modal (AI Provider, Anki, Preferences, Debug). The Anki tab has per-deck languages (default deck, language per deck with subdeck inheritance), default card types, and vocab card templates. The Debug tab provides controls to reset onboarding / clear chat history / forget deck languages for re-testing the new-user flow.
- `HeaderDeckSelector.tsx` -- Unified deck selector (short name on mobile, full-screen picker). Refetches deck list on open; prompts for language via `DeckLanguagePrompt` when user picks a deck with no configured language (walks `::` ancestors first).
- `DeckLanguagePrompt.tsx` -- Small modal asking which language a newly-selected deck is in; uses the shared `LanguageDropdown` and writes via `useSettingsStore.setDeckLanguage`.
- `LanguageDropdown.tsx` -- Shared Select of languages (server-provided + custom) with an optional `Custom...` entry. Used by Settings, OnboardingModal, and DeckLanguagePrompt.
- `OnboardingModal.tsx` -- First-run setup wizard (3 steps: provider + API key + inline keyring notice, deck + language, usage tips). Seeds `deckLanguages[defaultDeck]` on finish.
- `HelpPage.tsx` -- In-app help/documentation page
- `ErrorBoundary.tsx` -- React error boundary
- `KeyringWarning.tsx` -- Reusable insecure storage consent dialog
- `SessionCardsPanel.tsx` -- Session card panel (removed from header, used internally)
- `HistoryPanel.tsx` -- Word history sidebar
- `TokenDisplay.tsx` -- Token/cost display in header
- `PromptPreview.tsx` -- Debug prompt preview (via ?demo=prompts)
- `RetryUxDemo.tsx` -- Debug retry UX demo (via ?demo=retry)
- `ui/` -- Base UI primitives (Badge, Button, Card, Input, Label, Select)
- `photo/` -- Photo-to-flashcards flow: `UploadStep` (capture/upload, owns `useImageInput` hook internally), `ExtractStep` (vision vocab extraction), `GenerateStep` (AI card generation), `MaskCanvas` (crop overlay), `PhotoCapture` (camera), `ClozeTranscribeStep` (vision transcription of exercise images), `ClozeReviewStep` (review/edit cloze items, add to Anki)
- `pdf/` -- PDF-to-flashcards flow: `PdfPage` (step container), `PdfUploadStep` (pdfjs parse), `PdfChapterStep` (chapter picker from outline), `PdfScoutStep` (scouted TOC checkboxes), `PdfExtractStep` (stream CardPreviews with tags)

## Hooks (`src/hooks/`)

- `useChat.ts` -- Chat state + SSE streaming + input draft persistence (Zustand + persist)
- `useAnki.ts` -- TanStack Query hooks for Anki API calls (sync invalidates all queries), `useLanguages()` for language list
- `useSettings.ts` -- Zustand settings store (persisted)
- `useSessionCards.ts` -- Session card tracking + pending queue
- `useTokenUsage.ts` -- Token/cost accumulation
- `usePlatform.ts` -- Platform detection (web/android/anki-addon)

## Lib (`src/lib/`)

- `api.ts` -- API client (REST fetch wrappers + SSE stream + distractor generation + `languageApi`). No `getModels`/`getModelFields` — the client no longer picks note types.
- `focus.ts` -- Word focus/highlight logic (parse tokens, toggle `**` markers, `isEnglishToTarget` detection)
- `utils.ts` -- Utilities: `sentenceToCloze`, `markdownBoldToHtml`, `cn`, `generateId`. Field-building helpers (`buildNoteFields`, `buildClozeFields`, `buildMCClozeFields`) were removed — field mapping is now server-side.
- `logger.ts` -- Structured console logging with levels (`createLogger`)
- `tts.ts` -- Text-to-speech using browser SpeechSynthesis API (voice detection, selection)
- `pdf.ts` -- pdfjs wrapper: `loadPdf`, `extractOutline` (font-based heading heuristics + bookmarks fallback, header/footer + soft-hyphen normalization), `getSectionText`. Structural only; classification lives in the server scout prompt.

## Adding a New API Endpoint (Client Side)

1. Add fetch wrapper in `src/lib/api.ts`
2. Add TanStack Query hook in `src/hooks/`
3. Types come from `shared/types.ts` (imported as `shared`)
