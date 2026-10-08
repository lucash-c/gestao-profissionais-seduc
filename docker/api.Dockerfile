FROM node:24-alpine AS base

RUN npm install --global pnpm@11.19.0

WORKDIR /workspace

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc tsconfig.base.json ./
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json
COPY packages/contracts/package.json packages/contracts/package.json
COPY packages/database/package.json packages/database/package.json

RUN pnpm install --frozen-lockfile

COPY packages packages
COPY apps/api apps/api

RUN pnpm db:generate && pnpm packages:build

FROM base AS development

EXPOSE 3000

CMD ["pnpm", "--filter", "@seduc/api", "dev"]

FROM base AS build

RUN pnpm --filter @seduc/api build

FROM build AS production

ENV NODE_ENV=production

USER node

EXPOSE 3000

CMD ["node", "apps/api/dist/server.js"]
