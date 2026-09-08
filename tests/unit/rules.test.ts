import { describe, expect, it } from "vitest";
import { categorizeByRules } from "../../src/evaluation/rules.js";
import type { StepTrace, Trace, ToolCallTrace } from "../../src/tracing/types.js";

function makeStep(overrides: Partial<StepTrace> & { agentName: string }): StepTrace {
  return {
    startedAt: "2026-01-01T00:00:00.000Z",
    endedAt: "2026-01-01T00:00:01.000Z",
    durationMs: 1000,
    input: {},
    toolCalls: [],
    ...overrides,
  };
}

function makeTrace(steps: StepTrace[]): Trace {
  return { ticketId: "t-test", runId: "run-test", createdAt: "2026-01-01T00:00:00.000Z", steps };
}

function searchKbCall(overrides: Partial<ToolCallTrace> = {}): ToolCallTrace {
  return {
    toolName: "search_kb",
    input: { query: "some query" },
    output: [],
    latencyMs: 50,
    isError: false,
    retrievedDocs: [],
    ...overrides,
  };
}

describe("categorizeByRules", () => {
  it("returns success when everything is grounded and the supervisor approves", () => {
    const trace = makeTrace([
      makeStep({
        agentName: "classifier",
        input: { ticket: { id: "t-01", subject: "s", body: "I was charged twice, please refund" } },
        rawOutput: { category: "billing", urgency: "medium", confidenceNote: "clear" },
      }),
      makeStep({
        agentName: "drafting",
        toolCalls: [
          searchKbCall({
            output: [
              {
                docId: "kb-003",
                title: "Refund policy",
                content: "Duplicate charges are refunded automatically within 5 business days.",
                score: 0.8,
              },
            ],
            retrievedDocs: [{ docId: "kb-003", score: 0.8 }],
          }),
        ],
        rawOutput: "We'll refund the duplicate charge automatically within 5 business days.",
      }),
      makeStep({
        agentName: "supervisor",
        rawOutput: { verdict: "approve", groundednessCheck: "matches kb-003", rationale: "grounded" },
      }),
    ]);

    expect(categorizeByRules(trace).category).toBe("success");
  });

  it("flags wrong-tool-call when drafting never calls search_kb", () => {
    const trace = makeTrace([
      makeStep({ agentName: "classifier", rawOutput: { category: "billing", urgency: "low", confidenceNote: "" } }),
      makeStep({ agentName: "drafting", toolCalls: [], rawOutput: "Sure, I'll refund that." }),
      makeStep({ agentName: "supervisor", rawOutput: { verdict: "approve", groundednessCheck: "", rationale: "" } }),
    ]);
    const result = categorizeByRules(trace);
    expect(result.category).toBe("wrong-tool-call");
  });

  it("flags wrong-tool-call when a step recorded an error", () => {
    const trace = makeTrace([makeStep({ agentName: "classifier", error: "model timeout" })]);
    expect(categorizeByRules(trace).category).toBe("wrong-tool-call");
  });

  it("flags bad-retrieval when the top score is below the threshold", () => {
    const trace = makeTrace([
      makeStep({
        agentName: "classifier",
        rawOutput: { category: "technical-bug", urgency: "medium", confidenceNote: "" },
      }),
      makeStep({
        agentName: "drafting",
        toolCalls: [
          searchKbCall({
            output: [{ docId: "kb-005", title: "PDF export (macOS)", content: "Mac-only fix.", score: 0.12 }],
            retrievedDocs: [{ docId: "kb-005", score: 0.12 }],
          }),
        ],
        rawOutput: "Here's a fix for your issue.",
      }),
      makeStep({ agentName: "supervisor", rawOutput: { verdict: "approve", groundednessCheck: "", rationale: "" } }),
    ]);
    expect(categorizeByRules(trace).category).toBe("bad-retrieval");
  });

  it("flags hallucination when the draft states an ungrounded numeric claim", () => {
    const trace = makeTrace([
      makeStep({
        agentName: "classifier",
        input: { ticket: { id: "t-16", subject: "s", body: "please add dark mode" } },
        rawOutput: { category: "feature-request", urgency: "low", confidenceNote: "" },
      }),
      makeStep({
        agentName: "drafting",
        toolCalls: [
          searchKbCall({
            output: [{ docId: "kb-014", title: "Supported browsers", content: "Chrome, Firefox, Edge, Safari.", score: 0.4 }],
            retrievedDocs: [{ docId: "kb-014", score: 0.4 }],
          }),
        ],
        rawOutput: "Great news, dark mode will ship within 30 days!",
      }),
      makeStep({ agentName: "supervisor", rawOutput: { verdict: "approve", groundednessCheck: "", rationale: "" } }),
    ]);
    expect(categorizeByRules(trace).category).toBe("hallucination");
  });

  it("flags bad-reasoning when the supervisor rejects despite clean retrieval and no hallucination", () => {
    const trace = makeTrace([
      makeStep({
        agentName: "classifier",
        input: { ticket: { id: "t-13", subject: "s", body: "locked out, no email" } },
        rawOutput: { category: "account-access", urgency: "medium", confidenceNote: "" },
      }),
      makeStep({
        agentName: "drafting",
        toolCalls: [
          searchKbCall({
            output: [
              {
                docId: "kb-002",
                title: "Suspicious activity lock",
                content: "Contact support to verify your identity manually before access is restored.",
                score: 0.75,
              },
            ],
            retrievedDocs: [{ docId: "kb-002", score: 0.75 }],
          }),
        ],
        rawOutput: "Contact support to verify your identity manually.",
      }),
      makeStep({
        agentName: "supervisor",
        rawOutput: { verdict: "reject", groundednessCheck: "wrong remediation applied", rationale: "" },
      }),
    ]);
    expect(categorizeByRules(trace).category).toBe("bad-reasoning");
  });
});
