import type { TextGenerationProvider } from "@creator-pulse/contracts";
import { DeterministicFakeTextGenerationProvider } from "./fake-provider.js";
import { GeminiTextGenerationProvider } from "./gemini-adapter.js";
import { aiMode } from "@creator-pulse/ai";
import { RoutedTextGenerationProvider } from "./routed-provider.js";

export function createTextGenerationProvider(
  env: NodeJS.ProcessEnv = process.env,
): TextGenerationProvider {
  if (aiMode(env) === "groq") return new RoutedTextGenerationProvider(env);
  if (aiMode(env) === "gemini") {
    return new GeminiTextGenerationProvider({
      apiKey: env.GEMINI_API_KEY,
      model: env.GEMINI_MODEL,
      timeoutMs: boundedTimeout(env.AI_TIMEOUT_MS),
    });
  }
  return new DeterministicFakeTextGenerationProvider();
}

function boundedTimeout(value: string | undefined) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 1_000 && parsed <= 60_000
    ? parsed
    : 20_000;
}
