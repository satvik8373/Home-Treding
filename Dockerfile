FROM node:22-bookworm-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:22-bookworm-slim
RUN apt-get update && apt-get install -y --no-install-recommends util-linux ca-certificates && apt-get clean
ENV NODE_ENV=production N009_HOST=0.0.0.0 PORT=4310 N009_DATA_DIR=/var/lib/n009 N009_EXECUTION_LOCATION=hosted
WORKDIR /app
COPY --from=build --chown=node:node /app/node_modules ./node_modules
COPY --from=build --chown=node:node /app/server ./server
COPY --from=build --chown=node:node /app/shared ./shared
COPY --from=build --chown=node:node /app/dist ./dist
COPY --from=build --chown=node:node /app/package.json ./package.json
COPY --from=build --chown=node:node /app/scripts/container-entrypoint.sh ./scripts/container-entrypoint.sh
RUN mkdir -p /var/lib/n009 && chown node:node /var/lib/n009
USER node
EXPOSE 4310
CMD ["sh", "scripts/container-entrypoint.sh"]
