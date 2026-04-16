#!/usr/bin/env bash
# Install the anki-defs add-on for development by symlinking into Anki's addons dir.
#
# Steps:
#   1. Build the React frontend
#   2. Copy client/dist/* into anki-addon/web/
#   3. Copy shared services from python-server into anki-addon/_services/
#   4. Install httpx into anki-addon/_vendor/
#   5. Symlink anki-addon/ into ~/.local/share/Anki2/addons21/anki_defs
#
# After running, restart Anki to load the add-on. Code changes to Python files
# take effect on Anki restart (no reinstall needed). Frontend changes require
# re-running this script or manually copying client/dist/ to anki-addon/web/.
#
# Usage: ./scripts/install-dev.sh

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
ADDON_DIR="$ROOT/anki-addon"
ADDONS_DIR="${ANKI_ADDONS_DIR:-$HOME/.local/share/Anki2/addons21}"
LINK_NAME="anki_defs"
LINK_PATH="$ADDONS_DIR/$LINK_NAME"

# Detect repo owner so files stay owned by the dev user, not the runner
REPO_OWNER="$(stat -c '%U:%G' "$ROOT")"

if [ ! -d "$ADDONS_DIR" ]; then
    echo "Error: Anki addons directory not found: $ADDONS_DIR"
    echo "Set ANKI_ADDONS_DIR if your Anki data is in a non-standard location."
    exit 1
fi

echo "==> Building React frontend..."
cd "$ROOT"
npm run build:client

# Helper: remove a path, falling back to sudo if Anki (running as another
# user) has written __pycache__ files we can't delete directly.
force_rm() {
    local target="$1"
    [ -e "$target" ] || return 0
    rm -rf "$target" 2>/dev/null && return 0
    echo "   (needs sudo to remove $target -- owned by another user)"
    sudo rm -rf "$target"
}

echo "==> Copying frontend build to anki-addon/web/..."
force_rm "$ADDON_DIR/web"
cp -r "$ROOT/client/dist" "$ADDON_DIR/web"

echo "==> Copying shared services from python-server..."
force_rm "$ADDON_DIR/_services"
cp -r "$ROOT/python-server/anki_defs/services" "$ADDON_DIR/_services"
cp "$ADDON_DIR/_services_settings_wrapper.py" "$ADDON_DIR/_services/settings.py"
rm -f "$ADDON_DIR/_services/anki_connect.py"
# Rewrite relative parent imports to absolute package imports.
find "$ADDON_DIR/_services" -name '*.py' -exec \
    sed -i 's/from \.\.config import/from anki_defs.config import/' {} +

echo "==> Installing httpx, keyring, and bottle into _vendor/..."
force_rm "$ADDON_DIR/_vendor"
pip install httpx keyring bottle --target "$ADDON_DIR/_vendor" --quiet --no-cache-dir 2>/dev/null || \
    uv pip install httpx keyring bottle --target "$ADDON_DIR/_vendor" --quiet 2>/dev/null || \
    python3 -m pip install httpx keyring bottle --target "$ADDON_DIR/_vendor" --quiet --no-cache-dir
find "$ADDON_DIR/_vendor" -type d -name '__pycache__' -exec rm -rf {} + 2>/dev/null || true

# Fix ownership: generated dirs should be owned by the repo owner so the dev
# user can manage them (e.g. git stash, vite rebuild). Needs sudo when running
# as another user.
if [ "$(whoami)" != "$(stat -c '%U' "$ROOT")" ]; then
    echo "==> Fixing ownership of generated files..."
    sudo chown -R "$REPO_OWNER" \
        "$ROOT/client/dist" \
        "$ADDON_DIR/web" \
        "$ADDON_DIR/_services" \
        "$ADDON_DIR/_vendor"
fi

echo "==> Symlinking addon into Anki..."
if [ -L "$LINK_PATH" ]; then
    echo "   Removing existing symlink: $LINK_PATH"
    rm "$LINK_PATH"
elif [ -d "$LINK_PATH" ]; then
    echo "   Warning: $LINK_PATH is a directory, not a symlink."
    echo "   Remove it manually if you want to replace it with a dev symlink."
    exit 1
fi

ln -s "$ADDON_DIR" "$LINK_PATH"
echo "==> Installed: $LINK_PATH -> $ADDON_DIR"
echo "   Restart Anki to load the add-on."
