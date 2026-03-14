"""Path configuration and environment loading."""

from __future__ import annotations

import os
import sys
from pathlib import Path

# Ensure D-Bus session address is set so the keyring SecretService backend
# can connect. Desktop sessions always have this socket but some environments
# (e.g. SSH, cron, systemd services) don't export the env var.
if sys.platform == "linux" and not os.environ.get("DBUS_SESSION_BUS_ADDRESS"):
    _bus = f"/run/user/{os.getuid()}/bus"
    if os.path.exists(_bus):
        os.environ["DBUS_SESSION_BUS_ADDRESS"] = f"unix:path={_bus}"

# Project root is two levels up from this file (python-server/anki_defs/config.py)
_THIS_DIR = Path(__file__).parent
PROJECT_ROOT = _THIS_DIR.parent.parent

# Shared resources
SHARED_DIR = PROJECT_ROOT / "shared"
PROMPTS_DIR = SHARED_DIR / "prompts"
DEFAULTS_DIR = SHARED_DIR / "defaults"

# User config
CONFIG_DIR = Path.home() / ".config" / "bangla-anki"
SETTINGS_FILE = CONFIG_DIR / "settings.json"
DB_FILE = CONFIG_DIR / "session.db"

# Client dist for static serving
CLIENT_DIST = PROJECT_ROOT / "client" / "dist"


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
