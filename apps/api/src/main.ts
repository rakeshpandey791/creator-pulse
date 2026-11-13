import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module.js";
import { configuredCorsOrigins, CORS_ALLOWED_HEADERS } from "./cors.js";
import { apiLogger, apiMetrics } from "./observability/observability.js";
import {
  createRequestId,
  withRequestId,
} from "./observability/request-context.js";

const port = Number(process.env.API_PORT ?? 3001);
const host = process.env.API_HOST ?? "127.0.0.1";
const app = await NestFactory.create(AppModule);
app.use(
  (
    request: {
      headers: Record<string, string | string[] | undefined>;
      method: string;
      path: string;
    },
    response: {
      statusCode: number;
      setHeader: (name: string, value: string) => void;
      on: (event: string, callback: () => void) => void;
    },
    next: () => void,
  ) => {
    const forwardedId = request.headers["x-request-id"];
    const id = createRequestId(
      Array.isArray(forwardedId) ? forwardedId[0] : forwardedId,
    );
    response.setHeader("x-request-id", id);
    const startedAt = performance.now();
    withRequestId(id, () => {
      response.on("finish", () => {
        const durationMs = Math.round(performance.now() - startedAt);
        apiMetrics.increment("http_requests_total", {
          method: request.method,
          route: request.path,
          status: response.statusCode,
        });
        apiMetrics.observe("http_request_duration_ms", durationMs, {
          method: request.method,
          route: request.path,
        });
        apiLogger.info("http.request.completed", {
          requestId: id,
          method: request.method,
          route: request.path,
          status: response.statusCode,
          durationMs,
        });
      });
      next();
    });
  },
);
app.setGlobalPrefix("v1");
app.enableCors({
  origin: configuredCorsOrigins(),
  credentials: true,
  methods: ["GET", "HEAD", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: [...CORS_ALLOWED_HEADERS],
});
apiMetrics.increment("cache_events_total", {
  cache: "discovery",
  outcome: "disabled",
});
await app.listen(port, host);
apiLogger.info("api.ready", { port, host });
