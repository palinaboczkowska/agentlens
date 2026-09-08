import { describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import { runPipeline } from "../../src/orchestration/pipeline.js";
import { TraceRecorder } from "../../src/tracing/recorder.js";
import { TraceSchema } from "../../src/tracing/types.js";
import { FakeLlmClient } from "../../src/orchestration/fakeLlmClient.js";
import { createClassifierAgent } from "../../src/demo/agents/classifierAgent.js";
import { createSupervisorAgent } from "../../src/demo/agents/supervisorAgent.js";
import type { TicketContext } from "../../src/orchestration/context.js";

function buildContext(): TicketContext {
  return {
    ticket: {
      id: "t-1",
      subject: "I was charged twice",
      body: "Please refund the duplicate charge.",
    },
  };
}

describe("runPipeline", () => {
  it("merges each agent's update into the running context, in order", async () => {
    const llm = new FakeLlmClient([
      { category: "billing", urgency: "medium", confidenceNote: "clear case" },
      { verdict: "approve", groundednessCheck: "n/a", rationale: "looks fine" },
    ]);
    const agents = [createClassifierAgent(llm, "fake-model"), createSupervisorAgent(llm, "fake-model")];
    const recorder = new TraceRecorder("t-1", randomUUID());

    const result = await runPipeline(agents, buildContext(), recorder);

    expect(result.classification).toEqual({
      category: "billing",
      urgency: "medium",
      confidenceNote: "clear case",
    });
    expect(result.supervisorVerdict).toEqual({
      verdict: "approve",
      groundednessCheck: "n/a",
      rationale: "looks fine",
    });
  });

  it("produces a schema-valid trace with one step per agent, in order", async () => {
    const llm = new FakeLlmClient([
      { category: "technical-bug", urgency: "high", confidenceNote: "app crash" },
      { verdict: "reject", groundednessCheck: "draft invents a fix not in the KB", rationale: "hallucination" },
    ]);
    const agents = [createClassifierAgent(llm, "fake-model"), createSupervisorAgent(llm, "fake-model")];
    const recorder = new TraceRecorder("t-2", randomUUID());

    await runPipeline(agents, buildContext(), recorder);
    const trace = recorder.toTrace();

    expect(() => TraceSchema.parse(trace)).not.toThrow();
    expect(trace.steps.map((s) => s.agentName)).toEqual(["classifier", "supervisor"]);
    for (const step of trace.steps) {
      expect(step.error).toBeUndefined();
      expect(step.durationMs).toBeGreaterThanOrEqual(0);
      expect(step.modelUsed).toBe("fake-model");
    }
  });

  it("records an error step and rethrows when an agent fails", async () => {
    const llm = new FakeLlmClient([]); // no scripted responses -> first call throws
    const agents = [createClassifierAgent(llm, "fake-model")];
    const recorder = new TraceRecorder("t-3", randomUUID());

    await expect(runPipeline(agents, buildContext(), recorder)).rejects.toThrow();

    const trace = recorder.toTrace();
    expect(trace.steps).toHaveLength(1);
    expect(trace.steps[0]?.error).toBeDefined();
  });
});
