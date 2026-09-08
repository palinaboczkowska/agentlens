import Table from "cli-table3";
import pc from "picocolors";
import type { EvaluationReport } from "../evaluation/metrics.js";

export function printEvaluationReport(
  report: EvaluationReport,
  format: "table" | "json" = "table",
): void {
  if (format === "json") {
    console.log(JSON.stringify(report, null, 2));
    return;
  }

  const table = new Table({ head: ["Category", "TP", "FP", "FN", "Precision", "Recall", "F1"] });

  for (const m of report.perCategory) {
    table.push([
      m.category,
      m.truePositives,
      m.falsePositives,
      m.falseNegatives,
      m.precision.toFixed(2),
      m.recall.toFixed(2),
      m.f1.toFixed(2),
    ]);
  }

  console.log(table.toString());
  console.log(
    `\nOverall accuracy: ${pc.bold((report.overallAccuracy * 100).toFixed(1) + "%")} (${report.total} labeled tickets)`,
  );
}
