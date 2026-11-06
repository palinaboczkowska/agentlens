import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import type {
  GenerateStructuredArgs,
  LlmClient,
  StructuredResult,
} from "./llmClient.js";

/**
 * Real LlmClient backed by the Anthropic API's structured-output support
 * (`client.beta.messages.parse` + a Zod-derived JSON schema). Used by the
 * classifier and supervisor agents, which need a validated object back, not
 * a tool-calling loop.
 */
export class AnthropicLlmClient implements LlmClient {
  constructor(private readonly client: Anthropic = new Anthropic()) {}

  async generateStructured<T>({
    model,
    system,
    prompt,
    schema,
    maxTokens = 1024,
  }: GenerateStructuredArgs<T>): Promise<StructuredResult<T>> {
    const message = await this.client.beta.messages.parse({
      model,
      max_tokens: maxTokens,
      system,
      messages: [{ role: "user", content: prompt }],
      output_format: betaZodOutputFormat(schema),
    });

    if (message.parsed_output === null) {
      throw new Error(
        `Model returned no parsable structured output (stop_reason: ${message.stop_reason})`,
      );
    }

    return {
      data: message.parsed_output,
      model: message.model,
      usage: {
        inputTokens: message.usage.input_tokens ?? 0,
        outputTokens: message.usage.output_tokens,
      },
      stopReason: message.stop_reason ?? "unknown",
    };
  }

  /** Exposes the underlying beta client for agents that need tool use (e.g. drafting). */
  get raw(): Anthropic {
    return this.client;
  }
}
