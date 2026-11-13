import { execFileSync, spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import { MongoClient } from "mongodb";

if (!process.env.MONGODB_URI) {
  throw new Error(
    "MONGODB_URI is required for db:seed; use npm run test:db for the Docker-backed smoke test.",
  );
}

const seedFile = "database/seeds/001_reference_data.js";
const mongosh = spawnSync("mongosh", ["--version"], { stdio: "ignore" });

if (mongosh.status === 0) {
  execFileSync(
    "mongosh",
    [process.env.MONGODB_URI, "--quiet", "--file", seedFile],
    { stdio: "inherit" },
  );
} else {
  // Keep seeding usable on developer machines that have the Node driver but
  // not the MongoDB shell. The seed file remains the single source of truth.
  const client = await MongoClient.connect(process.env.MONGODB_URI);
  const database = client.db(process.env.MONGODB_DB ?? "creatorpulse");
  const writes = [];
  const deferredCursors = [];
  const db = new Proxy(
    {},
    {
      get: (_target, collectionName) => ({
        find: (...args) => ({
          forEach: (callback) => {
            deferredCursors.push({ collectionName, args, callback });
          },
        }),
        updateOne: (...args) => {
          const write = database.collection(collectionName).updateOne(...args);
          writes.push(write);
          return write;
        },
      }),
    },
  );
  vm.runInNewContext(readFileSync(seedFile, "utf8"), {
    ISODate: (value) => new Date(value),
    db,
  });
  for (const cursor of deferredCursors) {
    const records = await database
      .collection(cursor.collectionName)
      .find(...cursor.args)
      .toArray();
    records.forEach(cursor.callback);
  }
  // The Node-driver fallback cannot synchronously emulate mongosh's cursor
  // API, so apply the same idempotent welcome grant after evaluating the seed.
  const users = await database
    .collection("users")
    .find({ status: "active" }, { projection: { _id: 1 } })
    .toArray();
  for (const user of users) {
    writes.push(
      database.collection("credit_ledger").updateOne(
        { _id: `grant:${user._id}:welcome-v1` },
        {
          $setOnInsert: {
            _id: `grant:${user._id}:welcome-v1`,
            creatorId: String(user._id),
            entryType: "grant",
            amount: 12,
            balanceAfter: 12,
            referenceKey: "welcome-grant-v1",
            occurredAt: new Date("2026-11-11T00:00:00.000Z"),
            createdAt: new Date("2026-11-11T00:00:00.000Z"),
            updatedAt: new Date("2026-11-11T00:00:00.000Z"),
          },
        },
        { upsert: true },
      ),
    );
  }
  await Promise.all(writes);
  await client.close();
  console.log("Seeded MongoDB using the Node driver (mongosh unavailable).");
}
