import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";

execFileSync("docker", ["compose", "config", "--quiet"], {
  cwd: process.cwd(),
  stdio: "inherit",
});

const compose = readFileSync("docker-compose.yml", "utf8");
const requiredServices = ["web:", "api:", "worker:", "mongodb:", "redis:"];
const missingServices = requiredServices.filter(
  (service) => !compose.includes(`\n  ${service}`),
);
const providerDefaultsPresent =
  compose.includes("PROVIDER_MODE: ${PROVIDER_MODE:-mock}") &&
  compose.includes("GEMINI_ENABLED: ${GEMINI_ENABLED:-false}");

if (missingServices.length > 0 || !providerDefaultsPresent) {
  console.error(
    "Compose smoke check failed: required services or provider-safe defaults are missing.",
  );
  process.exit(1);
}

console.log(
  "Compose smoke check passed: config is valid and providers default to mock/disabled.",
);
