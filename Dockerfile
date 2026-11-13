FROM node:22-alpine AS dependencies
WORKDIR /workspace

COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json
COPY apps/worker/package.json apps/worker/package.json
COPY packages/contracts/package.json packages/contracts/package.json
COPY packages/ai/package.json packages/ai/package.json
RUN npm ci

FROM dependencies AS builder
COPY . .
ARG NEXT_PUBLIC_API_URL=http://localhost:3001/v1
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
RUN npm run build

FROM node:22-alpine AS runtime-base
WORKDIR /workspace
ENV NODE_ENV=production

COPY --from=builder /workspace/package.json /workspace/package-lock.json ./
COPY --from=builder /workspace/node_modules ./node_modules
COPY --from=builder /workspace/apps ./apps
COPY --from=builder /workspace/packages ./packages
COPY --from=builder /workspace/scripts ./scripts
COPY --from=builder /workspace/database ./database
COPY --from=builder /workspace/docs/database ./docs/database

RUN addgroup -S creatorpulse && adduser -S creatorpulse -G creatorpulse \
  && chown -R creatorpulse:creatorpulse /workspace
USER creatorpulse

FROM runtime-base AS api
CMD ["npm", "run", "start", "--workspace", "@creator-pulse/api"]

FROM runtime-base AS web
CMD ["npm", "run", "start", "--workspace", "@creator-pulse/web"]

FROM runtime-base AS worker
CMD ["npm", "run", "start", "--workspace", "@creator-pulse/worker"]
