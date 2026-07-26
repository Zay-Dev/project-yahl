#!/bin/sh
set -eu

if [ -z "${CHROME_PATH:-}" ] && [ -f /opt/chrome-path ]; then
  export CHROME_PATH="$(cat /opt/chrome-path)"
fi

if [ -n "${CHROME_PATH:-}" ]; then
  echo "[worker] CHROME_PATH=$CHROME_PATH"
fi

exec "$@"
