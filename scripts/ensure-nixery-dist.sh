#!/usr/bin/env bash
set -euo pipefail

PRODUCT_DIR="${PRODUCT_DIR:-/opt/yahl/omniflex/project-yahl}"
NIXERY_ROOT="${1:-$PRODUCT_DIR/server/nixery}"
WIKI_LIB="$NIXERY_ROOT/knowledge-wiki/lib"
TSCONFIG="$WIKI_LIB/tsconfig.json"
WIKI_DIST="$WIKI_LIB/dist"

CONSUMER_PLUGINS=(notify greets whatsapp planning)

if [[ ! -f "$TSCONFIG" ]]; then
  echo "missing knowledge-wiki tsconfig: $TSCONFIG" >&2
  exit 1
fi

run_tsc() {
  local compile_cmd
  compile_cmd=$(cat <<'EOF'
set -euo pipefail
npm init -y >/dev/null
npm install --no-save --no-fund --no-audit typescript@5.8.3 @types/node@22.15.29 >/dev/null
./node_modules/.bin/tsc -p tsconfig.json
rm -rf node_modules package.json package-lock.json
EOF
)

  if command -v npm >/dev/null 2>&1; then
    (cd "$WIKI_LIB" && bash -c "$compile_cmd")
    return
  fi

  if ! command -v docker >/dev/null 2>&1; then
    echo "npm and docker unavailable; cannot build nixery lib/dist" >&2
    exit 1
  fi

  docker run --rm \
    -v "$WIKI_LIB:/app" \
    -w /app \
    node:24 \
    bash -c "$compile_cmd"
}

echo "building nixery knowledge-wiki lib/dist"
run_tsc

if [[ ! -f "$WIKI_DIST/index.js" ]]; then
  echo "tsc finished but missing $WIKI_DIST/index.js" >&2
  exit 1
fi

for plugin in "${CONSUMER_PLUGINS[@]}"; do
  dest="$NIXERY_ROOT/$plugin/lib/dist"
  mkdir -p "$(dirname "$dest")"
  rm -rf "$dest"
  mkdir -p "$dest"
  if command -v rsync >/dev/null 2>&1; then
    rsync -a --delete "$WIKI_DIST/" "$dest/"
  else
    cp -R "$WIKI_DIST/." "$dest/"
  fi
  echo "synced lib/dist → $plugin"
done

echo "nixery lib/dist ok"
