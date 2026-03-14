# Settings Unification

Unify settings handling across python-server and anki-addon so they share
the same keyring/fallback/consent logic with minimal platform-specific glue.

## Status: DONE (Part 1)

Shared `settings_base.py` extracted. Both backends are thin adapters.
Parts 2a-2c (error modal, logging, settings tabs) are follow-up tasks.

## What was done

- New `settings_base.py` in python-server/services/ with all shared logic:
  D-Bus fix, keyring probe, read/write with fallback callbacks, masking,
  consent helpers, masked-key stripping
- Both `settings.py` (python-server) and `settings_service.py` (addon) are
  now thin adapters that provide platform-specific fallback callbacks
- Python-server routes now return `_keyringAvailable` and `_insecureStorageConsent`
  (parity with addon)
- Python-server routes handle the 409 consent flow (was addon-only)
- D-Bus fix removed from `config.py` and `__init__.py` (lives in `settings_base.py`)
- Build/install scripts automatically copy `settings_base.py` to `_services/`

## Follow-up tasks — DONE

### Error Modal Component — DONE

- `ErrorModal.tsx` with copyable debug info (JSON with error, timestamp, URL, userAgent)
- `useErrorModal.ts` Zustand store for global error state
- Mounted in App.tsx at z-60 (above settings modal)

### Logging Strategy — DONE

- Python: all `print()` replaced with `logging` module across 12 files (53 statements)
- `logging.basicConfig()` in `main.py` for python-server
- Frontend: `logger.ts` with `createLogger(name)` factory, level-aware
- All `console.error('[Tag]')` replaced with `log.error()` across 8 files

### Settings Tabs — DONE

- Three tabs: AI Provider | Anki | Preferences
- Tab bar with active indicator (border-b-2 border-primary)
- Save/Discard footer spans all tabs, always visible
