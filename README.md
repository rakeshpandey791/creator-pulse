# CreatorPulse

CreatorPulse is a modular monolith with a Next.js web app, NestJS API, background worker, and shared TypeScript contracts.

## Prerequisites

- Node.js 22+
- npm 10+

## Local commands

```sh
npm install
cp .env.example .env
npm run setup:hooks
npm run check
npm run dev
```

To run the full local stack with MongoDB and Redis, use Docker Compose:

```sh
docker compose up --build
docker compose exec mongodb mongosh "mongodb://127.0.0.1:27017/creatorpulse" --eval 'var CP_SCHEMA_PATH="/opt/docs/database/SCHEMA.sql"' --file /opt/database/migrations/001_initial_schema.js
docker compose exec mongodb mongosh "mongodb://127.0.0.1:27017/creatorpulse" --file /opt/database/seeds/001_reference_data.js
docker compose exec mongodb mongosh "mongodb://127.0.0.1:27017/creatorpulse" --file /opt/database/tests/001_integrity.js
curl http://localhost:3001/v1/health
```

Compose uses isolated named volumes and explicitly defaults to `AI_PROVIDER=fake` for offline development. Live AI defaults to **Groq primary → Gemini fallback**: set `AI_PROVIDER=groq`, `GROQ_API_KEY`, and `GEMINI_API_KEY`; models use `GROQ_MODEL` and `GEMINI_MODEL`, and each provider is bounded by `AI_TIMEOUT_MS`. This covers idea generation/search/ranking, angle selection and scripts in the API and worker factory. Schema-invalid responses and provider failures automatically attempt Gemini once; if both discovery providers fail, existing database search remains available. Explicit `AI_PROVIDER=gemini` preserves legacy single-provider mode. See [AI provider configuration and recovery](./docs/engineering/AI_PROVIDERS.md). Run `npm run db:migrate` and `npm run db:seed` when `MONGODB_URI` is available. The seed command creates the six/seven/three reference taxonomies plus three deterministic demo ideas, evidence records and current scores; it uses `mongosh` when installed and falls back to the Node MongoDB driver.

For a production-shaped staging configuration, copy `.env.staging.example`, inject its values through the deployment environment or secret manager, run `npm run test:release`, and follow [the REL-01 deployment runbook](./docs/engineering/REL-01.md). Never use the local Compose fallback secret in a deployed environment.

Backup and recovery procedures are documented in [the REL-02 runbook](./docs/engineering/REL-02.md). Run `npm run test:rel02` to validate the runbook contract; backup creation and restore require Docker and `BACKUP_ENCRYPTION_KEY`.

The web app runs at `http://localhost:3000`; the API health endpoint is `http://localhost:3001/v1/health`. The worker currently prints a readiness message and exits only on `SIGTERM`; queue integration is intentionally deferred to infrastructure tasks.

## Workspace layout

- `apps/web` — Next.js frontend entry point
- `apps/api` — NestJS REST API entry point
- `apps/worker` — background-worker process placeholder
- `packages/contracts` — shared TypeScript contracts
- `tests` — foundation and cross-workspace tests
- `scripts` — bootstrap and secret checks
- `docs` — product, design, engineering and project decisions

Never commit `.env` files or credentials. Use `.env.example` for documented configuration names and safe local defaults.

See [CONTRIBUTING.md](./CONTRIBUTING.md) and [workspace conventions](./docs/engineering/WORKSPACE_CONVENTIONS.md) for contribution, dependency-boundary and commit-hook guidance.

CI gates are documented in [docs/engineering/CI.md](./docs/engineering/CI.md).
# creator-pulse
