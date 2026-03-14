# Settings Unification

Unify settings handling across python-server and anki-addon so they share
the same keyring/fallback/consent logic with minimal platform-specific glue.

## Problem

The addon hardening work revealed that keyring, D-Bus, fallback storage,
and consent flows were implemented separately in each backend. This led to:

- D-Bus fix duplicated in `anki-addon/__init__.py` and `python-server/config.py`
- Keyring fallback logic duplicated in both `settings_service.py` and `settings.py`
- Consent flow only in the addon, not the python-server
- `_keyringAvailable` only returned by addon routes, not python-server routes
- Error handling differences between the two

## Design

### Shared layer (`_services/settings_base.py`)

Move keyring probe, read/write with fallback, consent tracking, and masking
into a shared base module. Each backend provides a thin adapter:

```
_services/settings_base.py     — keyring probe, _read_secret, _write_secret,
                                  mask_key, keyring_available, consent logic
                                  (platform-agnostic, no aqt or file paths)

python-server/services/settings.py  — imports base, adds file-based config,
                                       env overrides, CONFIG_DIR paths

anki-addon/services/settings_service.py — imports base, adds mw.addonManager
                                           config, Anki-specific paths
```

### What goes in base vs adapter

**Base (shared):**

- `_KEYRING_SERVICE`, `_SECRET_FIELDS` constants
- `keyring_available()`, `has_insecure_consent()`, `set_insecure_consent()`
- `_read_secret(field, fallback_read_fn)` — tries keyring, calls fallback
- `_write_secret(field, value, fallback_write_fn)` — tries keyring, calls fallback
- `mask_key(key)`, `get_masked_settings(settings)`

**Adapter (per-platform):**

- Config storage (file vs mw.addonManager)
- Defaults loading (path resolution)
- `get_settings()` — merge order
- `save_settings()` — write routing
- Fallback read/write functions passed to base

### Routes

Both backends should return `_keyringAvailable` and `_insecureStorageConsent`
from GET /settings and handle the consent flow on PUT /settings. This logic
should be in a shared route helper or in the settings service itself.

## Also needed (from today's session)

- **Error modal**: Surface backend errors in a modal with copyable debug info
- **Logging strategy**: Replace `print()` with Python `logging` module,
  add structured browser console logging with levels
- **Settings tabs**: Split the long settings list into tabs (AI Provider,
  Anki Integration, Display preferences)

## Files to modify

| File                                                     | Changes                              |
| -------------------------------------------------------- | ------------------------------------ |
| New: `python-server/anki_defs/services/settings_base.py` | Shared keyring/consent logic         |
| `python-server/anki_defs/services/settings.py`           | Thin adapter over base               |
| `anki-addon/services/settings_service.py`                | Thin adapter over base               |
| `python-server/anki_defs/routes/settings.py`             | Add keyring status + consent         |
| `anki-addon/handlers/settings_routes.py`                 | Use shared consent logic             |
| `scripts/build-addon.sh`                                 | Copy settings_base.py to \_services/ |
