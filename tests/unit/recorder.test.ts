import { describe, expect, it } from "vitest";
import { TraceRecorder } from "../../src/tracing/recorder.js";

describe("TraceRecorder", () => {
  it("throws if a step is started while another is still open", () => {
    const recorder = new TraceRecorder("t-1", "run-1");
    recorder.startStep("agent-a", { foo: "bar" });
    expect(() => recorder.startStep("agent-b", {})).toThrow();
  });

  it("throws if endStep or recordToolCall is called with no open step", () => {
    const recorder = new TraceRecorder("t-1", "run-1");
    expect(() => recorder.endStep()).toThrow();
    expect(() =>
      recorder.recordToolCall({
        toolName: "search_kb",
        input: {},
        latencyMs: 5,
        isError: false,
      }),
    ).toThrow();
  });

  it("attaches tool calls made while a step is open to that step", () => {
    const recorder = new TraceRecorder("t-1", "run-1");
    recorder.startStep("drafting", { query: "refund" });
    recorder.recordToolCall({
      toolName: "search_kb",
      input: { query: "refund" },
      output: { docId: "kb-1" },
      latencyMs: 12,
      isError: false,
    });
    recorder.endStep({ rawOutput: "draft text" });

    const trace = recorder.toTrace();
    expect(trace.steps).toHaveLength(1);
    expect(trace.steps[0]?.toolCalls).toHaveLength(1);
    expect(trace.steps[0]?.toolCalls[0]?.toolName).toBe("search_kb");
  });
});
