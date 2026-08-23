FROM node:22-bookworm AS build

ARG OMNIFLEX_APP_DIR=project-yahl

WORKDIR /omniflex

RUN corepack enable

COPY package.json pnpm-workspace.yaml pnpm-lock.yaml tsconfig.infras.json ./
COPY infras ./infras
COPY ${OMNIFLEX_APP_DIR}/package.json ./${OMNIFLEX_APP_DIR}/
COPY ${OMNIFLEX_APP_DIR}/shared/package.json ./${OMNIFLEX_APP_DIR}/shared/
COPY ${OMNIFLEX_APP_DIR}/server/package.json ./${OMNIFLEX_APP_DIR}/server/
COPY ${OMNIFLEX_APP_DIR}/web/package.json ./${OMNIFLEX_APP_DIR}/web/

RUN pnpm install --frozen-lockfile --filter @project-yahl/web...

COPY ${OMNIFLEX_APP_DIR}/shared ./${OMNIFLEX_APP_DIR}/shared
COPY ${OMNIFLEX_APP_DIR}/server/src ./${OMNIFLEX_APP_DIR}/server/src
COPY ${OMNIFLEX_APP_DIR}/server/tsconfig.json ./${OMNIFLEX_APP_DIR}/server/tsconfig.json
COPY ${OMNIFLEX_APP_DIR}/web ./${OMNIFLEX_APP_DIR}/web

ARG VITE_API_BASE_URL=http://localhost:4000
ARG VITE_CODE_SERVER_PUBLIC_URL=/code
ARG VITE_WIKI_PUBLIC_URL=http://127.0.0.1:3001
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL
ENV VITE_CODE_SERVER_PUBLIC_URL=$VITE_CODE_SERVER_PUBLIC_URL
ENV VITE_WIKI_PUBLIC_URL=$VITE_WIKI_PUBLIC_URL

RUN pnpm --filter @project-yahl/shared --filter @omni-infra/types run build \
  && pnpm --filter @project-yahl/web run build

FROM nginx:alpine AS prod

ARG OMNIFLEX_APP_DIR=project-yahl

COPY --from=build /omniflex/${OMNIFLEX_APP_DIR}/web/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /omniflex/${OMNIFLEX_APP_DIR}/web/dist /usr/share/nginx/html

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
