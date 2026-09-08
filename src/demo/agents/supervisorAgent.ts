import { z } from "zod";
import type { Agent, AgentStepResult } from "../../orchestration/agent.js";
import type { SupervisorVerdict, TicketContext } from "../../orchestration/context.js";
import type { LlmClient } from "../../orchestration/llmClient.js";

export const SupervisorVerdictSchema = z.object({
  verdict: z.enum(["approve", "reject"]),
  groundednessCheck: z.string(),
  rationale: z.string(),
});

export function createSupervisorAgent(llm: LlmClient, model: string): Agent<TicketContext> {
  return {
    name: "supervisor",
    async run(context): Promise<AgentStepResult<TicketContext>> {
      const result = await llm.generateStructured({
        model,
        system:
          "You review a draft support reply against the retrieved knowledge-base " +
          "content and the original ticket, and approve or reject it based on " +
          "whether every claim in the draft is actually grounded in what was retrieved.",
        prompt: [
          `Ticket: ${context.ticket.subject} — ${context.ticket.body}`,
          `Classification: ${JSON.stringify(context.classification ?? null)}`,
          `Retrieved docs: ${JSON.stringify(context.retrievedDocs ?? [])}`,
          `Draft reply: ${context.draft ?? "(no draft)"}`,
        ].join("\n"),
        schema: SupervisorVerdictSchema,
      });
      const supervisorVerdict: SupervisorVerdict = result.data;
      return {
        update: { supervisorVerdict },
        rawOutput: result.data,
        modelUsed: result.model,
        usage: result.usage,
        stopReason: result.stopReason,
      };
    },
  };
}
