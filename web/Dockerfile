FROM node:22-bookworm AS build

ARG OMNIFLEX_APP_DIR=project-yahl

WORKDIR /omniflex

RUN corepack enable

COPY package.json pnpm-workspace.yaml pnpm-lock.yaml tsconfig.infras.json ./
COPY infras ./infras
COPY ${OMNIFLEX_APP_DIR} ./${OMNIFLEX_APP_DIR}

RUN pnpm install --frozen-lockfile --filter @project-yahl/web...

ARG VITE_API_BASE_URL=http://localhost:4000
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL

RUN pnpm --filter @project-yahl/web run build

FROM nginx:alpine AS prod

ARG OMNIFLEX_APP_DIR=project-yahl

COPY --from=build /omniflex/${OMNIFLEX_APP_DIR}/web/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /omniflex/${OMNIFLEX_APP_DIR}/web/dist /usr/share/nginx/html

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
