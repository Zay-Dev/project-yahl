FROM node:22

ARG OMNIFLEX_APP_DIR=project-yahl
ARG PLAYWRIGHT_VERSION=1.60.0

WORKDIR /omniflex

RUN corepack enable \
  && corepack prepare pnpm@10.33.0 --activate

ENV PLAYWRIGHT_BROWSERS_PATH=/opt/ms-playwright

RUN npx --yes playwright@${PLAYWRIGHT_VERSION} install-deps chromium \
  && npx --yes playwright@${PLAYWRIGHT_VERSION} install chromium

COPY package.json pnpm-workspace.yaml ./
COPY ${OMNIFLEX_APP_DIR}/package.json ./${OMNIFLEX_APP_DIR}/
COPY ${OMNIFLEX_APP_DIR}/shared/package.json ./${OMNIFLEX_APP_DIR}/shared/
COPY ${OMNIFLEX_APP_DIR}/worker/package.json ./${OMNIFLEX_APP_DIR}/worker/

RUN pnpm install --filter @project-yahl/worker...

COPY ${OMNIFLEX_APP_DIR}/shared ./${OMNIFLEX_APP_DIR}/shared
COPY ${OMNIFLEX_APP_DIR}/worker ./${OMNIFLEX_APP_DIR}/worker

RUN pnpm --filter @project-yahl/shared run build \
  && pnpm --filter @project-yahl/worker run build

WORKDIR /omniflex/${OMNIFLEX_APP_DIR}/worker

RUN CHROME="$(find /opt/ms-playwright -type f -name chrome | head -n1)" \
  && test -n "$CHROME" \
  && test -x "$CHROME" \
  && printf '%s' "$CHROME" > /opt/chrome-path \
  && cat /opt/chrome-path

RUN chmod +x docker-entrypoint.sh

ENTRYPOINT ["./docker-entrypoint.sh"]
CMD ["node", "dist/index.js"]
