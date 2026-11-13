const LOCAL_ORIGINS = ["http://localhost:3000", "http://127.0.0.1:3000"];

export const CORS_ALLOWED_HEADERS = [
  "Content-Type",
  "Authorization",
  "Idempotency-Key",
] as const;

export function configuredCorsOrigins(value = process.env.CORS_ORIGINS) {
  const origins = (value ?? "")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
  return origins.length > 0 ? origins : LOCAL_ORIGINS;
}
