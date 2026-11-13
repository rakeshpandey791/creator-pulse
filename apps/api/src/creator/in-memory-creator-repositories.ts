import type {
  CreatorProfile,
  CreatorProfileRepository,
  CreatorScope,
  TaxonomyRecord,
  TaxonomyRepository,
} from "../infrastructure/persistence/repository-ports.js";

class MemoryProfiles implements CreatorProfileRepository {
  private readonly profiles = new Map<string, CreatorProfile>();

  async findById(scope: CreatorScope, id: string) {
    const profile = this.profiles.get(id);
    return profile?.userId === scope.creatorId ? { ...profile } : null;
  }
  async list(scope: CreatorScope) {
    const items = [...this.profiles.values()].filter(
      (profile) => profile.userId === scope.creatorId,
    );
    return { items, nextCursor: null };
  }
  async insert(scope: CreatorScope, document: CreatorProfile) {
    const profile = { ...document, userId: scope.creatorId };
    this.profiles.set(profile._id, profile);
    return { ...profile };
  }
  async update(
    scope: CreatorScope,
    id: string,
    update: { $set?: Partial<CreatorProfile> },
  ) {
    const current = await this.findById(scope, id);
    if (!current) return null;
    const updated = { ...current, ...update.$set } as CreatorProfile;
    this.profiles.set(id, updated);
    return { ...updated };
  }

  async updateIfVersion(
    scope: CreatorScope,
    id: string,
    expectedVersion: number,
    update: { $set?: Partial<CreatorProfile> },
  ) {
    const current = this.profiles.get(id);
    if (
      !current ||
      current.userId !== scope.creatorId ||
      current.profileVersion !== expectedVersion
    )
      return null;
    const updated = { ...current, ...update.$set } as CreatorProfile;
    this.profiles.set(id, updated);
    return { ...updated };
  }
}

class MemoryTaxonomy implements TaxonomyRepository<TaxonomyRecord> {
  constructor(private readonly records: TaxonomyRecord[]) {}
  listActive() {
    return Promise.resolve(this.records.filter((record) => record.isActive));
  }
  findByCodes(codes: string[]) {
    return Promise.resolve(
      this.records.filter(
        (record) => codes.includes(record.code) && record.isActive,
      ),
    );
  }
}

const record = (
  id: string,
  code: string,
  sortOrder: number,
): TaxonomyRecord => ({
  _id: id,
  code,
  isActive: true,
  sortOrder,
});

export class InMemoryCreatorProfileDependencies {
  readonly profiles: CreatorProfileRepository = new MemoryProfiles();
  readonly niches: TaxonomyRepository<TaxonomyRecord> = new MemoryTaxonomy([
    record("5f4e5c8b-3f7b-4f2a-9b31-000000000001", "fitness", 0),
    record("5f4e5c8b-3f7b-4f2a-9b31-000000000002", "food", 1),
    record("5f4e5c8b-3f7b-4f2a-9b31-000000000003", "finance", 2),
    record("5f4e5c8b-3f7b-4f2a-9b31-000000000004", "education", 3),
    record("5f4e5c8b-3f7b-4f2a-9b31-000000000005", "entertainment", 4),
    record("5f4e5c8b-3f7b-4f2a-9b31-000000000006", "lifestyle", 5),
  ]);
  readonly languages: TaxonomyRepository<TaxonomyRecord> = new MemoryTaxonomy([
    record("6f4e5c8b-3f7b-4f2a-9b31-000000000001", "hi", 0),
    record("6f4e5c8b-3f7b-4f2a-9b31-000000000002", "hinglish", 1),
    record("6f4e5c8b-3f7b-4f2a-9b31-000000000003", "bho", 2),
    record("6f4e5c8b-3f7b-4f2a-9b31-000000000004", "pa", 3),
    record("6f4e5c8b-3f7b-4f2a-9b31-000000000005", "bgc", 4),
    record("6f4e5c8b-3f7b-4f2a-9b31-000000000006", "te", 5),
    record("6f4e5c8b-3f7b-4f2a-9b31-000000000007", "kn", 6),
  ]);
  readonly platforms: TaxonomyRepository<TaxonomyRecord> = new MemoryTaxonomy([
    record("7f4e5c8b-3f7b-4f2a-9b31-000000000001", "instagram", 0),
    record("7f4e5c8b-3f7b-4f2a-9b31-000000000002", "youtube", 1),
    record("7f4e5c8b-3f7b-4f2a-9b31-000000000003", "facebook", 2),
  ]);
}
