# CI quality gates

The required `CreatorPulse CI` workflow runs on every pull request and on pushes to `main`. Configure the repository branch protection rule to require these job checks before merge:

- `Quality and tests`
- `Security and secrets`
- `Compose and migration validation`

The jobs use a clean Node.js 22 checkout and `npm ci`. Quality covers formatting, lint, strict TypeScript, tests, architecture boundaries, documentation checks and the application build. Security runs workspace secret detection and fails on critical production dependency vulnerabilities. Compose validation checks the configuration, provider-safe defaults, migration/seed entry points and service image build.

Each job uploads logs for 14 days, including failures, so reviewers can inspect the exact gate output. `npm run check` remains the local equivalent of the quality gate.

## Failure-path validation

Before enabling branch protection, run each gate once with a deliberate local fixture: introduce a formatting error, a forbidden cross-workspace import, a test failure, a secret-pattern fixture, an invalid Compose value and a failing migration command. Confirm the corresponding job fails and that its artifact is retained. Remove each fixture before committing.

The repeatable version of this validation is `npm run test:ci-failures`. Its checked-in evidence matrix is documented in [CI_FAILURE_PATHS.md](./CI_FAILURE_PATHS.md).
