import { describe, expect, it } from "vitest";
import {
  categorizeVerification,
  checkQuote,
  type Verification,
} from "../../src/evaluation/claimVerifier.js";
import { injectClaim } from "../../src/evaluation/injection.js";
import type { Trace } from "../../src/tracing/types.js";

const doc = { docId: "kb-003", title: "Refunds", content: "Duplicate charges are refunded within 5 business days.", score: 0.8 };
const step = { startedAt: "", endedAt: "", durationMs: 1, toolCalls: [] };
const trace: Trace = {
  ticketId: "t-1",
  runId: "r-1",
  createdAt: "",
  steps: [
    { ...step, agentName: "classifier", input: { ticket: { id: "t-1", subject: "Refund", body: "Charged twice." } } },
    {
      ...step,
      agentName: "drafting",
      input: {},
      rawOutput: "Refunded within 5 business days.",
      toolCalls: [{ toolName: "search_kb", input: { query: "refund" }, output: [doc], latencyMs: 1, isError: false, retrievedDocs: [{ docId: "kb-003", score: 0.8 }] }],
    },
  ],
};
const known = new Set(["kb-003", "kb-007"]);

function claim(overrides: Partial<Verification["claims"][number]>): Verification["claims"][number] {
  return { claim: "c", verdict: "supported", severity: "material", evidenceQuote: "refunded within 5 business days", evidenceSource: "kb-003", note: "", ...overrides };
}

function verification(overrides: Partial<Verification> = {}): Verification {
  return { claims: [claim({})], unansweredAsks: [], answerInUnretrievedArticle: null, ...overrides };
}

describe("checkQuote", () => {
  it("accepts a quote that is really in the named source", () => {
    expect(checkQuote(claim({}), trace)).toBe(true);
  });

  it("rejects a quote the source doesn't contain", () => {
    expect(checkQuote(claim({ evidenceQuote: "refunded within 1 business day" }), trace)).toBe(false);
  });

  it("rejects a real quote attributed to the wrong source", () => {
    expect(checkQuote(claim({ evidenceSource: "ticket" }), trace)).toBe(false);
  });
});

describe("categorizeVerification", () => {
  it("passes when every claim has a real quote", () => {
    expect(categorizeVerification(trace, verification(), known).category).toBe("success");
  });

  it("overrules the model when its quote is fake", () => {
    const fake = verification({ claims: [claim({ evidenceQuote: "made up" })] });
    expect(categorizeVerification(trace, fake, known).category).toBe("hallucination");
  });

  it("ignores minor claims", () => {
    const minor = verification({ claims: [claim({ verdict: "invented", severity: "minor" })] });
    expect(categorizeVerification(trace, minor, known).category).toBe("success");
  });

  it("reports stretched sources as bad reasoning", () => {
    const stretched = verification({ claims: [claim({ verdict: "unjustified-inference" })] });
    expect(categorizeVerification(trace, stretched, known).category).toBe("bad-reasoning");
  });

  it("reports an unanswered ask as bad reasoning", () => {
    expect(categorizeVerification(trace, verification({ unansweredAsks: ["the refund"] }), known).category).toBe("bad-reasoning");
  });

  it("reports a missed article as bad retrieval", () => {
    const missed = verification({ answerInUnretrievedArticle: "kb-007" });
    expect(categorizeVerification(trace, missed, known).category).toBe("bad-retrieval");
  });

  it("doesn't trust a doc id the KB doesn't have", () => {
    const missed = verification({ answerInUnretrievedArticle: "kb-999" });
    expect(categorizeVerification(trace, missed, known).category).toBe("success");
  });
});

describe("injectClaim", () => {
  it("appends the claim under a new id without touching the source", () => {
    const injected = injectClaim(trace, "We are HIPAA certified.", 3);
    expect(injected.ticketId).toBe("t-1-m03");
    expect(injected.steps[1]?.rawOutput).toContain("We are HIPAA certified.");
    expect(trace.steps[1]?.rawOutput).not.toContain("HIPAA");
  });
});
