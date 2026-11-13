# CI failure-path evidence

INF-03 requires each quality gate to demonstrate a failing result when given a deliberate invalid fixture. The executable harness is `npm run test:ci-failures`; it creates temporary fixtures, invokes the real gate command, asserts a non-zero exit, and removes the fixtures in a `finally` block.

| Gate               | Deliberate fixture                                         | Expected result                                |
| ------------------ | ---------------------------------------------------------- | ---------------------------------------------- |
| Formatting         | Temporary TypeScript file with invalid Prettier formatting | `prettier --check` exits non-zero              |
| Workspace boundary | Temporary web source import of the API workspace           | Architecture check exits non-zero              |
| Tests              | Temporary Vitest assertion of `true` equal to `false`      | Vitest exits non-zero                          |
| Secrets            | Temporary file containing a provider-key pattern           | Secret check exits non-zero                    |
| Compose            | Temporary Compose file with an invalid port value          | `docker compose config --quiet` exits non-zero |
| Migrations         | `MIGRATION_FIXTURE=fail` test mode                         | Migration command exits non-zero               |

The harness was run locally during INF-03 review and produced six expected failures followed by cleanup. Run it again after changing a gate or its command to verify the failure contract remains intact.
