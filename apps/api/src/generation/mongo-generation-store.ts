import type { Db, Filter } from "mongodb";
import type {
  GenerationAsset,
  GenerationEvidence,
  GenerationIdea,
  GenerationOperation,
  GenerationStore,
} from "./generation.service.js";
import {
  MongoCreditLedgerService,
  type CreditLedgerService,
} from "../commercial/credit-ledger.service.js";

export class MongoGenerationStore implements GenerationStore {
  private readonly creditLedger: CreditLedgerService;

  constructor(
    private readonly db: Db,
    creditLedger = new MongoCreditLedgerService(db),
  ) {
    this.creditLedger = creditLedger;
  }

  async findIdea(
    creatorId: string,
    ideaId: string,
  ): Promise<GenerationIdea | null> {
    const document = await this.db
      .collection<GenerationIdea>("content_ideas")
      .findOne({ _id: ideaId } as Filter<GenerationIdea>);
    if (!document) return null;
    return {
      _id: String(document._id),
      ...(creatorId ? { creatorId } : {}),
      title: String(document.title ?? ""),
      summary: String(document.summary ?? ""),
      languageId: String(document.languageId ?? ""),
      platformId: String(document.platformId ?? ""),
      nicheId: String(document.nicheId ?? ""),
      topicId: String(document.topicId ?? ""),
    };
  }

  async listEvidence(ideaId: string): Promise<GenerationEvidence[]> {
    const items = await this.db
      .collection("idea_evidence")
      .find({ ideaId })
      .sort({ rank: 1 })
      .limit(5)
      .toArray();
    return items.map((item) => ({
      ...(item.sourceDocumentId
        ? { sourceDocumentId: String(item.sourceDocumentId) }
        : {}),
      summary: String(item.summary ?? ""),
      ...(item.sourceTitle ? { sourceTitle: String(item.sourceTitle) } : {}),
      ...(item.limitations ? { limitations: String(item.limitations) } : {}),
    }));
  }

  async findOperationByIdempotency(creatorId: string, idempotencyKey: string) {
    return this.db.collection<GenerationOperation>("ai_operations").findOne({
      creatorId,
      idempotencyKey,
      operationType: "generation",
    });
  }

  findOperation(creatorId: string, operationId: string) {
    return this.db.collection<GenerationOperation>("ai_operations").findOne({
      _id: operationId,
      ...(creatorId === "__worker__" ? {} : { creatorId }),
    } as Filter<GenerationOperation>);
  }

  async createOperation(operation: GenerationOperation) {
    try {
      await this.db
        .collection<GenerationOperation>("ai_operations")
        .insertOne(operation);
      return operation;
    } catch (error) {
      const existing = await this.findOperationByIdempotency(
        operation.creatorId,
        operation.idempotencyKey,
      );
      if (existing) return existing;
      throw error;
    }
  }

  async updateOperation(
    operationId: string,
    update: Partial<GenerationOperation>,
  ) {
    const {
      _id: ignoredId,
      creatorId: ignoredCreatorId,
      request: ignoredRequest,
      ...safeUpdate
    } = update;
    void ignoredId;
    void ignoredCreatorId;
    void ignoredRequest;
    const result = await this.db
      .collection<GenerationOperation>("ai_operations")
      .findOneAndUpdate(
        { _id: operationId },
        { $set: { ...safeUpdate, updatedAt: new Date() } },
        { returnDocument: "after" },
      );
    if (!result) throw new Error("Operation not found");
    return result;
  }

  async reserveCredits(creatorId: string, operationId: string, amount: number) {
    return this.creditLedger.reserve(creatorId, operationId, amount);
  }

  async consumeCredits(creatorId: string, operationId: string) {
    return this.creditLedger.consume(creatorId, operationId);
  }

  async releaseCredits(creatorId: string, operationId: string) {
    return this.creditLedger.release(creatorId, operationId);
  }

  async insertAssets(assets: GenerationAsset[]) {
    if (!assets.length) return;
    await this.db.collection<GenerationAsset>("idea_assets").bulkWrite(
      assets.map((asset) => ({
        updateOne: {
          filter: { _id: asset._id },
          update: { $setOnInsert: asset },
          upsert: true,
        },
      })),
    );
  }

  async deleteAssets(generationId: string) {
    await this.db
      .collection<GenerationAsset>("idea_assets")
      .deleteMany({ generationId });
  }

  listAssets(creatorId: string, generationId: string) {
    return this.db
      .collection<GenerationAsset>("idea_assets")
      .find({ creatorId, generationId })
      .toArray();
  }
}
