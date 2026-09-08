import type {
  GenerateStructuredArgs,
  LlmClient,
  StructuredResult,
} from "./llmClient.js";

/**
 * Scripted LLM client for unit tests and the no-API-key `demo:fake` command.
 * Returns one canned response per call, in order, validated against the
 * caller's own schema so tests catch shape mismatches early.
 */
export class FakeLlmClient implements LlmClient {
  private callIndex = 0;

  constructor(private readonly scriptedResponses: unknown[]) {}

  async generateStructured<T>({
    schema,
  }: GenerateStructuredArgs<T>): Promise<StructuredResult<T>> {
    if (this.callIndex >= this.scriptedResponses.length) {
      throw new Error(
        `FakeLlmClient received more calls (${this.callIndex + 1}) than scripted responses (${this.scriptedResponses.length})`,
      );
    }
    const raw = this.scriptedResponses[this.callIndex];
    this.callIndex += 1;
    const data = schema.parse(raw);
    return {
      data,
      model: "fake-model",
      usage: { inputTokens: 10, outputTokens: 10 },
      stopReason: "end_turn",
    };
  }
}
