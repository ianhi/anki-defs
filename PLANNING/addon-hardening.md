# Addon Hardening & Polish

Post-migration cleanup: validate keyring integration, fix code quality issues,
improve error handling for card creation.

## Context

The addon was just migrated to share services with `python-server/`. The shared
service layer works but the integration was done quickly and needs hardening.
The keyring integration for secret storage is new and needs validation. Card
creation errors are silently swallowed, confusing users.

## Tasks

### 1. Validate keyring storage

- Verify API keys round-trip correctly: set via settings UI → stored in keyring →
  read back on next request → provider can authenticate
- Test on ian's account (the Anki user): restart Anki, set a Gemini key in settings,
  verify it persists across restarts
- Verify migration: if old plain-text keys exist in settings.json or Anki meta.json,
  they should be stripped on read (the code does this, but verify end-to-end)
- Check that the python-server and addon share the same keyring service name
  (`anki-defs`) so keys set by one are readable by the other
- Test the error path: what happens when keyring is unavailable? The error message
  should be clear and actionable

### 2. Clean up bare exceptions in addon code

Search the entire `anki-addon/` directory for bare `except:` or `except Exception:` and
replace with specific exception types. Key files to audit:

- `handlers/chat_routes.py` — threading + SSE error handling
- `handlers/anki_routes.py` — Anki collection errors
- `handlers/session_routes.py` — SQLite errors
- `server/web.py` — socket errors
- `services/anki_service.py` — collection access errors

Use specific types: `ValueError`, `OSError`, `sqlite3.Error`, `json.JSONDecodeError`,
`keyring.errors.KeyringError`, etc.

### 3. Use absolute imports everywhere

All addon code should use `anki_defs.*` absolute imports, not relative (`..`) imports.
The thin wrapper files in `services/` already do this. Check:

- `handlers/*.py` — currently use `from ..services import ...` (relative). Should these
  stay relative (they're part of the addon package) or go absolute? Decision: **relative
  imports within the addon's own code are fine** (handlers → services, server → etc.).
  Only the `_services/` boundary crossing should use absolute imports.
- `_services/*.py` — these are copied from python-server at build time. The build script
  rewrites imports. Verify the rewrites are correct after a fresh build.
- Run `scripts/install-dev.sh` or manually rebuild `_services/` and verify all imports
  resolve correctly in both Anki and tests.

### 4. Settings persistence

Current state: non-secret settings go to Anki's addon config (meta.json), secrets go
to system keyring. Issues to verify:

- When user changes settings via the UI, do they persist across Anki restarts?
- The addon's `get_settings()` merges: defaults < Anki config < keyring secrets.
  Verify the merge order is correct (keyring should win over config for secret fields).
- The `defaultModel` and `fieldMapping` settings need to be present in the merged
  result. These come from `shared/defaults/settings.json`. Verify the defaults path
  resolution works in both dev (symlink) and packaged (.ankiaddon) modes.
- The masking in `get_masked_settings()` should use the standard bullet character
  (`\u2022`) not dashes.

### 5. Choose a good default note type

Current default: `"Bangla (and reversed)"` — this is a custom note type that only
exists on the user's machine. A new user won't have it.

Options:

- Keep the current default but handle gracefully when it doesn't exist
- Fall back to `"Basic (and reversed card)"` which ships with Anki
- On first startup, check what note types exist and pick the best match
- Show a setup wizard / first-run prompt

Recommendation: keep `"Bangla (and reversed)"` as default in settings, but when
creating a card, if the model doesn't exist, show a clear error telling the user
to configure their note type in settings. Don't silently fail.

### 6. Better error handling for card creation failures

**Current behavior**: when card creation fails (wrong note type, missing fields, etc.),
the error is caught silently and the card goes to the "pending queue" with a "Queued"
label. The user has no idea what went wrong.

**Desired behavior**: surface the actual error to the user. Specific cases:

- **Note type doesn't exist**: "Note type 'X' not found. Check Settings > Default Model."
- **Field mismatch**: "Field 'Y' not found in note type 'X'. Check Settings > Field Mapping."
- **Duplicate note**: "A card with this word already exists." (This may already work via
  the alreadyExists check, but verify.)
- **Anki offline**: "Could not connect to Anki. Card queued for later." (This is the only
  case where silent queuing is appropriate.)

Implementation: the client's `handleAddCard` in `CardPreview.tsx` catches errors and
calls `addToPendingQueue`. Instead, it should distinguish between "Anki offline" (queue)
and "creation error" (show error message to user). The server endpoints should return
descriptive error messages, not just 500.

## Files to modify

| File                                               | Changes                                      |
| -------------------------------------------------- | -------------------------------------------- |
| `anki-addon/services/settings_service.py`          | Validate keyring, masking chars              |
| `anki-addon/handlers/*.py`                         | Specific exception types                     |
| `anki-addon/services/anki_service.py`              | Descriptive error messages for card creation |
| `client/src/components/CardPreview.tsx`            | Show errors vs. silent queuing               |
| `python-server/anki_defs/routes/anki.py`           | Descriptive error messages                   |
| `python-server/anki_defs/services/anki_connect.py` | Descriptive error messages                   |
| `shared/defaults/settings.json`                    | Review default model value                   |

## Verification

- `uv run ruff check .` in both `python-server/` and `anki-addon/` — no bare exceptions
- `uv run pytest tests/` in both — all pass
- `npm run check` — TypeScript clean
- Manual test: set a wrong note type in settings, try to add a card — should show
  clear error, not "Queued"
- Manual test: set API key via addon settings UI, restart Anki, key persists
