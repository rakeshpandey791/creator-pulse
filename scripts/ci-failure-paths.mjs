import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const root = process.cwd();
const tempRoot = join(tmpdir(), `creator-pulse-ci-failures-${process.pid}`);
const architectureFixture = join(root, "apps/web/.ci-failure-fixture.ts");
const testFixture = join(root, "tests/.ci-failure-fixture.test.ts");
const secretFixture = join(root, "tests/.ci-secret-fixture.txt");
const composeFixture = join(tempRoot, "invalid-compose.yml");
const evidence = [];

function expectFailure(name, command, args, options = {}) {
  try {
    execFileSync(command, args, {
      cwd: root,
      env: { ...process.env, ...options.env },
      stdio: "pipe",
    });
  } catch (error) {
    evidence.push({
      name,
      result: "failed as expected",
      exitCode: error.status ?? 1,
    });
    return;
  }
  throw new Error(`${name} unexpectedly passed`);
}

mkdirSync(tempRoot, { recursive: true });
try {
  writeFileSync(join(tempRoot, "bad-format.ts"), "const   value=1\n");
  expectFailure("formatting", "npx", [
    "prettier",
    "--check",
    join(tempRoot, "bad-format.ts"),
  ]);

  writeFileSync(architectureFixture, 'import "@creator-pulse/api";\n');
  expectFailure("workspace boundary", process.execPath, [
    "scripts/architecture-check.mjs",
  ]);

  writeFileSync(
    testFixture,
    'import { expect, it } from "vitest"; it("fails", () => expect(true).toBe(false));\n',
  );
  expectFailure("test", "npm", ["test", "--", "--run", testFixture]);

  const secretFixtureValue = `sk-${"12345678901234567890123456789012"}`;
  writeFileSync(secretFixture, `test ${secretFixtureValue}\n`);
  expectFailure(
    "secret detection",
    process.execPath,
    ["scripts/secret-check.mjs"],
    {
      env: { SECRET_CHECK_INCLUDE: secretFixture },
    },
  );

  writeFileSync(
    composeFixture,
    "services:\n  broken:\n    image: alpine\n    ports: [invalid]\n",
  );
  expectFailure("Compose configuration", "docker", [
    "compose",
    "-f",
    composeFixture,
    "config",
    "--quiet",
  ]);

  expectFailure("migration", "npm", ["run", "db:migrate"], {
    env: { MIGRATION_FIXTURE: "fail" },
  });
} finally {
  rmSync(tempRoot, { recursive: true, force: true });
  for (const file of [architectureFixture, testFixture, secretFixture]) {
    if (existsSync(file)) rmSync(file);
  }
}

console.log(
  `CI failure-path validation passed (${evidence.length}/6 deliberate fixtures failed as expected).`,
);
for (const result of evidence)
  console.log(`- ${result.name}: ${result.result} (exit ${result.exitCode})`);
