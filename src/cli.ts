#!/usr/bin/env node
import "dotenv/config";
import { randomUUID } from "node:crypto";
import { Command } from "commander";
import { FakeLlmClient } from "./orchestration/fakeLlmClient.js";
import type { TicketContext } from "./orchestration/context.js";
import { runPipeline } from "./orchestration/pipeline.js";
import { createClassifierAgent } from "./demo/agents/classifierAgent.js";
import { createSupervisorAgent } from "./demo/agents/supervisorAgent.js";
import { TraceRecorder } from "./tracing/recorder.js";
import { saveTrace } from "./tracing/store.js";
import { runDemo, type RetrievalFault } from "./demo/runDemo.js";
import { loadTraces } from "./reporting/loadTraces.js";
import { printRawSummary } from "./reporting/cliReport.js";
import { printEvaluationReport } from "./reporting/evaluationReport.js";
import { loadGoldenSet } from "./evaluation/goldenSet.js";
import { RuleBasedCategorizer } from "./evaluation/rules.js";
import { evaluate, type PredictionVsLabel } from "./evaluation/metrics.js";
import { LLMJudgeCategorizer } from "./evaluation/llmJudge.js";
import { AnthropicLlmClient } from "./orchestration/anthropicLlmClient.js";
import type { Categorizer, FailureCategory } from "./evaluation/categorizer.js";
import { ClaimVerifierCategorizer, createLlmVerify, withCache } from "./evaluation/claimVerifier.js";
import { loadKbArticles } from "./retrieval/kb/loadArticles.js";
import { heldOutTickets } from "./demo/heldOutTickets.js";
import { tickets } from "./demo/tickets.js";
import { buildInjectedSet } from "./evaluation/injection.js";

function parseFormat(value: string): "table" | "json" {
  if (value !== "table" && value !== "json") {
    throw new Error(`--format must be "table" or "json", got "${value}"`);
  }
  return value;
}

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
  .option("--held-out", "run the held-out tickets instead of the demo tickets", false)
  .option("--out <dir>", "where to write traces", "traces")
  .option("--only <ids>", "comma-separated ticket ids to run")
  .option("--fault <fault>", "break retrieval on purpose: wrong-docs or search-error")
  .action(async (opts: { heldOut: boolean; out: string; only?: string; fault?: RetrievalFault }) => {
    const pool = opts.heldOut ? heldOutTickets : tickets;
    const only = opts.only?.split(",");
    await runDemo({
      tickets: only ? pool.filter((ticket) => only.includes(ticket.id)) : pool,
      outDir: opts.out,
      fault: opts.fault,
    });
  });

program
  .command("inject")
  .description("Plant fabricated claims in clean traces to measure recall against a known ground truth")
  .requiredOption("--from <dir>", "directory of clean traces")
  .requiredOption("--clean <ids>", "comma-separated ids of clean tickets to inject into")
  .requiredOption("--out <dir>", "where to write the injected traces")
  .requiredOption("--golden <path>", "where to write the matching golden set")
  .action(async (opts: { from: string; clean: string; out: string; golden: string }) => {
    const count = await buildInjectedSet(opts.from, opts.clean.split(","), opts.out, opts.golden);
    console.log(`Wrote ${count} injected traces to ${opts.out}`);
  });

program
  .command("demo:report")
  .description("Print a raw, pre-evaluation summary of the traces currently saved under traces/")
  .option("--format <format>", "table or json", "table")
  .action(async (opts: { format: string }) => {
    const traces = await loadTraces();
    if (traces.length === 0) {
      console.log("No traces found under traces/. Run `demo:fake` or `demo:run` first.");
      return;
    }
    printRawSummary(traces, parseFormat(opts.format));
  });

