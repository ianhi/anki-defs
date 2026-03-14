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

## Follow-up tasks (separate PRs)

### Error Modal Component

- New `ErrorModal.tsx` with copyable debug info
- Global error state (Zustand store)
- Replace inline error text throughout

### Logging Strategy

- Python: replace `print()` with `logging` module, logger per module
- Frontend: `logger.ts` wrapper with configurable levels

### Settings Tabs

- Three tabs: AI Provider | Anki | Preferences
- Tab state in component, save footer spans all tabs
