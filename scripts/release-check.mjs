import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";

const runCompose = (args, env = {}) =>
  execFileSync("docker", ["compose", ...args], {
    cwd: process.cwd(),
    env: { ...process.env, ...env },
    stdio: "pipe",
    encoding: "utf8",
  });

const dockerfile = readFileSync("Dockerfile", "utf8");
const dockerignore = readFileSync(".dockerignore", "utf8");
const staging = readFileSync("docker-compose.staging.yml", "utf8");

const requiredDockerfileMarkers = [
  "FROM dependencies AS builder",
  "FROM runtime-base AS api",
  "FROM runtime-base AS web",
  "FROM runtime-base AS worker",
  "USER creatorpulse",
  "ARG NEXT_PUBLIC_API_URL",
];
const missingDockerfileMarkers = requiredDockerfileMarkers.filter(
  (marker) => !dockerfile.includes(marker),
);
const requiredIgnoredPaths = [".env", "node_modules/", ".ci-artifacts/"];
const missingIgnoredPaths = requiredIgnoredPaths.filter(
  (path) => !dockerignore.includes(path),
);
const requiredStagingMarkers = [
  "AUTH_SECRET: ${AUTH_SECRET:?AUTH_SECRET is required}",
  "PASSWORD_RESET_MAIL_WEBHOOK_URL: ${PASSWORD_RESET_MAIL_WEBHOOK_URL:?PASSWORD_RESET_MAIL_WEBHOOK_URL is required}",
  "MONGODB_URI: ${MONGODB_URI:?MONGODB_URI is required}",
  "REDIS_URL: ${REDIS_URL:?REDIS_URL is required}",
];
const missingStagingMarkers = requiredStagingMarkers.filter(
  (marker) => !staging.includes(marker),
);

if (
  missingDockerfileMarkers.length > 0 ||
  missingIgnoredPaths.length > 0 ||
  missingStagingMarkers.length > 0
) {
  throw new Error(
    `Release configuration check failed: ${JSON.stringify({
      missingDockerfileMarkers,
      missingIgnoredPaths,
      missingStagingMarkers,
    })}`,
  );
}

runCompose(["config", "--quiet"]);
runCompose(
  [
    "-f",
    "docker-compose.yml",
    "-f",
    "docker-compose.staging.yml",
    "config",
    "--quiet",
  ],
  {
    NEXT_PUBLIC_API_URL: "http://localhost:3001/v1",
    CORS_ORIGINS: "http://localhost:3000",
    AUTH_SECRET: "release-check-secret",
    PASSWORD_RESET_MAIL_WEBHOOK_URL: "https://mail.example.test/password-reset",
    MONGODB_URI: "mongodb://mongodb:27017/creatorpulse",
    REDIS_URL: "redis://redis:6379",
  },
);

console.log(
  "Release configuration check passed: service targets, non-root image, secret exclusion and staging config are valid.",
);
