import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Delete,
  Headers,
  Inject,
  Param,
  Post,
  Query,
} from "@nestjs/common";
import { IdentityService } from "../identity/identity.service.js";
import { DiscoveryService, type IdeaStatus } from "./discovery.service.js";

@Controller()
export class DiscoveryController {
  constructor(
    @Inject(DiscoveryService) private readonly discovery: DiscoveryService,
    @Inject(IdentityService) private readonly identity: IdentityService,
  ) {}

  @Get("feed/daily")
  async dailyFeed(
    @Headers("authorization") authorization?: string,
    @Query() query: Record<string, string | undefined> = {},
  ) {
    const user = await this.identity.authenticate(bearerToken(authorization));
    return this.discovery.dailyFeed(user.id, {
      limit: parseLimit(query.limit),
      cursor: query.cursor,
      languageId: query.languageId,
      platformId: query.platformId,
      nicheId: query.nicheId,
    });
  }

  @Get("ideas/search")
  async search(
    @Headers("authorization") authorization?: string,
    @Query() query: Record<string, string | undefined> = {},
  ) {
    const user = await this.identity.authenticate(bearerToken(authorization));
    return this.discovery.search(
      {
        query: query.q,
        limit: parseLimit(query.limit),
        cursor: query.cursor,
        languageId: query.languageId,
        platformId: query.platformId,
        nicheId: query.nicheId,
      },
      user.id,
    );
  }

  @Get("ideas/:ideaId")
  async detail(
    @Param("ideaId") ideaId: string,
    @Headers("authorization") authorization?: string,
  ) {
    await this.identity.authenticate(bearerToken(authorization));
    return this.discovery.detail(ideaId);
  }

  @Get("library")
  async library(
    @Headers("authorization") authorization?: string,
    @Query() query: Record<string, string | undefined> = {},
  ) {
    const user = await this.identity.authenticate(bearerToken(authorization));
    return this.discovery.library(user.id, {
      limit: parseLimit(query.limit),
      cursor: query.cursor,
      status: parseStatus(query.status),
    });
  }

  @Get("ideas/:ideaId/status")
  async status(
    @Param("ideaId") ideaId: string,
    @Headers("authorization") authorization?: string,
  ) {
    const user = await this.identity.authenticate(bearerToken(authorization));
    return this.discovery.status(user.id, ideaId);
  }

  @Post("ideas/:ideaId/actions")
  async action(
    @Param("ideaId") ideaId: string,
    @Body() body: { action?: string },
    @Headers("authorization") authorization?: string,
  ) {
    const user = await this.identity.authenticate(bearerToken(authorization));
    if (body.action !== "save" && body.action !== "dismiss") {
      throw new BadRequestException("action must be save or dismiss");
    }
    return this.discovery.updateIdeaAction(user.id, ideaId, body.action);
  }

  @Post("ideas/:ideaId/save")
  async save(
    @Param("ideaId") ideaId: string,
    @Body() body: { bookmarkLabel?: string },
    @Headers("authorization") authorization?: string,
  ) {
    const user = await this.identity.authenticate(bearerToken(authorization));
    return this.discovery.saveIdea(user.id, ideaId, body.bookmarkLabel);
  }

  @Delete("ideas/:ideaId/save")
  async removeSave(
    @Param("ideaId") ideaId: string,
    @Headers("authorization") authorization?: string,
  ) {
    const user = await this.identity.authenticate(bearerToken(authorization));
    return this.discovery.removeSavedIdea(user.id, ideaId);
  }

  @Post("ideas/:ideaId/status")
  async updateStatus(
    @Param("ideaId") ideaId: string,
    @Body() body: { status?: string; note?: string },
    @Headers("authorization") authorization?: string,
  ) {
    const user = await this.identity.authenticate(bearerToken(authorization));
    const status = parseStatus(body.status);
    if (!status) throw new BadRequestException("status is required");
    return this.discovery.transitionIdeaStatus(
      user.id,
      ideaId,
      status,
      body.note,
    );
  }

  @Post("ideas/:ideaId/drafts")
  async startDraft(
    @Param("ideaId") ideaId: string,
    @Headers("authorization") authorization?: string,
  ) {
    const user = await this.identity.authenticate(bearerToken(authorization));
    return this.discovery.startDraft(user.id, ideaId);
  }
}

function parseLimit(value?: string) {
  if (value === undefined) return 20;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > 100) {
    throw new BadRequestException("limit must be an integer from 1 to 100");
  }
  return parsed;
}

function parseStatus(value?: string): IdeaStatus | undefined {
  if (value === undefined) return undefined;
  if (
    !["saved", "planned", "scripted", "published", "dismissed"].includes(value)
  )
    throw new BadRequestException(
      "status must be saved, planned, scripted, published, or dismissed",
    );
  return value as IdeaStatus;
}

function bearerToken(authorization?: string): string {
  const [scheme, token] = (authorization ?? "").split(" ");
  return scheme?.toLowerCase() === "bearer" ? (token ?? "") : "";
}
