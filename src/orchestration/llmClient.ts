import type { ZodType } from "zod";

export interface LlmUsage {
  inputTokens: number;
  outputTokens: number;
}

export interface StructuredResult<T> {
  data: T;
  model: string;
  usage: LlmUsage;
  stopReason: string;
}

export interface GenerateStructuredArgs<T> {
  model: string;
  system: string;
  prompt: string;
  schema: ZodType<T>;
}

/**
 * Abstraction over "ask a model for a structured (schema-validated) answer".
 * Real implementation wraps the Anthropic SDK; tests use FakeLlmClient so the
 * orchestration engine is fully testable with zero API calls.
 */
export interface LlmClient {
  generateStructured<T>(args: GenerateStructuredArgs<T>): Promise<StructuredResult<T>>;
}
