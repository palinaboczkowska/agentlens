import Table from "cli-table3";
import pc from "picocolors";
import type { Trace } from "../tracing/types.js";
import type { Classification, SupervisorVerdict } from "../orchestration/context.js";

export interface RawSummaryRow {
  ticketId: string;
  category: string | null;
  urgency: string | null;
  topKbHit: { docId: string; score: number } | null;
  verdict: "approve" | "reject" | null;
  hadError: boolean;
  totalTokens: number;
  totalDurationMs: number;
}

export function buildRawSummary(traces: Trace[]): RawSummaryRow[] {
  return traces.map((trace) => {
    const classifierStep = trace.steps.find((s) => s.agentName === "classifier");
    const draftingStep = trace.steps.find((s) => s.agentName === "drafting");
    const supervisorStep = trace.steps.find((s) => s.agentName === "supervisor");

    const classification = classifierStep?.rawOutput as Classification | undefined;
    const verdict = supervisorStep?.rawOutput as SupervisorVerdict | undefined;
    const topDoc = draftingStep?.toolCalls[0]?.retrievedDocs?.[0] ?? null;

    return {
      ticketId: trace.ticketId,
      category: classification?.category ?? null,
      urgency: classification?.urgency ?? null,
      topKbHit: topDoc,
      verdict: verdict?.verdict ?? null,
      hadError: trace.steps.some((s) => s.error),
      totalTokens: trace.steps.reduce(
        (sum, s) => sum + (s.usage?.inputTokens ?? 0) + (s.usage?.outputTokens ?? 0),
        0,
      ),
      totalDurationMs: trace.steps.reduce((sum, s) => sum + s.durationMs, 0),
    };
  });
}

/**
 * Prints a raw, pre-evaluation summary of what happened per ticket: no
 * failure-category judgement here (that's `agentlens evaluate`) — just what
 * each agent actually produced.
 */
export function printRawSummary(traces: Trace[], format: "table" | "json" = "table"): void {
  const rows = buildRawSummary(traces);

  if (format === "json") {
    console.log(JSON.stringify(rows, null, 2));
    return;
  }

  const table = new Table({
    head: ["Ticket", "Category", "Urgency", "Top KB hit", "Verdict", "Tokens", "Duration (ms)"],
  });

  for (const row of rows) {
    const verdictText =
      row.verdict === "approve" ? pc.green("approve")
      : row.verdict === "reject" ? pc.red("reject")
      : row.hadError ? pc.red("error")
      : "-";

    table.push([
      row.ticketId,
      row.category ?? "-",
      row.urgency ?? "-",
      row.topKbHit ? `${row.topKbHit.docId} (${row.topKbHit.score.toFixed(2)})` : pc.dim("none"),
      verdictText,
      String(row.totalTokens),
      String(row.totalDurationMs),
    ]);
  }

  console.log(table.toString());
  console.log(`\n${rows.length} ticket(s) total.`);
}
