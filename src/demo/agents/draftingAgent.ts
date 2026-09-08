import { z } from "zod";
import { betaZodTool } from "@anthropic-ai/sdk/helpers/beta/zod";
import type Anthropic from "@anthropic-ai/sdk";
import type { Agent, AgentStepResult } from "../../orchestration/agent.js";
import type { RetrievedDoc, TicketContext } from "../../orchestration/context.js";
import type { Retriever } from "../../retrieval/retriever.js";

const SearchKbInputSchema = z.object({
  query: z
    .string()
    .describe("A short search query describing what information is needed from the knowledge base"),
});

/**
 * The one agent in the pipeline that uses a tool (search_kb) rather than a
 * single structured-output call. Uses the Anthropic SDK's beta Tool Runner
 * directly rather than going through the LlmClient abstraction, since the
 * tool-calling loop doesn't fit the "one schema in, one object out" shape
 * that abstraction is for.
 */
export function createDraftingAgent(
  client: Anthropic,
  retriever: Retriever,
  model: string,
): Agent<TicketContext> {
  return {
    name: "drafting",
    async run(context, recorder): Promise<AgentStepResult<TicketContext>> {
      let lastRetrievedDocs: RetrievedDoc[] = [];

      const searchKbTool = betaZodTool({
        name: "search_kb",
        description:
          "Search the support knowledge base for articles relevant to a query. " +
          "Returns up to 3 matching articles with a relevance score (higher is more relevant).",
        inputSchema: SearchKbInputSchema,
        run: async ({ query }) => {
          const startedAt = Date.now();
          try {
            const docs = await retriever.search(query, 3);
            lastRetrievedDocs = docs;
            recorder.recordToolCall({
              toolName: "search_kb",
              input: { query },
              output: docs,
              latencyMs: Date.now() - startedAt,
              isError: false,
              retrievedDocs: docs.map((doc) => ({ docId: doc.docId, score: doc.score })),
            });
            return JSON.stringify(docs);
          } catch (error) {
            recorder.recordToolCall({
              toolName: "search_kb",
              input: { query },
              latencyMs: Date.now() - startedAt,
              isError: true,
            });
            throw error;
          }
        },
      });

      const runner = client.beta.messages.toolRunner({
        model,
        max_tokens: 1024,
        max_iterations: 4,
        system:
          "You are a customer support agent. Search the knowledge base (search_kb) for " +
          "relevant articles before drafting a reply. Only state facts that are actually " +
          "present in a retrieved article or in the customer's own ticket. If nothing " +
          "relevant is found, say so plainly and set expectations honestly instead of " +
          "guessing — never invent policies, fixes, or timelines that aren't grounded in " +
          "a retrieved article. If the ticket raises more than one distinct issue, address " +
          "every issue, not just the first one.",
        messages: [
          {
            role: "user",
            content: [
              `Ticket subject: ${context.ticket.subject}`,
              `Ticket body: ${context.ticket.body}`,
              `Classification: ${JSON.stringify(context.classification ?? null)}`,
              "",
              "Draft a reply to the customer.",
            ].join("\n"),
          },
        ],
        tools: [searchKbTool],
      });

      const finalMessage = await runner.runUntilDone();
      const textBlock = finalMessage.content.find(
        (block): block is Extract<typeof block, { type: "text" }> => block.type === "text",
      );
      const draft = textBlock?.text ?? "";

      return {
        update: { draft, retrievedDocs: lastRetrievedDocs },
        rawOutput: draft,
        modelUsed: finalMessage.model,
        usage: {
          inputTokens: finalMessage.usage.input_tokens ?? 0,
          outputTokens: finalMessage.usage.output_tokens,
        },
        stopReason: finalMessage.stop_reason ?? "unknown",
      };
    },
  };
}
