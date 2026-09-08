import type { TraceRecorder } from "../tracing/recorder.js";
import type { LlmUsage } from "./llmClient.js";

export interface AgentStepResult<TContext> {
  /** Fields this agent contributes to the shared context. */
  update: Partial<TContext>;
  rawOutput?: unknown;
  modelUsed?: string;
  usage?: LlmUsage;
  stopReason?: string;
}

/**
 * One step in a pipeline. Agents read the current context and return only
 * the fields they add — the pipeline merges updates into a running context.
 * The recorder is passed in so agents that call tools (e.g. a KB search) can
 * log each call via `recorder.recordToolCall(...)` while their step is open.
 */
export interface Agent<TContext> {
  readonly name: string;
  run(
    context: Readonly<TContext>,
    recorder: TraceRecorder,
  ): Promise<AgentStepResult<TContext>>;
}
