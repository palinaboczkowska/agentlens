import Table from "cli-table3";
import pc from "picocolors";
import type { Trace } from "../tracing/types.js";
import type { Classification, SupervisorVerdict } from "../orchestration/context.js";

/**
 * Prints a raw, pre-evaluation summary of what happened per ticket: no
 * failure-category judgement here (that's `agentlens evaluate`, Session 3) —
 * just what each agent actually produced.
 */
export function printRawSummary(traces: Trace[]): void {
  const table = new Table({
    head: ["Ticket", "Category", "Urgency", "Top KB hit", "Verdict", "Tokens", "Duration (ms)"],
  });

  for (const trace of traces) {
    const classifierStep = trace.steps.find((s) => s.agentName === "classifier");
    const draftingStep = trace.steps.find((s) => s.agentName === "drafting");
    const supervisorStep = trace.steps.find((s) => s.agentName === "supervisor");

    const classification = classifierStep?.rawOutput as Classification | undefined;
    const verdict = supervisorStep?.rawOutput as SupervisorVerdict | undefined;
    const topDoc = draftingStep?.toolCalls[0]?.retrievedDocs?.[0];

    const totalTokens = trace.steps.reduce(
      (sum, s) => sum + (s.usage?.inputTokens ?? 0) + (s.usage?.outputTokens ?? 0),
      0,
    );
    const totalDuration = trace.steps.reduce((sum, s) => sum + s.durationMs, 0);
    const hadError = trace.steps.some((s) => s.error);

    const verdictText =
      verdict?.verdict === "approve" ? pc.green("approve")
      : verdict?.verdict === "reject" ? pc.red("reject")
      : hadError ? pc.red("error")
      : "-";

    table.push([
      trace.ticketId,
      classification?.category ?? "-",
      classification?.urgency ?? "-",
      topDoc ? `${topDoc.docId} (${topDoc.score.toFixed(2)})` : pc.dim("none"),
      verdictText,
      String(totalTokens),
      String(totalDuration),
    ]);
  }

  console.log(table.toString());
  console.log(`\n${traces.length} ticket(s) total.`);
}
