# Addon End-to-End Testing Session (2026-04-14/15)

## Summary

First real test of the Anki addon inside Anki Desktop. Many issues found and
fixed. All changes are uncommitted — needs a single large commit or split into
logical chunks.

## What was changed (all uncommitted)

### Bug fixes

- **Addon language route**: `/api/languages` → `/api/anki/languages` (was 404)
- **Non-blocking socket send**: 500KB JS bundle truncated because `sendall` on
  non-blocking socket silently failed. Fixed with blocking send + 30s timeout.
- **Hardcoded "EN → বাংলা" badge**: now reads active deck's language
- **Hardcoded "Bangla word or sentence..." placeholder**: now language-reactive
- **Sentence breakdown returned raw JSON**: `outputRules` had "return only JSON"
  which conflicted with the markdown-format sentence prompt. Split into
  `outputRules` (shared) + `jsonOutputRule` (JSON prompts only).
- **`**bold**` markers in example sentences**: `note_types.py` now converts to
  `<b>` HTML before storing in Anki
- **Auto-detect English broken for Spanish**: Latin-script target languages now
  skip the "Latin chars = English" heuristic. User must use explicit prefix.
- **es-MX TTS locale not installed**: default `ttsLocale` changed to `es-US`

### New features

- **Per-deck language** (full implementation):
  - `DeckLanguagePrompt.tsx`: modal when switching to an untagged deck
  - `LanguageDropdown.tsx`: shared reusable component (replaces 3 duplicates)
  - `useSettingsStore`: `setDeckLanguage()`, `resolveDeckLanguage()` domain methods
  - Onboarding step 2 now includes language picker
  - Settings "Default Language" removed → per-deck only with subdeck inheritance
  - Runtime prompt cancelled on dropdown reopen (rapid-change bug fix)
- **Language-reactive TTS**: `tts.ts` rewritten with per-language voice cache +
  localStorage overrides. CardPreview and TtsVoicePicker updated.
- **Audio fields on note types**: WordAudio, ExampleAudio, FullSentenceAudio,
  AnswerAudio, Distractor{1-3}Audio. Templates use
  `{{#XAudio}}{{XAudio}}{{/XAudio}}{{^XAudio}}{{tts ...}}{{/XAudio}}` fallback.
  Fields are empty (Cloud TTS not wired yet) so device TTS always fires.
- **Model migration**: `_migrate_existing_model` in both backends adds missing
  fields + updates templates + CSS on existing note types. No need to delete and
  recreate.
- **Anki TTS locale override**: `ankiTtsLocaleByLanguage` setting with UI in
  Settings → Anki. Lets user map e.g. `es-MX` → `es_US` for voice availability.
- **Debug panel**: Settings → Debug tab. Reset onboarding, clear chat, forget
  deck languages, clear all local data.
- **Keyring warning moved**: inline on step 1 (API key page) instead of late
  modal on step 3.
- **Tighter definitions**: outputRules enforce 1–4 words, no semicolons/slashes,
  single meaning only.
- **Tailscale CGNAT exemption**: `100.64.0.0/10` treated as trusted (no bearer
  token needed). Both addon and python-server.
- **Forest green theme**: `index.css` redesigned. WCAG AA compliant.
- **Storage key constants**: `lib/storage-keys.ts` (ONBOARDED, CHAT, THEME)
- **Deck list refetch on open**: HeaderDeckSelector calls `refetch()` on open
- **Onboarding content overflow**: `overflow-y-auto` on content area
- **install-dev.sh**: `force_rm` helper for ian-owned `__pycache__` files
- **Caching headers**: `no-cache` for HTML, immutable for hashed assets
- **Error diagnostics in index.html**: shows URL, protocol, API status, script
  paths if app fails to start
- **Tailscale docs page**: rewritten with addon path, Chrome HTTP flag, TS Serve

### Prompt changes

- `variables.json`: tight definition rules, example sentence capitalization rule,
  split `jsonOutputRule` from `outputRules`
- `sentence.json`: tighter word-by-word format (1–4 word meanings)
- Language files: added `script` field (`latin` / `bengali`)

### Addon HTTP error handling

- `_format_http_error()` in chat_routes.py: turns HTTPStatusError into
  user-facing messages with status-specific hints (401 → check key, 429 → rate
  limited, 400 → bad model/key). Covers all 4 AI call paths.
- Silent `except OSError: pass` replaced with logged errors throughout web.py

## Known issues (NOT yet fixed)

1. **Mobile blank page**: JS module loads (500KB) but app doesn't render on
   phone. Likely the non-blocking send bug (now fixed) — needs retest after
   Anki restart.
2. **Addon HTTP server fragility**: raw socket server is the root cause of the
   send bug and many other edge cases. Should be replaced with Bottle (single
   file WSGI) + QTimer adapter. Not a quick fix — dedicated session.
3. **Audio fields empty**: schema is ready but no Cloud TTS provider wired.
   Device TTS fallback works but quality varies.
4. **`translationPrefix` is global**: with per-deck languages, the `bn:` prefix
   doesn't adapt per-language. Low priority — auto-detect is the primary path;
   explicit prefix is rare.
5. **Browser title still "anki-defs"**: changed from "Bangla Vocabulary Learning"
   but not language-reactive.

## Files changed (39 files)

See `git status` for full list. Spans: client/, shared/, python-server/,
anki-addon/, scripts/, docs/.

## Testing checklist for next agent

After committing, verify:

- [ ] `npm run check` passes
- [ ] `npm run check:py` passes
- [ ] Addon loads in Anki without errors
- [ ] Spanish deck: card creation produces `anki-defs-es-MX` model with
      `WordAudio`/`ExampleAudio` fields and `{{tts es_US:...}}` in templates
- [ ] Tailscale access from phone (after Anki restart with send fix)
- [ ] Sentence breakdown returns markdown, not JSON
- [ ] `que onda` does NOT trigger "EN → Spanish" auto-detect
- [ ] Definitions are tight (1–4 words, no semicolons)
