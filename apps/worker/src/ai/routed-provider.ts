import {
  JsonAiClient,
  validateScript,
  type AiEnvironment,
} from "@creator-pulse/ai";
import {
  type GenerationRequest,
  type TextGenerationProvider,
} from "@creator-pulse/contracts";

export class RoutedTextGenerationProvider implements TextGenerationProvider {
  readonly name: string;
  private readonly client: JsonAiClient;
  constructor(env: AiEnvironment, fetchImpl?: typeof fetch) {
    this.client = new JsonAiClient(env, fetchImpl);
    this.name = this.client.name;
  }
  async generate(request: GenerationRequest) {
    const result = await this.client.request(request.prompt, (value) =>
      validateScript(value, request),
    );
    return { content: result.value, telemetry: result.telemetry };
  }
}
