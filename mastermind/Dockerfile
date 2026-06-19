FROM node:22

ARG OMNIFLEX_APP_DIR=project-yahl

WORKDIR /omniflex

RUN corepack enable

COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY ${OMNIFLEX_APP_DIR}/package.json ./${OMNIFLEX_APP_DIR}/
COPY ${OMNIFLEX_APP_DIR}/mastermind/package.json ./${OMNIFLEX_APP_DIR}/mastermind/

RUN pnpm install --frozen-lockfile --filter @project-yahl/mastermind...

COPY ${OMNIFLEX_APP_DIR}/mastermind ./${OMNIFLEX_APP_DIR}/mastermind

WORKDIR /omniflex/${OMNIFLEX_APP_DIR}/mastermind

CMD ["pnpm", "run", "dev"]
