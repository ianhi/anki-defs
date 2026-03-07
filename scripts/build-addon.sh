#!/usr/bin/env bash
# Build the anki-defs Anki add-on package (.ankiaddon).
#
# Steps:
#   1. Build the React frontend (npm run build:client)
#   2. Copy client/dist/* into anki-addon/web/
#   3. Copy shared/ data (prompts, defaults) into anki-addon/shared/
#   4. Zip into anki-defs.ankiaddon (excluding dev files)
#
# The resulting .ankiaddon can be installed via Anki: Tools > Add-ons > Install from file.
#
# Usage: ./scripts/build-addon.sh

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
ADDON_DIR="$ROOT/anki-addon"
OUTPUT="$ROOT/anki-defs.ankiaddon"

echo "==> Building React frontend..."
cd "$ROOT"
npm run build:client

echo "==> Copying frontend build to anki-addon/web/..."
rm -rf "$ADDON_DIR/web"
cp -r "$ROOT/client/dist" "$ADDON_DIR/web"

echo "==> Copying shared data into addon package..."
# The addon reads prompts from ../../shared/ relative to its services/ dir.
# For packaging, we copy shared/ into the addon and the path resolution
# still works: anki-addon/services/ -> ../../shared/ = shared/ (at repo root).
# But in a packaged addon installed to ~/.local/share/Anki2/addons21/,
# there is no repo root. So we copy shared/ INTO the addon dir and
# the relative path from services/ becomes ../shared/.
mkdir -p "$ADDON_DIR/_shared/prompts" "$ADDON_DIR/_shared/defaults"
cp "$ROOT/shared/prompts/"*.json "$ADDON_DIR/_shared/prompts/"
cp "$ROOT/shared/defaults/"*.json "$ADDON_DIR/_shared/defaults/"

echo "==> Creating $OUTPUT..."
rm -f "$OUTPUT"
cd "$ADDON_DIR"
zip -r "$OUTPUT" . \
    -x '__pycache__/*' \
    -x '*/__pycache__/*' \
    -x '*.pyc' \
    -x '.venv/*' \
    -x '.mypy_cache/*' \
    -x '.ruff_cache/*' \
    -x '.pytest_cache/*' \
    -x 'tests/*' \
    -x 'pyproject.toml' \
    -x 'uv.lock' \
    -x '.gitignore'

echo "==> Built: $OUTPUT ($(du -h "$OUTPUT" | cut -f1))"
echo "   Install via Anki: Tools > Add-ons > Install from file"
