import "dotenv/config";
import { randomUUID } from "node:crypto";
import Anthropic from "@anthropic-ai/sdk";
import pc from "picocolors";
import { AnthropicLlmClient } from "../orchestration/anthropicLlmClient.js";
import { runPipeline } from "../orchestration/pipeline.js";
import { TraceRecorder } from "../tracing/recorder.js";
import { saveTrace } from "../tracing/store.js";
import { createClassifierAgent } from "./agents/classifierAgent.js";
import { createDraftingAgent } from "./agents/draftingAgent.js";
import { createSupervisorAgent } from "./agents/supervisorAgent.js";
import { LocalEmbeddingRetriever } from "../retrieval/localEmbeddingRetriever.js";
import { loadKbArticles } from "../retrieval/kb/loadArticles.js";
import { tickets } from "./tickets.js";
import type { TicketContext } from "../orchestration/context.js";

const PIPELINE_MODEL = process.env.AGENTLENS_MODEL ?? "claude-haiku-4-5";

export async function runDemo(): Promise<void> {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error(
      "ANTHROPIC_API_KEY is not set. Copy .env.example to .env and fill in your key.",
    );
  }

  const anthropicLlm = new AnthropicLlmClient(new Anthropic());

  console.log(pc.dim("Loading local embedding model (first run downloads it, then it's cached)..."));
  const kbArticles = await loadKbArticles();
  const retriever = new LocalEmbeddingRetriever(kbArticles);
  await retriever.init();

  const classifier = createClassifierAgent(anthropicLlm, PIPELINE_MODEL);
  const drafting = createDraftingAgent(anthropicLlm.raw, retriever, PIPELINE_MODEL);
  const supervisor = createSupervisorAgent(anthropicLlm, PIPELINE_MODEL);

  const runId = randomUUID();
  let completed = 0;

  console.log(pc.dim(`Running ${tickets.length} tickets through the pipeline (model: ${PIPELINE_MODEL})...\n`));

  for (const ticket of tickets) {
    const recorder = new TraceRecorder(ticket.id, runId);
    const initialContext: TicketContext = { ticket };
    try {
      await runPipeline([classifier, drafting, supervisor], initialContext, recorder);
    } catch (error) {
      console.error(
        pc.red(`  ${ticket.id} failed: ${error instanceof Error ? error.message : String(error)}`),
      );
    }
    const filePath = await saveTrace(recorder.toTrace());
    completed += 1;
    console.log(pc.dim(`[${completed}/${tickets.length}] ${ticket.id} -> ${filePath}`));
  }

  console.log(pc.green(`\nDone. ${completed} traces written to traces/.`));
  console.log(pc.dim("Run `npm run cli -- demo:report` to see a summary."));
}
