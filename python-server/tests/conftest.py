"""Shared fixtures for python-server tests."""

from __future__ import annotations

from pathlib import Path

import pytest


@pytest.fixture(autouse=True)
def _isolated_config(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    """Redirect config/DB paths to temp dir and mock keyring for tests."""
    config_dir = tmp_path / "config"
    config_dir.mkdir()

    import anki_defs.config as cfg

    monkeypatch.setattr(cfg, "CONFIG_DIR", config_dir)
    monkeypatch.setattr(cfg, "SETTINGS_FILE", config_dir / "settings.json")
    monkeypatch.setattr(cfg, "DB_FILE", config_dir / "session.db")

    # Also patch the references imported into service modules
    import anki_defs.services.session as session_mod
    import anki_defs.services.settings as settings_mod

    monkeypatch.setattr(settings_mod, "CONFIG_DIR", config_dir)
    monkeypatch.setattr(settings_mod, "SETTINGS_FILE", config_dir / "settings.json")
    monkeypatch.setattr(session_mod, "CONFIG_DIR", config_dir)
    monkeypatch.setattr(session_mod, "DB_FILE", config_dir / "session.db")

    # Reset session DB singleton so each test gets a fresh DB
    session_mod._db = None

    # Reset settings caches so tests don't bleed
    settings_mod._defaults = None
    settings_mod._cached_file_settings = None
    settings_mod._cached_mtime = 0

    # Mock keyring with an in-memory store so tests don't need a real backend
    _store: dict[str, dict[str, str]] = {}

    def _mock_get(service: str, key: str) -> str | None:
        return _store.get(service, {}).get(key)

    def _mock_set(service: str, key: str, value: str) -> None:
        _store.setdefault(service, {})[key] = value

    def _mock_delete(service: str, key: str) -> None:
        import keyring.errors

        if service in _store and key in _store[service]:
            del _store[service][key]
        else:
            raise keyring.errors.PasswordDeleteError(key)

    import keyring

    monkeypatch.setattr(keyring, "get_password", _mock_get)
    monkeypatch.setattr(keyring, "set_password", _mock_set)
    monkeypatch.setattr(keyring, "delete_password", _mock_delete)
