"""Shared fixtures for python-server tests."""

from __future__ import annotations

from pathlib import Path

import pytest


@pytest.fixture(autouse=True)
def _isolated_config(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    """Redirect config/DB paths to temp dir so tests don't touch real data."""
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
