"""Path configuration and environment loading."""

from __future__ import annotations

import os
from pathlib import Path

# Project root is two levels up from this file (python-server/anki_defs/config.py)
_THIS_DIR = Path(__file__).parent
PROJECT_ROOT = _THIS_DIR.parent.parent

# Shared resources
SHARED_DIR = PROJECT_ROOT / "shared"
PROMPTS_DIR = SHARED_DIR / "prompts"
LANGUAGES_DIR = SHARED_DIR / "languages"
DEFAULTS_DIR = SHARED_DIR / "defaults"
DATA_DIR = SHARED_DIR / "data"

# User config
CONFIG_DIR = Path.home() / ".config" / "anki-defs"
_OLD_CONFIG_DIR = Path.home() / ".config" / "bangla-anki"
SETTINGS_FILE = CONFIG_DIR / "settings.json"
DB_FILE = CONFIG_DIR / "session.db"

# Client dist for static serving
CLIENT_DIST = PROJECT_ROOT / "client" / "dist"


def migrate_config_dir() -> None:
    """Move config from old bangla-anki dir to anki-defs if needed."""
    if _OLD_CONFIG_DIR.is_dir() and not CONFIG_DIR.exists():
        import logging
        import shutil

        log = logging.getLogger(__name__)
        log.info("Migrating config: %s → %s", _OLD_CONFIG_DIR, CONFIG_DIR)
        shutil.move(str(_OLD_CONFIG_DIR), str(CONFIG_DIR))


def load_dotenv() -> None:
    """Load .env.local and .env from project root (simple key=value parsing)."""
    for name in (".env.local", ".env"):
        env_file = PROJECT_ROOT / name
        if not env_file.exists():
            continue
        with open(env_file, encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                if not line or line.startswith("#") or "=" not in line:
                    continue
                key, _, value = line.partition("=")
                key = key.strip()
                value = value.strip().strip("'\"")
                if key and key not in os.environ:
                    os.environ[key] = value
