import { z } from "zod";
import type { LlmClient } from "../orchestration/llmClient.js";
import type { Trace } from "../tracing/types.js";
import type { CategorizationResult, Categorizer } from "./categorizer.js";

const JudgeSchema = z.object({
  category: z.enum(["success", "bad-retrieval", "bad-reasoning", "wrong-tool-call", "hallucination"]),
  rationale: z.string(),
});

/**
 * Optional stretch categorizer: asks a (stronger) model to read the whole
 * trace and judge the outcome, for comparison against RuleBasedCategorizer
 * on the same golden set. Costs one API call per trace — unlike the rule
 * based categorizer, this is not free to run.
 */
export class LLMJudgeCategorizer implements Categorizer {
  constructor(
    private readonly llm: LlmClient,
    private readonly model: string,
  ) {}

  async categorize(trace: Trace): Promise<CategorizationResult> {
    const result = await this.llm.generateStructured({
      model: this.model,
      system:
        "You are auditing a support-ticket triage pipeline. Given the full trace of " +
        "what each agent did (classification, retrieved KB docs, drafted reply, " +
        "supervisor verdict), decide which single category best describes the outcome: " +
        "success; bad-retrieval (wrong or irrelevant docs retrieved); bad-reasoning " +
        "(retrieval was fine but the draft or verdict drew the wrong conclusion); " +
        "wrong-tool-call (the search tool was skipped, errored, or misused); or " +
        "hallucination (the draft states something not grounded in the retrieved docs " +
        "or the ticket).",
      prompt: JSON.stringify(trace, null, 2),
      schema: JudgeSchema,
    });
    return result.data;
  }
}
