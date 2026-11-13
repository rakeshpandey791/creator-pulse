import {
  Body,
  Controller,
  Get,
  Headers,
  HttpException,
  HttpStatus,
  Inject,
  Param,
  Post,
  UnauthorizedException,
} from "@nestjs/common";
import { IdentityService } from "../identity/identity.service.js";
import {
  InsufficientCreditsError,
  GenerationService,
  type GenerationInput,
} from "./generation.service.js";

@Controller()
export class GenerationController {
  constructor(
    @Inject(GenerationService)
    private readonly generations: GenerationService,
    @Inject(IdentityService)
    private readonly identity: IdentityService,
  ) {}

  @Post("ideas/:ideaId/generations")
  async start(
    @Param("ideaId") ideaId: string,
    @Body() body: GenerationInput,
    @Headers("idempotency-key") idempotencyKey?: string,
    @Headers("authorization") authorization?: string,
  ) {
    const user = await this.identity.authenticate(bearerToken(authorization));
    try {
      return await this.generations.start(
        user.id,
        ideaId,
        body,
        idempotencyKey ?? "",
      );
    } catch (error) {
      if (error instanceof InsufficientCreditsError) {
        throw new HttpException(
          {
            error: "Payment Required",
            message: error.message,
            code: error.code,
          },
          HttpStatus.PAYMENT_REQUIRED,
        );
      }
      throw error;
    }
  }

  @Get("operations/:operationId")
  async status(
    @Param("operationId") operationId: string,
    @Headers("authorization") authorization?: string,
  ) {
    const user = await this.identity.authenticate(bearerToken(authorization));
    return this.generations.getStatus(user.id, operationId);
  }

  @Post("operations/:operationId/cancel")
  async cancel(
    @Param("operationId") operationId: string,
    @Headers("authorization") authorization?: string,
  ) {
    const user = await this.identity.authenticate(bearerToken(authorization));
    return this.generations.cancel(user.id, operationId);
  }

  @Post("internal/generation/jobs/:operationId")
  async processInternal(
    @Param("operationId") operationId: string,
    @Headers("x-generation-worker-secret") workerSecret?: string,
  ) {
    if (
      !process.env.GENERATION_WORKER_SECRET ||
      workerSecret !== process.env.GENERATION_WORKER_SECRET
    )
      throw new UnauthorizedException();
    await this.generations.process({ operationId });
    return { accepted: true };
  }
}

function bearerToken(authorization?: string): string {
  const [scheme, token] = (authorization ?? "").split(" ");
  return scheme?.toLowerCase() === "bearer" ? (token ?? "") : "";
}
