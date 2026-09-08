import { pipeline } from "@xenova/transformers";
import type { RetrievedDoc } from "../orchestration/context.js";
import type { KbArticle, Retriever } from "./retriever.js";

type FeatureExtractor = (
  text: string,
  options?: { pooling?: "mean" | "cls" | "none"; normalize?: boolean },
) => Promise<{ data: Float32Array }>;

/**
 * Embedding-based retrieval that runs entirely in-process (no external
 * vector DB, no second API key): a small sentence-embedding model computes
 * one vector per KB article up front, then per query, and ranks articles by
 * cosine similarity. Swappable behind `Retriever` for a real vector DB later.
 */
export class LocalEmbeddingRetriever implements Retriever {
  private extractor: FeatureExtractor | null = null;
  private indexed: { article: KbArticle; embedding: Float32Array }[] = [];

  constructor(private readonly articles: KbArticle[]) {}

  async init(): Promise<void> {
    if (this.extractor) return;
    this.extractor = (await pipeline(
      "feature-extraction",
      "Xenova/all-MiniLM-L6-v2",
    )) as FeatureExtractor;

    this.indexed = await Promise.all(
      this.articles.map(async (article) => ({
        article,
        embedding: await this.embed(`${article.title}\n${article.content}`),
      })),
    );
  }

  async search(query: string, topK = 3): Promise<RetrievedDoc[]> {
    if (!this.extractor) {
      throw new Error("LocalEmbeddingRetriever not initialized — call init() first");
    }
    const queryEmbedding = await this.embed(query);
    const scored = this.indexed.map(({ article, embedding }) => ({
      article,
      score: cosineSimilarity(queryEmbedding, embedding),
    }));
    scored.sort((a, b) => b.score - a.score);
    return scored.slice(0, topK).map(({ article, score }) => ({
      docId: article.docId,
      title: article.title,
      content: article.content,
      score,
    }));
  }

  private async embed(text: string): Promise<Float32Array> {
    const output = await this.extractor!(text, { pooling: "mean", normalize: true });
    return output.data;
  }
}

function cosineSimilarity(a: Float32Array, b: Float32Array): number {
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i += 1) {
    const av = a[i] ?? 0;
    const bv = b[i] ?? 0;
    dot += av * bv;
    normA += av * av;
    normB += bv * bv;
  }
  const denom = Math.sqrt(normA) * Math.sqrt(normB);
  return denom === 0 ? 0 : dot / denom;
}
