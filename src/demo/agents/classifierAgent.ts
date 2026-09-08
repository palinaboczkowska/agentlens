import { z } from "zod";
import type { Agent, AgentStepResult } from "../../orchestration/agent.js";
import type { Classification, TicketContext } from "../../orchestration/context.js";
import type { LlmClient } from "../../orchestration/llmClient.js";

export const ClassificationSchema = z.object({
  category: z.enum(["billing", "technical-bug", "account-access", "feature-request", "other"]),
  urgency: z.enum(["low", "medium", "high"]),
  confidenceNote: z.string(),
});

export function createClassifierAgent(llm: LlmClient, model: string): Agent<TicketContext> {
  return {
    name: "classifier",
    async run(context): Promise<AgentStepResult<TicketContext>> {
      const result = await llm.generateStructured({
        model,
        system:
          "You classify customer support tickets by category and urgency. " +
          "Be honest about ambiguity in the confidenceNote field.",
        prompt: `Ticket subject: ${context.ticket.subject}\nBody: ${context.ticket.body}`,
        schema: ClassificationSchema,
      });
      const classification: Classification = result.data;
      return {
        update: { classification },
        rawOutput: result.data,
        modelUsed: result.model,
        usage: result.usage,
        stopReason: result.stopReason,
      };
    },
  };
}
