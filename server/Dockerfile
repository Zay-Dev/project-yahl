FROM node:22-bookworm AS base

ARG OMNIFLEX_APP_DIR=project-yahl

WORKDIR /omniflex

RUN corepack enable

FROM node:22-bookworm-slim AS docker-tools

RUN apt-get update \
  && apt-get install -y --no-install-recommends ca-certificates curl gnupg \
  && install -m 0755 -d /etc/apt/keyrings \
  && curl -fsSL https://download.docker.com/linux/debian/gpg -o /etc/apt/keyrings/docker.asc \
  && chmod a+r /etc/apt/keyrings/docker.asc \
  && echo \
  "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/debian \
  $(. /etc/os-release && echo \"$VERSION_CODENAME\") stable" \
  > /etc/apt/sources.list.d/docker.list \
  && apt-get update \
  && apt-get install -y --no-install-recommends docker-ce-cli docker-compose-plugin docker-buildx-plugin \
  && rm -rf /var/lib/apt/lists/*

FROM base AS deps

ARG OMNIFLEX_APP_DIR=project-yahl

COPY package.json pnpm-workspace.yaml pnpm-lock.yaml tsconfig.infras.json ./
COPY infras ./infras
COPY ${OMNIFLEX_APP_DIR}/package.json ./${OMNIFLEX_APP_DIR}/
COPY ${OMNIFLEX_APP_DIR}/shared/package.json ./${OMNIFLEX_APP_DIR}/shared/
COPY ${OMNIFLEX_APP_DIR}/server/package.json ./${OMNIFLEX_APP_DIR}/server/
COPY ${OMNIFLEX_APP_DIR}/runtime/package.json ./${OMNIFLEX_APP_DIR}/runtime/

RUN pnpm install --frozen-lockfile \
  --filter @project-yahl/server... \
  --filter @project-yahl/runtime...

FROM deps AS build

ARG OMNIFLEX_APP_DIR=project-yahl

COPY ${OMNIFLEX_APP_DIR}/shared ./${OMNIFLEX_APP_DIR}/shared
COPY ${OMNIFLEX_APP_DIR}/server/src ./${OMNIFLEX_APP_DIR}/server/src
COPY ${OMNIFLEX_APP_DIR}/server/tsconfig.json ./${OMNIFLEX_APP_DIR}/server/tsconfig.json
COPY ${OMNIFLEX_APP_DIR}/runtime ./${OMNIFLEX_APP_DIR}/runtime
COPY ${OMNIFLEX_APP_DIR}/docker-compose.yml ./${OMNIFLEX_APP_DIR}/docker-compose.yml
COPY ${OMNIFLEX_APP_DIR}/docker-compose.agent.yml ./${OMNIFLEX_APP_DIR}/docker-compose.agent.yml

RUN pnpm --filter @project-yahl/shared run build \
  && pnpm --filter @project-yahl/server... run build \
  && pnpm --filter @project-yahl/runtime run build

FROM docker-tools AS prod

ARG OMNIFLEX_APP_DIR=project-yahl

WORKDIR /omniflex

COPY --from=build /omniflex/node_modules ./node_modules
COPY --from=build /omniflex/infras ./infras
COPY --from=build /omniflex/package.json ./package.json
COPY --from=build /omniflex/pnpm-workspace.yaml ./pnpm-workspace.yaml
COPY --from=build /omniflex/pnpm-lock.yaml ./pnpm-lock.yaml
COPY --from=build /omniflex/${OMNIFLEX_APP_DIR}/package.json ./${OMNIFLEX_APP_DIR}/package.json
COPY --from=build /omniflex/${OMNIFLEX_APP_DIR}/docker-compose.agent.yml ./${OMNIFLEX_APP_DIR}/docker-compose.agent.yml
COPY --from=build /omniflex/${OMNIFLEX_APP_DIR}/docker-compose.yml ./${OMNIFLEX_APP_DIR}/docker-compose.yml
COPY --from=build /omniflex/${OMNIFLEX_APP_DIR}/server/package.json ./${OMNIFLEX_APP_DIR}/server/package.json
COPY --from=build /omniflex/${OMNIFLEX_APP_DIR}/server/dist ./${OMNIFLEX_APP_DIR}/server/dist
COPY --from=build /omniflex/${OMNIFLEX_APP_DIR}/server/node_modules ./${OMNIFLEX_APP_DIR}/server/node_modules
COPY --from=build /omniflex/${OMNIFLEX_APP_DIR}/shared ./${OMNIFLEX_APP_DIR}/shared
COPY --from=build /omniflex/${OMNIFLEX_APP_DIR}/runtime/dist ./${OMNIFLEX_APP_DIR}/runtime/dist
COPY --from=build /omniflex/${OMNIFLEX_APP_DIR}/runtime/package.json ./${OMNIFLEX_APP_DIR}/runtime/
COPY --from=build /omniflex/${OMNIFLEX_APP_DIR}/runtime/node_modules ./${OMNIFLEX_APP_DIR}/runtime/node_modules
COPY --from=build /omniflex/${OMNIFLEX_APP_DIR}/runtime/Dockerfile.agent ./${OMNIFLEX_APP_DIR}/runtime/
COPY --from=build /omniflex/${OMNIFLEX_APP_DIR}/runtime/tsconfig.json ./${OMNIFLEX_APP_DIR}/runtime/tsconfig.json
COPY --from=build /omniflex/${OMNIFLEX_APP_DIR}/runtime/agent ./${OMNIFLEX_APP_DIR}/runtime/agent
COPY --from=build /omniflex/${OMNIFLEX_APP_DIR}/runtime/orchestrator ./${OMNIFLEX_APP_DIR}/runtime/orchestrator
COPY --from=build /omniflex/${OMNIFLEX_APP_DIR}/runtime/shared ./${OMNIFLEX_APP_DIR}/runtime/shared

WORKDIR /omniflex/${OMNIFLEX_APP_DIR}/server

ENV NODE_ENV=production
ENV OMNIFLEX_APP_DIR=${OMNIFLEX_APP_DIR}
ENV RUNTIME_REPO_ROOT=/omniflex/${OMNIFLEX_APP_DIR}/runtime

EXPOSE 4000

CMD ["node", "dist/src/index.js"]
