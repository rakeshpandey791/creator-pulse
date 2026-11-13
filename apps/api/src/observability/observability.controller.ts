import { Controller, Get, Header } from "@nestjs/common";
import { apiMetrics } from "./observability.js";

@Controller("health")
export class ObservabilityController {
  @Get("metrics")
  @Header("Cache-Control", "no-store")
  metrics() {
    return apiMetrics.snapshot();
  }
}
