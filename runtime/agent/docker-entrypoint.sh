#!/bin/sh
set -eu

export NO_PROXY="${NO_PROXY:-localhost,127.0.0.1,::1,redis,server,mongo,onecli,host.docker.internal}"
export no_proxy="${no_proxy:-$NO_PROXY}"

if [ -z "${CHROME_PATH:-}" ] && [ -f /opt/chrome-path ]; then
  export CHROME_PATH="$(cat /opt/chrome-path)"
fi

if [ -z "${CHROME_PATH:-}" ]; then
  export CHROME_PATH="$(node ./agent/resolve-chrome-path.cjs)"
fi

if [ ! -x "${CHROME_PATH}" ]; then
  echo "[stagehand] FATAL: CHROME_PATH not executable: ${CHROME_PATH}" >&2
  echo "[stagehand] Hint: rebuild agent image after Dockerfile changes" >&2
  exit 1
fi

if [ -n "${AGENT_SESSION_HOME:-}" ]; then
  mkdir -p "$AGENT_SESSION_HOME"
  export HOME="$AGENT_SESSION_HOME"
fi

if [ "${STAGEHAND_LIVEVIEW:-0}" = "1" ] || [ "${STAGEHAND_LIVEVIEW:-}" = "true" ]; then
  export DISPLAY="${STAGEHAND_LIVEVIEW_DISPLAY:-:99}"
  Xvfb "$DISPLAY" -screen 0 1280x720x24 &
  sleep 1
  x11vnc -display "$DISPLAY" -forever -shared -nopw -noxdamage -rfbport 5900 &
  echo "[stagehand] live view: connect VNC to localhost:5900 (DISPLAY=$DISPLAY)"
fi

if [ -n "${CHROME_PATH:-}" ]; then
  echo "[stagehand] CHROME_PATH=$CHROME_PATH"
fi

exec "$@"
