# Contributing to CreatorPulse

## Development workflow

1. Install Node.js 22+ and npm 10+.
2. Run `npm install` and copy `.env.example` to `.env` for local configuration.
3. Make focused changes within the relevant workspace (`apps/web`, `apps/api`, `apps/worker`, or `packages/contracts`).
4. Run `npm run check` and `npm run build` before requesting review.

Do not commit `.env` files, credentials, generated output, or provider keys. The repository secret check scans workspace files and the `.gitignore` protects common local and generated paths.

## Boundaries

Keep the modular-monolith boundaries described in `docs/engineering/ENGINEERING_DESIGN.md`. Put shared transport types in `packages/contracts`; keep authoritative business rules in the API or worker rather than duplicating them in the web app.

## Pull requests

Describe the task ID, implementation summary, validation commands, and any follow-up work. Include tests for new behavior and update the relevant documentation when a command, boundary, or environment variable changes.
