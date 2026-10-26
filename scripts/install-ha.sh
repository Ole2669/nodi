#!/usr/bin/env bash
set -euo pipefail

TARGET_HOST="${1:?Usage: $0 user@host /path/to/ha/config}"
TARGET_CONFIG="${2:?Usage: $0 user@host /path/to/ha/config}"

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SRC="$ROOT/custom_components/nodi"
DEST="$TARGET_CONFIG/custom_components/nodi"
CONTAINER="${NODI_HA_CONTAINER:-homeassistant}"

rm -rf "$SRC"/__pycache__ 2>/dev/null || true
find "$SRC" -type d -name '__pycache__' -exec rm -rf {} + 2>/dev/null || true

echo "-> Removing old install in container (incl. root __pycache__)…"
ssh "$TARGET_HOST" "docker exec '$CONTAINER' rm -rf /config/custom_components/nodi 2>/dev/null || true"
ssh "$TARGET_HOST" "mkdir -p '$TARGET_CONFIG/custom_components'"

echo "-> Copying files…"
if command -v rsync >/dev/null 2>&1; then
  rsync -a \
    --exclude '__pycache__/' \
    --exclude '*.pyc' \
    --exclude '.DS_Store' \
    "$SRC/" "$TARGET_HOST:$DEST/"
else
  tar -C "$SRC" --exclude='__pycache__' --exclude='*.pyc' -cf - . \
    | ssh "$TARGET_HOST" "mkdir -p '$DEST' && tar -C '$DEST' -xf -"
fi

ssh "$TARGET_HOST" "ls -la '$DEST' && test -f '$DEST/manifest.json' && test -f '$DEST/__init__.py'"
echo "Installed to $TARGET_HOST:$DEST"
echo "Next: ssh $TARGET_HOST 'docker restart $CONTAINER'"
