FROM node:22

ARG OMNIFLEX_APP_DIR=project-yahl

WORKDIR /omniflex

RUN corepack enable

COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY ${OMNIFLEX_APP_DIR}/package.json ./${OMNIFLEX_APP_DIR}/
COPY ${OMNIFLEX_APP_DIR}/llm-proxy/package.json ./${OMNIFLEX_APP_DIR}/llm-proxy/

RUN pnpm install --frozen-lockfile --filter @project-yahl/llm-proxy...

COPY ${OMNIFLEX_APP_DIR}/llm-proxy ./${OMNIFLEX_APP_DIR}/llm-proxy

WORKDIR /omniflex/${OMNIFLEX_APP_DIR}/llm-proxy

CMD ["pnpm", "run", "dev"]
