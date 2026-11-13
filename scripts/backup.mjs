import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
  scryptSync,
} from "node:crypto";
import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";

const mode = process.argv[2] ?? "verify";
const backupDir = process.env.BACKUP_DIR ?? ".backups";
const keyMaterial = process.env.BACKUP_ENCRYPTION_KEY;
const mongoArchive = join(backupDir, "mongodb.archive.enc");
const redisSnapshot = join(backupDir, "redis.rdb.enc");
const manifestPath = join(backupDir, "manifest.json");

function requireKey() {
  if (!keyMaterial || keyMaterial.length < 32) {
    throw new Error(
      "BACKUP_ENCRYPTION_KEY must contain at least 32 characters",
    );
  }
  return scryptSync(keyMaterial, "creator-pulse-backup-v1", 32);
}

function encrypt(input) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", requireKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(input), cipher.final()]);
  return Buffer.from(
    JSON.stringify({
      version: 1,
      algorithm: "aes-256-gcm",
      iv: iv.toString("base64url"),
      tag: cipher.getAuthTag().toString("base64url"),
      ciphertext: ciphertext.toString("base64url"),
    }),
  );
}

function decrypt(path) {
  const envelope = JSON.parse(readFileSync(path, "utf8"));
  if (envelope.version !== 1 || envelope.algorithm !== "aes-256-gcm") {
    throw new Error(`Unsupported backup envelope in ${path}`);
  }
  const decipher = createDecipheriv(
    "aes-256-gcm",
    requireKey(),
    Buffer.from(envelope.iv, "base64url"),
  );
  decipher.setAuthTag(Buffer.from(envelope.tag, "base64url"));
  return Buffer.concat([
    decipher.update(Buffer.from(envelope.ciphertext, "base64url")),
    decipher.final(),
  ]);
}

function compose(args, options = {}) {
  return execFileSync("docker", ["compose", ...args], {
    cwd: process.cwd(),
    encoding: options.encoding ?? "buffer",
    maxBuffer: 128 * 1024 * 1024,
    stdio: options.stdio ?? ["ignore", "pipe", "inherit"],
  });
}

function sha256(buffer) {
  return createHash("sha256").update(buffer).digest("hex");
}

function createBackup() {
  mkdirSync(backupDir, { recursive: true, mode: 0o700 });
  const mongo = compose([
    "exec",
    "-T",
    "mongodb",
    "mongodump",
    "--uri=mongodb://127.0.0.1:27017/creatorpulse",
    "--archive",
    "--gzip",
  ]);
  const redis = compose(["exec", "-T", "redis", "redis-cli", "--rdb", "-"]);
  const encryptedMongo = encrypt(mongo);
  const encryptedRedis = encrypt(redis);
  writeFileSync(mongoArchive, encryptedMongo, { mode: 0o600 });
  writeFileSync(redisSnapshot, encryptedRedis, { mode: 0o600 });
  writeFileSync(
    manifestPath,
    `${JSON.stringify(
      {
        version: 1,
        createdAt: new Date().toISOString(),
        mongoArchive: { path: mongoArchive, sha256: sha256(encryptedMongo) },
        redisSnapshot: { path: redisSnapshot, sha256: sha256(encryptedRedis) },
        note: "Redis is a recoverable queue/cache snapshot; MongoDB is the system of record.",
      },
      null,
      2,
    )}\n`,
    { mode: 0o600 },
  );
  console.log(`Encrypted backup created in ${backupDir}`);
}

function verifyBackup() {
  if (!existsSync(manifestPath)) throw new Error(`Missing ${manifestPath}`);
  const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
  for (const artifact of [manifest.mongoArchive, manifest.redisSnapshot]) {
    const encrypted = readFileSync(artifact.path);
    if (sha256(encrypted) !== artifact.sha256) {
      throw new Error(`Checksum mismatch for ${artifact.path}`);
    }
    decrypt(artifact.path);
  }
  console.log(
    "Backup verification passed: checksums and encryption envelopes are valid.",
  );
}

function restoreMongo() {
  verifyBackup();
  const archive = decrypt(mongoArchive);
  execFileSync(
    "docker",
    [
      "compose",
      "exec",
      "-T",
      "mongodb",
      "mongorestore",
      "--uri=mongodb://127.0.0.1:27017/creatorpulse",
      "--archive",
      "--gzip",
      "--drop",
    ],
    {
      cwd: process.cwd(),
      input: archive,
      stdio: ["pipe", "inherit", "inherit"],
    },
  );
  console.log(
    "MongoDB restore completed. Run npm run test:db to validate schema and reference integrity.",
  );
}

if (mode === "create") createBackup();
else if (mode === "verify") verifyBackup();
else if (mode === "restore-mongo") restoreMongo();
else
  throw new Error(
    "Usage: node scripts/backup.mjs <create|verify|restore-mongo>",
  );
