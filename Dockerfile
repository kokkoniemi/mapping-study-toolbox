FROM node:24-trixie-slim AS deps

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund

COPY ui/package.json ui/package-lock.json ./ui/
RUN npm --prefix ui ci --no-audit --no-fund

FROM deps AS build

WORKDIR /app
COPY . .
RUN npm run ui:build

FROM node:24-trixie-slim AS runtime

ENV NODE_ENV=production
ENV APP_ROOT=/app
ENV APP_DATA_DIR=/workspace-data
ENV UI_DIST_DIR=/app/ui/dist

WORKDIR /app

COPY --from=build /app /app

RUN chmod +x /app/docker/release-entrypoint.sh

EXPOSE 3000
VOLUME ["/workspace-data"]

ENTRYPOINT ["/app/docker/release-entrypoint.sh"]
