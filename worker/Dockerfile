FROM node:22

ARG OMNIFLEX_APP_DIR=project-yahl

WORKDIR /omniflex

RUN corepack enable

COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY ${OMNIFLEX_APP_DIR}/package.json ./${OMNIFLEX_APP_DIR}/
COPY ${OMNIFLEX_APP_DIR}/mastermind/package.json ./${OMNIFLEX_APP_DIR}/mastermind/
COPY ${OMNIFLEX_APP_DIR}/worker/package.json ./${OMNIFLEX_APP_DIR}/worker/
COPY ${OMNIFLEX_APP_DIR}/runtime/package.json ./${OMNIFLEX_APP_DIR}/runtime/

RUN pnpm install --frozen-lockfile --filter @project-yahl/worker...

COPY ${OMNIFLEX_APP_DIR}/worker ./${OMNIFLEX_APP_DIR}/worker
COPY ${OMNIFLEX_APP_DIR}/mastermind/contract ./${OMNIFLEX_APP_DIR}/mastermind/contract
COPY ${OMNIFLEX_APP_DIR}/runtime/orchestrator ./${OMNIFLEX_APP_DIR}/runtime/orchestrator
COPY ${OMNIFLEX_APP_DIR}/runtime/shared ./${OMNIFLEX_APP_DIR}/runtime/shared
COPY ${OMNIFLEX_APP_DIR}/runtime/tsconfig.json ./${OMNIFLEX_APP_DIR}/runtime/tsconfig.json

WORKDIR /omniflex/${OMNIFLEX_APP_DIR}/worker

CMD ["pnpm", "run", "dev"]
