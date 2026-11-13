import { Controller, Get, Module } from "@nestjs/common";
import type {
  IdeaRankingProvider,
  IdeaGenerationProvider,
  HealthResponse,
  TextGenerationProvider,
} from "@creator-pulse/contracts";
import { MongoClient } from "mongodb";
import { createMongoRepositories } from "./infrastructure/persistence/mongo-repositories.js";
import { IdentityController } from "./identity/identity.controller.js";
import { InMemoryIdentityRepositories } from "./identity/in-memory-identity-repositories.js";
import { CreatorProfileController } from "./creator/creator-profile.controller.js";
import {
  CreatorProfileService,
  type CreatorProfileDependencies,
} from "./creator/creator-profile.service.js";
import { InMemoryCreatorProfileDependencies } from "./creator/in-memory-creator-repositories.js";
import { DiscoveryController } from "./discovery/discovery.controller.js";
import {
  DiscoveryService,
  InMemoryDiscoveryStore,
  MongoDiscoveryStore,
  type DiscoveryStore,
} from "./discovery/discovery.service.js";
import {
  IdentityService,
  type IdentityRepositories,
} from "./identity/identity.service.js";
import {
  DevelopmentMailSink,
  WebhookPasswordResetMailer,
} from "./identity/password-reset-mailer.js";
import { LanguageController } from "./language/language.controller.js";
import { SafetyController } from "./safety/safety.controller.js";
import {
  createMongoSafetyReportStore,
  InMemorySafetyReportStore,
  SafetyService,
  type SafetyReportStore,
} from "./safety/safety.service.js";
import { GenerationController } from "./generation/generation.controller.js";
import {
  GenerationService,
  InMemoryGenerationQueue,
  InMemoryGenerationStore,
  type GenerationQueue,
  type GenerationStore,
} from "./generation/generation.service.js";
import { InMemoryGenerationProvider } from "./generation/in-memory-generation-provider.js";
import { MongoGenerationStore } from "./generation/mongo-generation-store.js";
import { BullMqGenerationQueue } from "./generation/bullmq-generation-queue.js";
import { createApiAiProvider } from "./generation/gemini-generation-provider.js";
import { aiMode } from "@creator-pulse/ai";
import { InMemoryIdeaRankingProvider } from "./discovery/in-memory-idea-ranking-provider.js";
import { FeedbackController } from "./feedback/feedback.controller.js";
import {
  FeedbackService,
  InMemoryFeedbackStore,
  MongoFeedbackStore,
  type FeedbackStore,
} from "./feedback/feedback.service.js";
import {
  CommercialController,
  PAYMENT_ADAPTER,
} from "./commercial/commercial.controller.js";
import {
  CommercialService,
  InMemoryCommercialStore,
  MongoCommercialStore,
  MockManualPaymentAdapter,
  type CommercialStore,
} from "./commercial/commercial.service.js";
import { ObservabilityController } from "./observability/observability.controller.js";
import { apiLogger } from "./observability/observability.js";
import { LocalPulseController } from "./research/local-pulse.controller.js";
import {
  InMemoryLocalPulseStore,
  LocalPulseService,
  MongoLocalPulseStore,
  type LocalPulseStore,
} from "./research/local-pulse.service.js";

export const IDENTITY_REPOSITORIES = "IDENTITY_REPOSITORIES";
export const PASSWORD_RESET_MAILER = "PASSWORD_RESET_MAILER";
export const CREATOR_PROFILE_DEPENDENCIES = "CREATOR_PROFILE_DEPENDENCIES";
export const DISCOVERY_STORE = "DISCOVERY_STORE";
export const SAFETY_REPORT_STORE = "SAFETY_REPORT_STORE";
export const GENERATION_STORE = "GENERATION_STORE";
export const GENERATION_QUEUE = "GENERATION_QUEUE";
export const GENERATION_PROVIDER = "GENERATION_PROVIDER";
export const COMMERCIAL_STORE = "COMMERCIAL_STORE";
export const LOCAL_PULSE_STORE = "LOCAL_PULSE_STORE";
export const IDEA_RANKING_PROVIDER = "IDEA_RANKING_PROVIDER";
export const IDEA_GENERATION_PROVIDER = "IDEA_GENERATION_PROVIDER";

