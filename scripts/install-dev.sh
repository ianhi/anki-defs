#!/usr/bin/env bash
# Install the anki-defs add-on for development by symlinking into Anki's addons dir.
#
# Steps:
#   1. Build the React frontend
#   2. Copy client/dist/* into anki-addon/web/
#   3. Symlink anki-addon/ into ~/.local/share/Anki2/addons21/anki_defs
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

if [ ! -d "$ADDONS_DIR" ]; then
    echo "Error: Anki addons directory not found: $ADDONS_DIR"
    echo "Set ANKI_ADDONS_DIR if your Anki data is in a non-standard location."
    exit 1
fi

echo "==> Building React frontend..."
cd "$ROOT"
npm run build:client

echo "==> Copying frontend build to anki-addon/web/..."
rm -rf "$ADDON_DIR/web"
cp -r "$ROOT/client/dist" "$ADDON_DIR/web"

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
