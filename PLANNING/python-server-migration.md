# Python Server Migration

Replace Express backend with FastAPI. Share service layer with Anki addon.

## Status

| Phase | Description | Status |
|-------|-------------|--------|
| 1 | Shared service layer | Done |
| 2 | FastAPI server + routes | Done |
| 3 | API comparison testing | Done |
| 4 | Addon integration | Not started |
| 5 | Switchover | Not started |

## What's Done (Phases 1-2)

- `python-server/anki_defs/services/` — All services ported:
  - `ai.py` — All 6 prompt templates, selectPrompt, provider dispatch
  - `providers/{claude,gemini,openrouter}.py` — httpx-based (replaces urllib)
  - `session.py` — SQLite with same schema as Express (cards, pending, word_cache, usage_log)
  - `settings.py` — File-based JSON + env overrides + key masking
  - `anki_connect.py` — AnkiConnect HTTP client + word cache
  - `card_extraction.py` — JSON parsing, validation, Anki duplicate check

- `python-server/anki_defs/routes/` — All routes matching Express:
  - chat (SSE streaming + relemmatize), session, anki, settings, prompts
  - health, platform endpoints

- `python-server/anki_defs/middleware/auth.py` — Bearer token (localhost exempt)
- 67 pytest tests covering services + routes
- `uv run ruff check . && uv run pyright && uv run pytest` all pass

## What's Left

### Phase 3: API Comparison Testing — Done
- 20 comparison tests: health, platform, settings, anki (decks/models/fields),
  session (state/usage/history), prompt preview (all 5 modes), SSE structure, write ops
- All passing — full structural parity confirmed

### Phase 4: Addon Integration
- Update `scripts/build-addon.sh` to copy shared services
- Replace addon's providers with `_services.providers.*`
- Addon gets free features: EN→BN mode, usage tracking, history, word cache

### Phase 5: Switchover
- Update root `package.json` dev script to use Python server
- Update CLAUDE.md build commands
- Update CI
- Keep `ankiconnect-server/` one cycle, then delete
