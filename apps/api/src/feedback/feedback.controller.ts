import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Headers,
  Inject,
  Param,
  Post,
  Query,
} from "@nestjs/common";
import { IdentityService } from "../identity/identity.service.js";
import { FeedbackService, type FeedbackInput } from "./feedback.service.js";

@Controller()
export class FeedbackController {
  constructor(
    @Inject(FeedbackService) private readonly feedback: FeedbackService,
    @Inject(IdentityService) private readonly identity: IdentityService,
  ) {}

  @Post("ideas/:ideaId/feedback")
  async submit(
    @Param("ideaId") ideaId: string,
    @Body() body: FeedbackInput,
    @Headers("authorization") authorization?: string,
  ) {
    const user = await this.identity.authenticate(bearerToken(authorization));
    return this.feedback.submit(user.id, ideaId, body);
  }

  @Get("feedback/analysis")
  async analysis(
    @Headers("authorization") authorization?: string,
    @Query() query: Record<string, string | undefined> = {},
  ) {
    const user = await this.identity.authenticate(bearerToken(authorization));
    for (const field of ["languageId", "nicheId", "platformId"] as const) {
      if (query[field] !== undefined && !query[field]?.trim())
        throw new BadRequestException(`${field} must be a non-empty string`);
    }
    return this.feedback.analysis(user.id, {
      ...(query.languageId ? { languageId: query.languageId } : {}),
      ...(query.nicheId ? { nicheId: query.nicheId } : {}),
      ...(query.platformId ? { platformId: query.platformId } : {}),
    });
  }
}

function bearerToken(authorization?: string): string {
  const [scheme, token] = (authorization ?? "").split(" ");
  return scheme?.toLowerCase() === "bearer" ? (token ?? "") : "";
}
