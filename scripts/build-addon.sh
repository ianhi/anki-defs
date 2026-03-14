#!/usr/bin/env bash
# Build the anki-defs Anki add-on package (.ankiaddon).
#
# Steps:
#   1. Build the React frontend (npm run build:client)
#   2. Copy client/dist/* into anki-addon/web/
#   3. Copy shared/ data (prompts, defaults) into anki-addon/_shared/
#   4. Copy python-server shared services into anki-addon/_services/
#   5. Bundle httpx + deps into anki-addon/_vendor/
#   6. Zip into anki-defs.ankiaddon (excluding dev files)
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
mkdir -p "$ADDON_DIR/_shared/prompts" "$ADDON_DIR/_shared/defaults" "$ADDON_DIR/_shared/data"
cp "$ROOT/shared/prompts/"*.json "$ADDON_DIR/_shared/prompts/"
cp "$ROOT/shared/defaults/"*.json "$ADDON_DIR/_shared/defaults/"
cp "$ROOT/shared/data/"*.json "$ADDON_DIR/_shared/data/"

echo "==> Copying shared services from python-server..."
rm -rf "$ADDON_DIR/_services"
cp -r "$ROOT/python-server/anki_defs/services" "$ADDON_DIR/_services"
# Replace settings.py with addon-specific wrapper
cp "$ADDON_DIR/_services_settings_wrapper.py" "$ADDON_DIR/_services/settings.py"
# Remove anki_connect.py (addon uses direct mw.col access, not AnkiConnect HTTP)
rm -f "$ADDON_DIR/_services/anki_connect.py"
# Rewrite `from ..config import` to `from config import` (addon's config.py is at package root)
find "$ADDON_DIR/_services" -name '*.py' -exec \
    sed -i 's/from \.\.config import/from config import/' {} +

echo "==> Bundling httpx and dependencies..."
rm -rf "$ADDON_DIR/_vendor"
pip install httpx --target "$ADDON_DIR/_vendor" --quiet --no-cache-dir 2>/dev/null || \
    uv pip install httpx --target "$ADDON_DIR/_vendor" --quiet 2>/dev/null || \
    python3 -m pip install httpx --target "$ADDON_DIR/_vendor" --quiet --no-cache-dir
# Clean up unnecessary files from vendor
find "$ADDON_DIR/_vendor" -type d -name '__pycache__' -exec rm -rf {} + 2>/dev/null || true
find "$ADDON_DIR/_vendor" -name '*.dist-info' -exec rm -rf {} + 2>/dev/null || true

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
    -x '.gitignore' \
    -x '_services_settings_wrapper.py'

echo "==> Built: $OUTPUT ($(du -h "$OUTPUT" | cut -f1))"
echo "   Install via Anki: Tools > Add-ons > Install from file"