@Controller("health")
export class HealthController {
  @Get()
  getHealth(): HealthResponse {
    return {
      status: "ok",
      service: "api",
      timestamp: new Date().toISOString(),
    };
  }
}

@Module({
  controllers: [
    HealthController,
    IdentityController,
    CreatorProfileController,
    DiscoveryController,
    LanguageController,
    SafetyController,
    GenerationController,
    FeedbackController,
    CommercialController,
    ObservabilityController,
    LocalPulseController,
  ],
  providers: [
    {
      provide: COMMERCIAL_STORE,
      useFactory: async (): Promise<CommercialStore> => {
        const client = await connectMongo();
        if (!client) return new InMemoryCommercialStore();
        return new MongoCommercialStore(
          client.db(process.env.MONGODB_DB ?? "creatorpulse"),
        );
      },
    },
    {
      provide: CommercialService,
      useFactory: (store: CommercialStore) => new CommercialService(store),
      inject: [COMMERCIAL_STORE],
    },
    {
      provide: PAYMENT_ADAPTER,
      useFactory: () => new MockManualPaymentAdapter(),
    },
    {
      provide: SAFETY_REPORT_STORE,
      useFactory: async (): Promise<SafetyReportStore> => {
        const client = await connectMongo();
        if (!client) return new InMemorySafetyReportStore();
        return createMongoSafetyReportStore(
          client,
          process.env.MONGODB_DB ?? "creatorpulse",
        );
      },
    },
    {
      provide: SafetyService,
      useFactory: (reports: SafetyReportStore) => new SafetyService(reports),
      inject: [SAFETY_REPORT_STORE],
    },
    {
      provide: GENERATION_STORE,
      useFactory: async (): Promise<GenerationStore> => {
        const client = await connectMongo();
        if (!client) return new InMemoryGenerationStore();
        return new MongoGenerationStore(
          client.db(process.env.MONGODB_DB ?? "creatorpulse"),
        );
      },
    },
    {
      provide: GENERATION_QUEUE,
      useFactory: (): GenerationQueue =>
        process.env.REDIS_URL
          ? new BullMqGenerationQueue(process.env.REDIS_URL)
          : new InMemoryGenerationQueue(),
    },
    {
      provide: GENERATION_PROVIDER,
      useFactory: () =>
        aiMode(process.env) === "fake"
          ? new InMemoryGenerationProvider()
          : createApiAiProvider(),
    },
    {
      provide: GenerationService,
      useFactory: (
        store: GenerationStore,
        queue: GenerationQueue,
        provider: TextGenerationProvider,
        commercial: CommercialService,
      ) => {
        const service = new GenerationService(
          store,
          queue,
          provider,
          undefined,
          commercial,
        );
        if (queue instanceof InMemoryGenerationQueue)
          queue.register((job) => service.process(job));
        return service;
      },
      inject: [
        GENERATION_STORE,
        GENERATION_QUEUE,
        GENERATION_PROVIDER,
        CommercialService,
      ],
    },
    {
      provide: IDENTITY_REPOSITORIES,
      useFactory: async (): Promise<IdentityRepositories> => {
        const client = await connectMongo();
        if (!client) {
          const memory = new InMemoryIdentityRepositories();
          return {
            users: memory.users,
            sessions: memory.sessions,
            passwordResets: memory.passwordResets,
            auditLogs: memory.auditLogs,
          };
        }
        const repositories = createMongoRepositories(
          client.db(process.env.MONGODB_DB ?? "creatorpulse"),
        );
        return {
          users: repositories.users,
          sessions: repositories.sessions,
          passwordResets: repositories.passwordResets,
          auditLogs: repositories.auditLogs,
        };
      },
    },
    {
      provide: CREATOR_PROFILE_DEPENDENCIES,
      useFactory: async (): Promise<CreatorProfileDependencies> => {
        const client = await connectMongo();
        if (!client) return new InMemoryCreatorProfileDependencies();
        const repositories = createMongoRepositories(
          client.db(process.env.MONGODB_DB ?? "creatorpulse"),
        );
        return {
          profiles: repositories.creatorProfiles,
          niches: repositories.niches,
          languages: repositories.languages,
          platforms: repositories.platforms,
        };
      },
    },
    {
      provide: CreatorProfileService,
      useFactory: (dependencies: CreatorProfileDependencies) =>
        new CreatorProfileService(dependencies),
      inject: [CREATOR_PROFILE_DEPENDENCIES],
    },
    {
      provide: LOCAL_PULSE_STORE,
      useFactory: async (): Promise<LocalPulseStore> => {
        const client = await connectMongo();
        if (!client) return new InMemoryLocalPulseStore();
        return new MongoLocalPulseStore(
          client.db(process.env.MONGODB_DB ?? "creatorpulse"),
        );
      },
    },
    {
      provide: LocalPulseService,
      useFactory: (profiles: CreatorProfileService, store: LocalPulseStore) =>
        new LocalPulseService(profiles, store),
      inject: [CreatorProfileService, LOCAL_PULSE_STORE],
    },
    {
      provide: DISCOVERY_STORE,
      useFactory: async (): Promise<DiscoveryStore> => {
        const client = await connectMongo();
        if (!client) return new InMemoryDiscoveryStore();
        return new MongoDiscoveryStore(
          client.db(process.env.MONGODB_DB ?? "creatorpulse"),
        );
      },
    },
    {
      provide: "FEEDBACK_STORE",
      useFactory: async (): Promise<FeedbackStore> => {
        const client = await connectMongo();
        if (!client) return new InMemoryFeedbackStore();
        return new MongoFeedbackStore(
          client.db(process.env.MONGODB_DB ?? "creatorpulse"),
        );
      },
    },
    {
      provide: FeedbackService,
      useFactory: (store: FeedbackStore) => new FeedbackService(store),
      inject: ["FEEDBACK_STORE"],
    },
    {
      provide: DiscoveryService,
      useFactory: (
        store: DiscoveryStore,
        profiles: CreatorProfileService,
        ideaRanking: IdeaRankingProvider,
        ideaGeneration: IdeaGenerationProvider,
      ) => new DiscoveryService(store, profiles, ideaRanking, ideaGeneration),
      inject: [
        DISCOVERY_STORE,
        CreatorProfileService,
        IDEA_RANKING_PROVIDER,
        IDEA_GENERATION_PROVIDER,
      ],
    },
    {
      provide: IDEA_RANKING_PROVIDER,
      useFactory: () =>
        aiMode(process.env) === "fake"
          ? new InMemoryIdeaRankingProvider()
          : createApiAiProvider(),
    },
    {
      provide: IDEA_GENERATION_PROVIDER,
      useFactory: () =>
        aiMode(process.env) === "fake"
          ? new InMemoryIdeaRankingProvider()
          : createApiAiProvider(),
    },
    {
      provide: PASSWORD_RESET_MAILER,
      useFactory: () => {
        if (process.env.NODE_ENV === "production") {
          const webhookUrl = process.env.PASSWORD_RESET_MAIL_WEBHOOK_URL;
          if (!webhookUrl) {
            throw new Error(
              "PASSWORD_RESET_MAIL_WEBHOOK_URL must be configured in production",
            );
          }
          return new WebhookPasswordResetMailer(webhookUrl);
        }
        return new DevelopmentMailSink();
      },
    },
    {
      provide: IdentityService,
      useFactory: (
        repositories: IdentityRepositories,
        mailer: DevelopmentMailSink,
      ) => new IdentityService(repositories, mailer),
      inject: [IDENTITY_REPOSITORIES, PASSWORD_RESET_MAILER],
    },
  ],
})
export class AppModule {}

async function connectMongo() {
  const uri = process.env.MONGODB_URI;
  if (!uri) return null;
  try {
    return await MongoClient.connect(uri, {
      serverSelectionTimeoutMS: Number(
        process.env.MONGODB_CONNECT_TIMEOUT_MS ?? 2500,
      ),
    });
  } catch (error) {
    if (process.env.NODE_ENV === "production") throw error;
    apiLogger.warn("database.mongo.unavailable", {
      fallback: "in-memory",
      errorType: error instanceof Error ? error.name : "unknown",
    });
    return null;
  }
}
