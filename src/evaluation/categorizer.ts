import type { Trace } from "../tracing/types.js";

export type FailureCategory =
  | "success"
  | "bad-retrieval"
  | "bad-reasoning"
  | "wrong-tool-call"
  | "hallucination";

export const FAILURE_CATEGORIES: FailureCategory[] = [
  "success",
  "bad-retrieval",
  "bad-reasoning",
  "wrong-tool-call",
  "hallucination",
];

export interface CategorizationResult {
  category: FailureCategory;
  rationale: string;
}

/** Something that can look at a completed pipeline Trace and judge the outcome. */
export interface Categorizer {
  categorize(trace: Trace): Promise<CategorizationResult>;
}
