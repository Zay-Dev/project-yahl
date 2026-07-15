FROM node:22

ARG OMNIFLEX_APP_DIR=project-yahl

WORKDIR /omniflex

RUN apt-get update \
  && apt-get install -y curl ca-certificates git \
  && rm -rf /var/lib/apt/lists/* \
  && curl -fsSL https://cursor.com/install | bash \
  && cp -a /root/.local/share/cursor-agent /opt/cursor-agent \
  && AGENT_BIN="$(find /opt/cursor-agent/versions -name cursor-agent -type f | head -1)" \
  && test -n "$AGENT_BIN" \
  && ln -sf "$AGENT_BIN" /usr/local/bin/agent \
  && ln -sf "$AGENT_BIN" /usr/local/bin/cursor-agent

ENV PATH="/usr/local/bin:${PATH}"

RUN corepack enable

COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY ${OMNIFLEX_APP_DIR}/package.json ./${OMNIFLEX_APP_DIR}/
COPY ${OMNIFLEX_APP_DIR}/shared/package.json ./${OMNIFLEX_APP_DIR}/shared/
COPY ${OMNIFLEX_APP_DIR}/worker/package.json ./${OMNIFLEX_APP_DIR}/worker/

RUN pnpm install --frozen-lockfile --filter @project-yahl/worker...

COPY ${OMNIFLEX_APP_DIR}/shared ./${OMNIFLEX_APP_DIR}/shared
COPY ${OMNIFLEX_APP_DIR}/worker ./${OMNIFLEX_APP_DIR}/worker

WORKDIR /omniflex/${OMNIFLEX_APP_DIR}/worker

CMD ["pnpm", "run", "dev"]
