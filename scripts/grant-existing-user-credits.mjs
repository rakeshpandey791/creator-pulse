import { MongoClient } from "mongodb";

const amount = 12;
const batchKey = "manual-existing-users-12-v1";
const entryPrefix = `grant:${batchKey}:`;

if (!process.env.MONGODB_URI)
  throw new Error("MONGODB_URI is required to grant existing-user credits");

const client = await MongoClient.connect(process.env.MONGODB_URI);
const db = client.db(process.env.MONGODB_DB ?? "creatorpulse");
const users = await db
  .collection("users")
  .find({ status: "active", deletedAt: null }, { projection: { _id: 1 } })
  .toArray();

const apply = process.argv.includes("--apply");
const now = new Date();
let granted = 0;
let skipped = 0;

if (apply) {
  for (const user of users) {
    const creatorId = String(user._id);
    const entryId = `${entryPrefix}${creatorId}`;
    const session = client.startSession();
    try {
      await session.withTransaction(async () => {
        const existing = await db
          .collection("credit_ledger")
          .findOne({ _id: entryId }, { session });
        if (existing) {
          skipped += 1;
          return;
        }
        const totals = await db
          .collection("credit_ledger")
          .aggregate(
            [
              { $match: { creatorId } },
              { $group: { _id: null, balance: { $sum: "$amount" } } },
            ],
            { session },
          )
          .toArray();
        const balanceAfter = Number(totals[0]?.balance ?? 0) + amount;
        await db.collection("credit_ledger").insertOne(
          {
            _id: entryId,
            creatorId,
            entryType: "grant",
            amount,
            balanceAfter,
            referenceKey: batchKey,
            occurredAt: now,
            createdAt: now,
            updatedAt: now,
          },
          { session },
        );
        const balance = await db
          .collection("credit_balances")
          .findOne({ _id: creatorId }, { session });
        if (balance) {
          await db
            .collection("credit_balances")
            .updateOne(
              { _id: creatorId },
              { $inc: { balance: amount }, $set: { updatedAt: now } },
              { session },
            );
        } else {
          await db.collection("credit_balances").insertOne(
            {
              _id: creatorId,
              creatorId,
              balance: balanceAfter,
              updatedAt: now,
            },
            { session },
          );
        }
        granted += 1;
      });
    } finally {
      await session.endSession();
    }
  }
}

console.log(
  JSON.stringify({
    batchKey,
    amount,
    activeUsers: users.length,
    granted: apply ? granted : 0,
    skipped: apply ? skipped : 0,
    mode: apply ? "applied" : "dry-run",
  }),
);
await client.close();
