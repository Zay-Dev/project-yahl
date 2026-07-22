ARG NIXERY_BASE
FROM ${NIXERY_BASE} AS nixery_tools
FROM node:22-bookworm
RUN apt-get update -qq \
  && apt-get install -y -qq curl ca-certificates \
  && curl -fsSL https://cursor.com/install | bash \
  && mkdir -p /opt/cursor-agent \
  && cp -a /root/.local/share/cursor-agent/. /opt/cursor-agent/ \
  && AGENT_BIN="$(find /opt/cursor-agent/versions -name cursor-agent -type f | head -1)" \
  && test -n "$AGENT_BIN" \
  && REL="versions/$(basename "$(dirname "$AGENT_BIN")")/cursor-agent" \
  && ln -sfn "$REL" /opt/cursor-agent/cursor-agent \
  && ln -sfn "$REL" /opt/cursor-agent/agent \
  && chmod +x "$AGENT_BIN" /opt/cursor-agent/cursor-agent /opt/cursor-agent/agent \
  && rm -rf /var/lib/apt/lists/*
ENV PATH="/opt/cursor-agent:${PATH}"
