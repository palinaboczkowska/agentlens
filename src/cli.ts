#!/usr/bin/env node
import { randomUUID } from "node:crypto";
import { Command } from "commander";
import { FakeLlmClient } from "./orchestration/fakeLlmClient.js";
import type { TicketContext } from "./orchestration/context.js";
import { runPipeline } from "./orchestration/pipeline.js";
import { createClassifierAgent } from "./demo/agents/classifierAgent.js";
import { createSupervisorAgent } from "./demo/agents/supervisorAgent.js";
import { TraceRecorder } from "./tracing/recorder.js";
import { saveTrace } from "./tracing/store.js";

const program = new Command();
program
  .name("agentlens")
  .description(
    "Runs a multi-agent Claude pipeline and traces + categorizes why each run succeeded or failed.",
  );

program
  .command("demo:fake")
  .description("Run a toy 2-agent pipeline against a scripted fake LLM client (no API key needed)")
  .action(async () => {
    const llm = new FakeLlmClient([
      { category: "billing", urgency: "medium", confidenceNote: "clear duplicate charge, low ambiguity" },
      { verdict: "approve", groundednessCheck: "no draft yet in this toy run", rationale: "scaffolding smoke test" },
    ]);
    const model = "fake-model";
    const agents = [createClassifierAgent(llm, model), createSupervisorAgent(llm, model)];

    const ticketId = "toy-ticket-1";
    const runId = randomUUID();
    const recorder = new TraceRecorder(ticketId, runId);
    const initialContext: TicketContext = {
      ticket: {
        id: ticketId,
        subject: "I was charged twice this month",
        body: "Please refund the duplicate charge from last Tuesday.",
      },
    };

    const finalContext = await runPipeline(agents, initialContext, recorder);
    const trace = recorder.toTrace();
    const filePath = await saveTrace(trace);

    console.log("Pipeline finished. Final context:");
    console.log(JSON.stringify(finalContext, null, 2));
    console.log(`\nTrace written to ${filePath}`);
  });

program.parseAsync(process.argv).catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
