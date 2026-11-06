import { describe, expect, it } from "vitest";
import { mergeRetrievedDocs } from "../../src/demo/agents/draftingAgent.js";
import type { RetrievedDoc } from "../../src/orchestration/context.js";

function doc(docId: string, score: number): RetrievedDoc {
  return { docId, title: docId, content: `content of ${docId}`, score };
}

describe("mergeRetrievedDocs", () => {
  it("keeps docs from earlier searches", () => {
    const merged = mergeRetrievedDocs([doc("kb-003", 0.75)], [doc("kb-005", 0.73)]);
    expect(merged.map((d) => d.docId)).toEqual(["kb-003", "kb-005"]);
  });

  it("keeps the best score when a doc comes back twice", () => {
    const merged = mergeRetrievedDocs([doc("kb-003", 0.5)], [doc("kb-003", 0.8)]);
    expect(merged).toHaveLength(1);
    expect(merged[0]?.score).toBe(0.8);
  });

  it("does not lower a score on a weaker repeat hit", () => {
    const merged = mergeRetrievedDocs([doc("kb-003", 0.8)], [doc("kb-003", 0.5)]);
    expect(merged[0]?.score).toBe(0.8);
  });
});
