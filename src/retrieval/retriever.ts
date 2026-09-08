import type { RetrievedDoc } from "../orchestration/context.js";

export interface KbArticle {
  docId: string;
  title: string;
  content: string;
}

/**
 * Abstraction over "find KB articles relevant to a query". The demo uses a
 * local embedding index (no hosted vector DB); a real one could be swapped
 * in later without touching the agents that depend on this interface.
 */
export interface Retriever {
  search(query: string, topK?: number): Promise<RetrievedDoc[]>;
}
