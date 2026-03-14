# Addon Hardening & Polish

Post-migration cleanup: validate keyring integration, fix code quality issues,
improve error handling for card creation.

## Status: DONE

All 6 tasks completed.

## Tasks

### 1. Validate keyring storage — DONE

- Verified both python-server and addon use `_KEYRING_SERVICE = "anki-defs"` — keys
  set by one are readable by the other.
- Settings merge order correct: defaults < Anki config < keyring secrets.
- Migration: secrets stripped from config in both `get_settings()` and `save_settings()`.
- Error path: `_read_secret`/`_write_secret` now catch `keyring.errors.KeyringError`
  (not bare `Exception`) and raise `RuntimeError` with clear message.

### 2. Clean up bare exceptions — DONE

Replaced all `except Exception:` with specific types across both addon and python-server:

| File                                      | Was                | Now                                                               |
| ----------------------------------------- | ------------------ | ----------------------------------------------------------------- |
| `anki-addon/services/settings_service.py` | `except Exception` | `except keyring.errors.KeyringError`                              |
| `anki-addon/services/anki_service.py`     | `except Exception` | `except (ValueError, KeyError)`                                   |
| `anki-addon/server/web.py` (10 sites)     | `except Exception` | `except OSError` / `except (OSError, ValueError)`                 |
| `anki-addon/server/sse.py`                | `except Exception` | `except OSError`                                                  |
| `anki-addon/server/router.py`             | `except Exception` | `except (RuntimeError, ValueError, OSError, KeyError)`            |
| `anki-addon/handlers/chat_routes.py`      | `except Exception` | `except OSError` / `except (RuntimeError, ValueError)` / specific |
| `anki-addon/handlers/anki_routes.py`      | `except Exception` | `except ValueError` / `except RuntimeError`                       |
| `anki-addon/handlers/session_routes.py`   | `except Exception` | `except sqlite3.Error`                                            |
| `anki-addon/handlers/settings_routes.py`  | `except Exception` | `except RuntimeError` / `except json.JSONDecodeError`             |
| `python-server/routes/anki.py`            | `except Exception` | `except httpx.HTTPError` / `except RuntimeError`                  |
| `python-server/routes/session.py`         | `except Exception` | `except sqlite3.Error`                                            |
| `python-server/routes/settings.py`        | `except Exception` | `except RuntimeError`                                             |
| `python-server/services/settings.py`      | `except Exception` | `except keyring.errors.KeyringError`                              |
| `python-server/services/anki_connect.py`  | `except Exception` | `except (httpx.HTTPError, RuntimeError)`                          |

### 3. Use absolute imports everywhere — DONE (verified)

- Handlers use relative imports (`..services`, `..server`) — correct per CLAUDE.md
  (within addon's own code).
- `_services/*.py` use absolute imports (`from anki_defs.config import ...`) — correct
  for cross-package boundary.
- Build script (`scripts/build-addon.sh`) rewrites `from ..config` → `from anki_defs.config`
  when copying services.

### 4. Settings persistence — DONE

- Verified masking uses bullet character (`\u2022`) in `settings_service.py`.
- Fixed `settings_routes.py` `handle_put_settings` which was using dashes (`"----"`)
  for mask detection and `"--------"` for mask display. Now uses `\u2022` consistently.
- Merge order verified: defaults < Anki config < keyring secrets.

### 5. Choose a good default note type — DONE

Kept `"Bangla (and reversed)"` as default. The `anki_service.create_note` already
raises `ValueError("Model not found: ...")` when the model doesn't exist. With the
error handling improvements in task 6, this now surfaces to the user as a clear error
message instead of silently queuing.

### 6. Better error handling for card creation — DONE

**Server-side (both backends):**

- python-server `routes/anki.py`: Returns specific HTTP status codes:
  - 503 for connection errors (`httpx.HTTPError`) — "Could not connect to Anki"
  - 500 for AnkiConnect errors (`RuntimeError`) — forwards actual error message
  - 400 for validation errors
- addon `handlers/anki_routes.py`: Returns `ValueError` as 400, `RuntimeError` as 500
- `anki_connect.py`: Improved error message for null note_id (duplicate/empty field)

**Client-side (`CardPreview.tsx`):**

- Added `addError` state for displaying errors
- Connection errors (`Request failed`, `Could not connect`) → queue silently
- Application errors (wrong model, missing fields, duplicates) → display red error text
- Error clears on next add attempt
