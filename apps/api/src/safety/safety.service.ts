import { randomUUID } from "node:crypto";
import { type Collection, type Db, type MongoClient } from "mongodb";
import {
  assertSafeToPublish,
  evaluateSafety,
  type SafetyCheckInput,
  type SafetyCheckResult,
  type SafetyReport,
} from "@creator-pulse/contracts";

export type StoredSafetyReport = SafetyReport & {
  _id: string;
  createdAt: Date;
};

export interface SafetyReportStore {
  save(report: StoredSafetyReport): Promise<void>;
}

export class InMemorySafetyReportStore implements SafetyReportStore {
  readonly reports: StoredSafetyReport[] = [];

  async save(report: StoredSafetyReport) {
    this.reports.push(report);
  }
}

export class MongoSafetyReportStore implements SafetyReportStore {
  constructor(private readonly collection: Collection<StoredSafetyReport>) {}

  async save(report: StoredSafetyReport) {
    await this.collection.insertOne(report);
  }
}

export class SafetyService {
  constructor(private readonly reports: SafetyReportStore) {}

  async check(input: SafetyCheckInput): Promise<SafetyCheckResult> {
    const result = evaluateSafety(input);
    await this.reports.save({
      ...result.report,
      _id: randomUUID(),
      createdAt: new Date(),
    });
    return result;
  }

  async assertPublishable(input: SafetyCheckInput) {
    const result = await this.check(input);
    assertSafeToPublish(result);
    return result;
  }
}

export function createMongoSafetyReportStore(
  client: MongoClient,
  database: string,
) {
  const db: Db = client.db(database);
  return new MongoSafetyReportStore(
    db.collection<StoredSafetyReport>("safety_reports"),
  );
}
