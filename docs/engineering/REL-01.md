# REL-01 container deployment

CreatorPulse packages the web, API and worker as separate Docker Compose service
containers from one multi-stage Dockerfile. Each service uses its own target
and runs as the non-root `creatorpulse` user. `.env` files and generated
artifacts are excluded from the build context, so credentials cannot be copied
into an image.

## Configuration

Use `.env.staging.example` as the staging configuration template. Staging must
provide `AUTH_SECRET`, `PASSWORD_RESET_MAIL_WEBHOOK_URL`, `MONGODB_URI`, `REDIS_URL`, `CORS_ORIGINS` and
`NEXT_PUBLIC_API_URL` through the deployment environment or secret manager.
Provider calls remain disabled with `PROVIDER_MODE=mock` and
`GEMINI_ENABLED=false` unless explicitly enabled.

Worker throughput is configured independently with `WORKER_CONCURRENCY` and
`GENERATION_WORKER_CONCURRENCY`. API and web health checks use their HTTP
health endpoints; the worker becomes healthy only after its dependencies are
connected and its readiness file is written.

## Staging smoke and rollback

CI validates the Compose configuration, builds all service targets, starts the
stack with `--wait`, checks `/v1/health`, and tears the stack down even when a
check fails. The same flow can be run locally with deployment-provided values:

```sh
npm run test:release
docker compose -f docker-compose.yml -f docker-compose.staging.yml \
  up -d --build --wait
curl --fail http://localhost:3001/v1/health
docker compose -f docker-compose.yml -f docker-compose.staging.yml down
```

For rollback, deploy the previously approved image tag (or checkout the
previous release commit), rerun the same `up -d --build --wait` smoke flow,
then verify `/v1/health` before routing traffic back. Do not remove database
volumes during an application rollback; migrations are forward-compatible and
are run separately through the DB migration procedure.
