# Next Steps

## High Priority

### Rename config dir from `bangla-anki` to `anki-defs`

- `python-server/anki_defs/config.py`: `CONFIG_DIR = Path.home() / ".config" / "bangla-anki"`
- `python-server/anki_defs/services/settings.py`: docstring reference
- `client/src/lib/storage-keys.ts`: `CHAT_STORAGE_KEY = 'bangla-chat'`
- Need migration: auto-move `~/.config/bangla-anki/` to `~/.config/anki-defs/` on startup
- Also rename keyring service name if it uses the old name

### Move onboarding-complete flag to server-side settings

- Currently `localStorage('anki-defs-onboarded')` — per-browser, lost on new devices
- Should be a boolean in server settings so Tailscale phone access doesn't re-trigger onboarding
- `needsOnboarding()` in `App.tsx` should check server-side flag

### Test and polish Anki add-on

- Both backends now use Bottle (WSGI) — verify add-on works end-to-end inside Anki Desktop
- Run `install-dev.sh` as ian, restart Anki, test all flows:
  card creation, search, deletion, SSE streaming, settings/keyring, cloze
- Rebuild frontend into addon after all recent UI changes

### Reader mode (tap-to-define)

- Paste a large block of text, tap any word for instant definition
- Option to add tapped words as flashcards
- Needs careful UI planning — user wants significant input on approach
- PDF/image import builds on this (Gemini vision for OCR)

### Embedded audio in cards

- Generate TTS audio at card creation time, embed in Anki notes
- See `PLANNING/audio-in-cards.md` for full plan
- Google Cloud TTS recommended (~$0.02 per 1K words)

### Language-agnostic prompts — Phase 2 DONE, Phase 3 remaining

- Phase 2 DONE: All prompt templates parameterized with `{{targetLanguage}}`, `{{languageRules}}`, etc.
  Bangla-specific content extracted to `shared/languages/bn.json`. Prompts load language
  at startup from `targetLanguage` setting (default `"bn"`).
- Remaining: add language files for other languages, update client to show language picker,
  rename `banglaDefinition` field in data layer (session DB, card_extraction, types).

## Medium Priority

### Unmarked sentence mode (auto-detect unknown words)

- Paste a sentence → auto-detect which words are NOT in Anki
- Tokenize, lemmatize, batch-check Anki, filter to unknown
- Different from sentence translation — this generates cards for unknown words

### Per-message streaming indicator

- With concurrent streaming, loading indicator only shows on last message
- Should show on any assistant message still loading

### Migrate Android to JSON-first pipeline

- Still uses old two-call streaming markdown + extraction
- Should match web: single non-streaming LLM call returning JSON

## Lower Priority

### Gemini grounding with web search

- `google_search` tool for grounded responses
- $35/1K grounded requests — opt-in only

### Bangla disambiguation support

- `eng-disambig` and `bangla-disambig` fields for homonyms

## Recently Completed

- Cloze card support (types, settings, UI checkboxes, distractor backend)
- TTS with voice picker (browser SpeechSynthesis, bn-IN)
- Theming (light/dark/system toggle, soft dark palette)
- Layout shift fixes (pre-read state, useLayoutEffect, fixed header)
- Onboarding flow (3-step wizard)
- Error messages in assistant bubbles
- Settings modal with tabs
- Structured logging (Python + frontend)
- Settings unification (shared settings_base.py)
- Duplicate card fix (allowDuplicate: true)
- Tap example sentence to populate input
- Input draft persistence
- Sentence translation mode (replaced sentence-blocked with sentence-translate)
- Removed dead ErrorModal code (component + hook were never wired up)
- Language-agnostic prompts: composable language files + parameterized templates
- Per-deck language picker with subdeck inheritance and custom language support
- Bottle migration: replaced FastAPI (python-server) and hand-rolled HTTP (addon) with Bottle WSGI
- Addon threading: `@main_thread` decorator for safe collection access from Bottle threads
