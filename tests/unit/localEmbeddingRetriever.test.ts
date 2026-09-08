import { describe, expect, it } from "vitest";
import { LocalEmbeddingRetriever } from "../../src/retrieval/localEmbeddingRetriever.js";
import type { KbArticle } from "../../src/retrieval/retriever.js";

const articles: KbArticle[] = [
  {
    docId: "kb-lockout-failed",
    title: "Account locked — too many failed login attempts",
    content: "Wait 30 minutes or reset your password via the emailed link.",
  },
  {
    docId: "kb-lockout-suspicious",
    title: "Account locked — suspicious activity flag",
    content: "Contact support to verify your identity manually before access is restored.",
  },
  {
    docId: "kb-refund",
    title: "Refund policy — duplicate charges",
    content: "Duplicate charges are refunded automatically within 5 business days.",
  },
];

describe("LocalEmbeddingRetriever", () => {
  it(
    "ranks the most semantically relevant article first",
    async () => {
      const retriever = new LocalEmbeddingRetriever(articles);
      await retriever.init();

      const results = await retriever.search("I was charged twice, can I get my money back?", 3);

      expect(results).toHaveLength(3);
      expect(results[0]?.docId).toBe("kb-refund");
      // scores should be sorted descending
      expect(results[0]!.score).toBeGreaterThanOrEqual(results[1]!.score);
      expect(results[1]!.score).toBeGreaterThanOrEqual(results[2]!.score);
    },
    30_000, // first run downloads the embedding model
  );

  it(
    "respects topK",
    async () => {
      const retriever = new LocalEmbeddingRetriever(articles);
      await retriever.init();

      const results = await retriever.search("locked out of my account", 1);
      expect(results).toHaveLength(1);
    },
    30_000,
  );
});
