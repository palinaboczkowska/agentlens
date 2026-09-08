import type { TraceRecorder } from "../tracing/recorder.js";
import type { Agent } from "./agent.js";

/**
 * Runs a fixed, sequential list of agents over a shared context, recording
 * one trace step per agent. Deliberately not a generic DAG engine — agents
 * are plain `(context) => Partial<context>` functions, so a branching or
 * parallel orchestrator could be layered on later without changing any
 * agent code.
 */
export async function runPipeline<TContext>(
  agents: Agent<TContext>[],
  initialContext: TContext,
  recorder: TraceRecorder,
): Promise<TContext> {
  let context = initialContext;
  for (const agent of agents) {
    recorder.startStep(agent.name, context);
    try {
      const result = await agent.run(context, recorder);
      recorder.endStep({
        rawOutput: result.rawOutput,
        modelUsed: result.modelUsed,
        usage: result.usage,
        stopReason: result.stopReason,
      });
      context = { ...context, ...result.update };
    } catch (error) {
      recorder.endStep({ error: error instanceof Error ? error.message : String(error) });
      throw error;
    }
  }
  return context;
}
