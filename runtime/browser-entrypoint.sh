#!/bin/sh
set -eu

if [ -z "${CHROME_PATH:-}" ] && [ -f /opt/chrome-path ]; then
  CHROME_PATH="$(cat /opt/chrome-path)"
fi

if [ -z "${CHROME_PATH:-}" ] || [ ! -x "${CHROME_PATH}" ]; then
  echo "[browser] FATAL: CHROME_PATH not executable: ${CHROME_PATH:-<empty>}" >&2
  exit 1
fi

export DISPLAY="${BROWSER_DISPLAY:-:99}"
USER_DATA_DIR="${BROWSER_USER_DATA_DIR:-/chrome-profile}"

mkdir -p "$USER_DATA_DIR"

Xvfb "$DISPLAY" -screen 0 1280x720x24 &
sleep 1
x11vnc -display "$DISPLAY" -forever -shared -nopw -noxdamage -rfbport 5900 &
echo "[browser] live view: VNC on :5900 (DISPLAY=$DISPLAY)"

# Chromium binds DevTools to 127.0.0.1; socat exposes CDP to network peers on 9222.
socat TCP-LISTEN:9222,bind=0.0.0.0,reuseaddr,fork TCP:127.0.0.1:9223 &
echo "[browser] CDP on 0.0.0.0:9222 → 127.0.0.1:9223 CHROME_PATH=$CHROME_PATH"

exec "$CHROME_PATH" \
  --no-sandbox \
  --disable-setuid-sandbox \
  --disable-dev-shm-usage \
  --disable-gpu \
  --ozone-platform=x11 \
  --remote-debugging-port=9223 \
  --remote-allow-origins=* \
  --user-data-dir="$USER_DATA_DIR" \
  about:blank
