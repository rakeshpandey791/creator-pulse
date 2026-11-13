export type HealthStatus = "ok";

export interface HealthResponse {
  status: HealthStatus;
  service: string;
  timestamp: string;
}

export * from "./language.js";
export * from "./safety.js";
export * from "./ai.js";
export * from "./telemetry.js";
