"""Path configuration for the Anki addon.

Provides the same interface as python-server/anki_defs/config.py so that
shared services (_services/) can import from ..config and get addon-specific paths.
"""

from __future__ import annotations

from pathlib import Path

# Resolve symlinks so dev installs (symlinked into Anki addons dir) find
# the repo-relative shared/ directory correctly.
_ADDON_DIR = Path(__file__).resolve().parent

# Shared resources: packaged addon has _shared/ inside addon dir;
# dev install uses repo-relative path (one level up from anki-addon/)
_SHARED_PACKAGED = _ADDON_DIR / "_shared"
_SHARED_REPO = _ADDON_DIR.parent / "shared"
SHARED_DIR = _SHARED_PACKAGED if _SHARED_PACKAGED.is_dir() else _SHARED_REPO
PROMPTS_DIR = SHARED_DIR / "prompts"
DEFAULTS_DIR = SHARED_DIR / "defaults"
LANGUAGES_DIR = SHARED_DIR / "languages"
DATA_DIR = SHARED_DIR / "data"

# User data stored in addon's user_files dir
CONFIG_DIR = _ADDON_DIR / "user_files"
DB_FILE = CONFIG_DIR / "session.db"
SETTINGS_FILE = CONFIG_DIR / "settings.json"  # Not used by addon (uses Anki config)

# Client dist for static serving
CLIENT_DIST = _ADDON_DIR / "web"


def load_dotenv() -> None:
    """No-op for addon (Anki manages its own environment)."""
    pass
