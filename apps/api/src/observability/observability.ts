import { MetricsRegistry, StructuredLogger } from "@creator-pulse/contracts";

export const apiLogger = new StructuredLogger("api");
export const apiMetrics = new MetricsRegistry();
