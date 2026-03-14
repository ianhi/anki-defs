"""Test configuration.

Sets up imports so test files can import add-on submodules (server/, services/)
without triggering __init__.py (which imports aqt and requires a running Anki).
"""

import os
import sys
import types

# Add the anki-addon dir to sys.path so `server`, `handlers`, `services`
# can be imported as top-level packages in tests.
addon_dir = os.path.dirname(os.path.dirname(__file__))
if addon_dir not in sys.path:
    sys.path.insert(0, addon_dir)

# Also add vendor dir for httpx
vendor_dir = os.path.join(addon_dir, "_vendor")
if os.path.isdir(vendor_dir) and vendor_dir not in sys.path:
    sys.path.insert(0, vendor_dir)

# Register addon dir as `anki_defs` package so absolute imports like
# `from anki_defs.config import ...` and `from anki_defs._services.ai import ...` work.
# This is the same package name Anki uses when loading the addon.
if "anki_defs" not in sys.modules:
    _pkg = types.ModuleType("anki_defs")
    _pkg.__path__ = [addon_dir]  # type: ignore[attr-defined]
    _pkg.__package__ = "anki_defs"
    sys.modules["anki_defs"] = _pkg

# Mock aqt before anything tries to import it (prevents segfault from Qt init)

_mock_mw = types.SimpleNamespace(
    col=None,
    addonManager=types.SimpleNamespace(
        getConfig=lambda name: {},
        writeConfig=lambda name, config: None,
    ),
    taskman=types.SimpleNamespace(
        run_on_main=lambda fn: fn(),
    ),
    form=types.SimpleNamespace(
        menuTools=types.SimpleNamespace(addAction=lambda action: None),
    ),
    on_sync_button_clicked=lambda: None,
)

_mock_aqt = types.ModuleType("aqt")
_mock_aqt.mw = _mock_mw  # type: ignore[attr-defined]

_mock_gui_hooks = types.ModuleType("aqt.gui_hooks")
_mock_gui_hooks.profile_did_open = types.SimpleNamespace(append=lambda fn: None)  # type: ignore[attr-defined]
_mock_gui_hooks.profile_will_close = types.SimpleNamespace(append=lambda fn: None)  # type: ignore[attr-defined]

_mock_qt = types.ModuleType("aqt.qt")
_mock_qt.QAction = lambda *a, **kw: types.SimpleNamespace(
    triggered=types.SimpleNamespace(connect=lambda fn: None)
)  # type: ignore[attr-defined]
_mock_qt.QTimer = type(
    "QTimer",
    (),
    {
        "timeout": property(lambda s: types.SimpleNamespace(connect=lambda fn: None)),
        "start": lambda s, ms: None,
        "stop": lambda s: None,
    },
)  # type: ignore[attr-defined]
_mock_qt.qconnect = lambda *a: None  # type: ignore[attr-defined]

_mock_utils = types.ModuleType("aqt.utils")
_mock_utils.showWarning = lambda msg: None  # type: ignore[attr-defined]

sys.modules["aqt"] = _mock_aqt
sys.modules["aqt.gui_hooks"] = _mock_gui_hooks
sys.modules["aqt.qt"] = _mock_qt
sys.modules["aqt.utils"] = _mock_utils

# Also mock anki if not already available
if "anki" not in sys.modules:
    sys.modules["anki"] = types.ModuleType("anki")
    sys.modules["anki.cards"] = types.ModuleType("anki.cards")