program
  .command("evaluate")
  .description("Compare a categorizer's predictions against a hand-labeled golden set")
  .requiredOption("--golden <path>", "path to a golden-set JSON file")
  .option("--format <format>", "table or json", "table")
  .option(
    "--judge",
    "use the LLM-judge categorizer instead of the free rule-based one (costs one API call per trace, needs ANTHROPIC_API_KEY)",
    false,
  )
  .option("--judge-model <model>", "model for --judge", "claude-sonnet-5-5")
  .option("--traces <dir>", "directory of traces to evaluate", "traces")
  .option("--verify", "use the claim verifier (quote-checked, model verdicts cached with --cache)", false)
  .option("--verifier-model <model>", "model for --verify", "claude-opus-5-5")
  .option("--cache <path>", "verdict cache for --verify; with a full cache no API key is needed")
  .option("--min-accuracy <n>", "exit non-zero if overall accuracy is below n (0-1)")
  .option(
    "--min-recall <category=n...>",
    "exit non-zero if a category's recall is below n, e.g. hallucination=0.9",
  )
  .action(async (opts: {
    golden: string;
    format: string;
    judge: boolean;
    judgeModel: string;
    traces: string;
    verify: boolean;
    verifierModel: string;
    cache?: string;
    minAccuracy?: string;
    minRecall?: string[];
  }) => {
    const format = parseFormat(opts.format);
    const [goldenSet, traces] = await Promise.all([loadGoldenSet(opts.golden), loadTraces(opts.traces)]);
    const traceById = new Map(traces.map((t) => [t.ticketId, t]));

    let categorizer: Categorizer;
    if (opts.verify) {
      const kb = await loadKbArticles();
      const live = process.env.ANTHROPIC_API_KEY
        ? createLlmVerify(new AnthropicLlmClient(), opts.verifierModel, kb)
        : undefined;
      if (!live && !opts.cache) {
        throw new Error("--verify needs ANTHROPIC_API_KEY or a --cache file.");
      }
      const verify = opts.cache ? withCache(opts.cache, live) : live!;
      categorizer = new ClaimVerifierCategorizer(verify, new Set(kb.map((article) => article.docId)));
    } else if (opts.judge) {
      if (!process.env.ANTHROPIC_API_KEY) {
        throw new Error("--judge needs ANTHROPIC_API_KEY set (it calls the Anthropic API).");
      }
      categorizer = new LLMJudgeCategorizer(new AnthropicLlmClient(), opts.judgeModel);
    } else {
      categorizer = new RuleBasedCategorizer();
    }

    const predictions: PredictionVsLabel[] = [];
    for (const entry of goldenSet) {
      const trace = traceById.get(entry.ticketId);
      if (!trace) {
        console.warn(`No trace found under traces/ for ticket "${entry.ticketId}", skipping.`);
        continue;
      }
      const result = await categorizer.categorize(trace);
      predictions.push({ ticketId: entry.ticketId, predicted: result.category, actual: entry.label });
      if (result.category !== entry.label && format === "table") {
        console.log(`MISS ${entry.ticketId}: said ${result.category}, label ${entry.label}. ${result.rationale}`);
      }
    }

    if (predictions.length === 0) {
      console.log("No golden-set entries matched a saved trace — nothing to evaluate.");
      return;
    }

    const report = evaluate(predictions);
    printEvaluationReport(report, format);

    const failures: string[] = [];
    if (opts.minAccuracy && report.overallAccuracy < Number(opts.minAccuracy)) {
      failures.push(`accuracy ${report.overallAccuracy.toFixed(2)} < ${opts.minAccuracy}`);
    }
    for (const gate of opts.minRecall ?? []) {
      const [category, min] = gate.split("=") as [FailureCategory, string];
      const recall = report.perCategory.find((m) => m.category === category)?.recall ?? 0;
      if (recall < Number(min)) failures.push(`${category} recall ${recall.toFixed(2)} < ${min}`);
    }
    if (failures.length > 0) {
      console.error(`Quality gate failed: ${failures.join(", ")}`);
      process.exitCode = 1;
    }
  });

program.parseAsync(process.argv).catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
