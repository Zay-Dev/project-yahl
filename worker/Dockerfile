FROM node:22

ARG OMNIFLEX_APP_DIR=project-yahl

WORKDIR /omniflex

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
