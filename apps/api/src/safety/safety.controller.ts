import {
  Body,
  Controller,
  Inject,
  Post,
  UnprocessableEntityException,
} from "@nestjs/common";
import type { SafetyCheckInput } from "@creator-pulse/contracts";
import { SafetyService } from "./safety.service.js";

@Controller("safety")
export class SafetyController {
  constructor(@Inject(SafetyService) private readonly safety: SafetyService) {}

  @Post("check")
  check(@Body() input: SafetyCheckInput) {
    return this.safety.check(input);
  }

  @Post("publish")
  async publish(@Body() input: SafetyCheckInput) {
    try {
      const result = await this.safety.assertPublishable(input);
      return { status: "approved" as const, report: result.report };
    } catch (error) {
      throw new UnprocessableEntityException({
        code: "SAFETY_REVIEW_REQUIRED",
        message:
          error instanceof Error ? error.message : "Safety review required",
      });
    }
  }
}
