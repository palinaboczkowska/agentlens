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
import { runDemo } from "./demo/runDemo.js";
import { loadTraces } from "./reporting/loadTraces.js";
import { printRawSummary } from "./reporting/cliReport.js";
import { printEvaluationReport } from "./reporting/evaluationReport.js";
import { loadGoldenSet } from "./evaluation/goldenSet.js";
import { RuleBasedCategorizer } from "./evaluation/rules.js";
import { evaluate, type PredictionVsLabel } from "./evaluation/metrics.js";

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

program
  .command("demo:run")
  .description("Run the real 3-agent ticket-triage pipeline against every synthetic ticket (needs ANTHROPIC_API_KEY)")
  .action(async () => {
    await runDemo();
  });

program
  .command("demo:report")
  .description("Print a raw, pre-evaluation summary of the traces currently saved under traces/")
  .action(async () => {
    const traces = await loadTraces();
    if (traces.length === 0) {
      console.log("No traces found under traces/. Run `demo:fake` or `demo:run` first.");
      return;
    }
    printRawSummary(traces);
  });

program
  .command("evaluate")
  .description("Compare the rule-based categorizer's predictions against a hand-labeled golden set")
  .requiredOption("--golden <path>", "path to a golden-set JSON file")
  .action(async (opts: { golden: string }) => {
    const [goldenSet, traces] = await Promise.all([loadGoldenSet(opts.golden), loadTraces()]);
    const traceById = new Map(traces.map((t) => [t.ticketId, t]));
    const categorizer = new RuleBasedCategorizer();

    const predictions: PredictionVsLabel[] = [];
    for (const entry of goldenSet) {
      const trace = traceById.get(entry.ticketId);
      if (!trace) {
        console.warn(`No trace found under traces/ for ticket "${entry.ticketId}", skipping.`);
        continue;
      }
      const result = await categorizer.categorize(trace);
      predictions.push({ ticketId: entry.ticketId, predicted: result.category, actual: entry.label });
    }

    if (predictions.length === 0) {
      console.log("No golden-set entries matched a saved trace — nothing to evaluate.");
      return;
    }

    printEvaluationReport(evaluate(predictions));
  });

program.parseAsync(process.argv).catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
