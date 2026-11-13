import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { isAbsolute, join, relative, sep } from "node:path";

const root = process.cwd();
const excludedDirectories = new Set([
  ".git",
  ".next",
  "coverage",
  "dist",
  "node_modules",
]);
const excludedFiles = new Set(["package-lock.json"]);

function workspaceFiles(directory) {
  const entries = readdirSync(directory, { withFileTypes: true });
  return entries.flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) {
      return excludedDirectories.has(entry.name) ? [] : workspaceFiles(path);
    }
    if (
      entry.name === ".env" ||
      (entry.name.startsWith(".env.") && !entry.name.endsWith(".example"))
    )
      return [];
    return excludedFiles.has(entry.name) ? [] : [path];
  });
}

function trackedFiles() {
  try {
    const output = execFileSync("git", ["ls-files", "-z"], {
      cwd: root,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    });
    return output
      .split("\0")
      .filter(Boolean)
      .filter((file) => !excludedFiles.has(file.split("/").pop()));
  } catch {
    return workspaceFiles(root).map((file) => relative(root, file));
  }
}

const forbidden =
  /(AIza[\w-]{20,}|sk-[\w-]{20,}|gsk_[\w-]{20,}|-----BEGIN (?:RSA |EC )?PRIVATE KEY-----)/;
const extraFiles = (process.env.SECRET_CHECK_INCLUDE ?? "")
  .split(sep)
  .filter(Boolean);
// Local credential files are expected to contain secrets. Tracked copies are
// still scanned; only the no-Git workspace fallback excludes local .env files.
const files = [...trackedFiles(), ...extraFiles];
const matches = files.filter((file) => {
  const path = isAbsolute(file) ? file : join(root, file);
  return (
    existsSync(path) &&
    statSync(path).size < 1_000_000 &&
    forbidden.test(readFileSync(path, "utf8"))
  );
});

if (matches.length > 0) {
  console.error(`Secret check failed in: ${matches.join(", ")}`);
  process.exit(1);
}
console.log("Secret check passed.");
