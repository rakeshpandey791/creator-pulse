# Workspace conventions

## Workspace ownership

- `apps/web` owns Next.js route composition and presentation. It may consume shared contracts, but never imports API or worker implementation code.
- `apps/api` owns the NestJS transport and application boundary. It may consume shared contracts, but never imports web or worker implementation code.
- `apps/worker` owns asynchronous job entry points. It may consume shared contracts, but never imports web or API implementation code.
- `packages/contracts` contains dependency-light public types and schemas. It imports no application workspace.
- `tests` contains cross-workspace tests and may import public entry points only.

The dependency direction is intentionally one-way: applications depend on shared contracts; applications do not depend on one another. Domain modules inside the API communicate through application services and ports rather than direct provider or repository access.

## Commands

Run these from the repository root:

```sh
npm install
npm run setup:hooks       # once per checkout with Git metadata
npm run check             # formatting, lint, types, tests, security and architecture checks
npm run build             # all workspace builds
npm run dev               # web, API and worker concurrently
```

The pre-commit hook runs `npm run check`. Commit subjects use a Conventional Commits prefix, for example `feat(api): add health endpoint`.

## TypeScript and module rules

All workspaces use strict TypeScript settings, NodeNext module resolution, two-space formatting and ESM package semantics where supported. Shared contracts must remain free of runtime framework dependencies. Generated output is never imported or committed.

## Change ownership

Use the task ID in the pull request title or description. Changes that cross an ownership boundary require an explicit architecture note and a test covering the boundary. Do not add a microservice or a second database without an approved design decision.
