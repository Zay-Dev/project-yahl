FROM node:22

ARG OMNIFLEX_APP_DIR=project-yahl
ARG PLAYWRIGHT_VERSION=1.60.0

WORKDIR /omniflex

RUN corepack enable

ENV PLAYWRIGHT_BROWSERS_PATH=/opt/ms-playwright

RUN npx --yes playwright@${PLAYWRIGHT_VERSION} install-deps chromium \
  && npx --yes playwright@${PLAYWRIGHT_VERSION} install chromium

COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY ${OMNIFLEX_APP_DIR}/package.json ./${OMNIFLEX_APP_DIR}/
COPY ${OMNIFLEX_APP_DIR}/shared/package.json ./${OMNIFLEX_APP_DIR}/shared/
COPY ${OMNIFLEX_APP_DIR}/worker/package.json ./${OMNIFLEX_APP_DIR}/worker/

RUN pnpm install --frozen-lockfile --filter @project-yahl/worker...

COPY ${OMNIFLEX_APP_DIR}/shared ./${OMNIFLEX_APP_DIR}/shared
COPY ${OMNIFLEX_APP_DIR}/worker ./${OMNIFLEX_APP_DIR}/worker

WORKDIR /omniflex/${OMNIFLEX_APP_DIR}/worker

RUN CHROME="$(find /opt/ms-playwright -type f -name chrome | head -n1)" \
  && test -n "$CHROME" \
  && test -x "$CHROME" \
  && printf '%s' "$CHROME" > /opt/chrome-path \
  && cat /opt/chrome-path

RUN chmod +x docker-entrypoint.sh

ENTRYPOINT ["./docker-entrypoint.sh"]
CMD ["pnpm", "run", "dev"]
