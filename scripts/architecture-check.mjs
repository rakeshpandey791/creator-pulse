import { readFileSync, readdirSync } from "node:fs";
import { join, relative } from "node:path";

const root = process.cwd();
const sourceRoots = [
  "apps/web",
  "apps/api",
  "apps/worker",
  "packages/contracts",
  "packages/ai",
];
const forbidden = {
  "packages/ai": [
    "@creator-pulse/web",
    "@creator-pulse/api",
    "@creator-pulse/worker",
  ],
  "apps/web": ["@creator-pulse/api", "@creator-pulse/worker"],
  "apps/api": ["@creator-pulse/web", "@creator-pulse/worker"],
  "apps/worker": ["@creator-pulse/web", "@creator-pulse/api"],
  "packages/contracts": [
    "@creator-pulse/web",
    "@creator-pulse/api",
    "@creator-pulse/worker",
  ],
};

function sourceFiles(directory) {
  return readdirSync(join(root, directory), { withFileTypes: true }).flatMap(
    (entry) => {
      const path = join(directory, entry.name);
      if (entry.isDirectory()) return sourceFiles(path);
      return /\.(ts|tsx)$/.test(entry.name) ? [path] : [];
    },
  );
}

const violations = [];
for (const sourceRoot of sourceRoots) {
  for (const file of sourceFiles(sourceRoot)) {
    const content = readFileSync(join(root, file), "utf8");
    for (const dependency of forbidden[sourceRoot]) {
      if (content.includes(dependency))
        violations.push(`${relative(root, file)} imports ${dependency}`);
    }
  }
}

if (violations.length > 0) {
  console.error(`Architecture check failed:\n${violations.join("\n")}`);
  process.exit(1);
}

console.log(
  "Architecture check passed: workspace dependency direction is valid.",
);
