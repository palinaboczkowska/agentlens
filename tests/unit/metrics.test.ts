import { describe, expect, it } from "vitest";
import { evaluate, type PredictionVsLabel } from "../../src/evaluation/metrics.js";

describe("evaluate", () => {
  it("computes overall accuracy and per-category precision/recall/F1", () => {
    const predictions: PredictionVsLabel[] = [
      { ticketId: "t-1", predicted: "success", actual: "success" },
      { ticketId: "t-2", predicted: "success", actual: "hallucination" },
      { ticketId: "t-3", predicted: "hallucination", actual: "hallucination" },
      { ticketId: "t-4", predicted: "bad-retrieval", actual: "bad-reasoning" },
    ];

    const report = evaluate(predictions);

    expect(report.total).toBe(4);
    expect(report.overallAccuracy).toBeCloseTo(2 / 4);

    const hallucination = report.perCategory.find((m) => m.category === "hallucination");
    expect(hallucination?.truePositives).toBe(1);
    expect(hallucination?.falseNegatives).toBe(1);
    expect(hallucination?.falsePositives).toBe(0);
    expect(hallucination?.precision).toBeCloseTo(1);
    expect(hallucination?.recall).toBeCloseTo(0.5);

    const success = report.perCategory.find((m) => m.category === "success");
    expect(success?.truePositives).toBe(1);
    expect(success?.falsePositives).toBe(1); // t-2 predicted success but was actually hallucination
    expect(success?.precision).toBeCloseTo(0.5);
    expect(success?.recall).toBeCloseTo(1);

    expect(report.confusionMatrix.hallucination.success).toBe(1);
    expect(report.confusionMatrix["bad-reasoning"]["bad-retrieval"]).toBe(1);
  });

  it("returns zeroed-out metrics for an empty prediction set", () => {
    const report = evaluate([]);
    expect(report.total).toBe(0);
    expect(report.overallAccuracy).toBe(0);
    for (const m of report.perCategory) {
      expect(m.precision).toBe(0);
      expect(m.recall).toBe(0);
      expect(m.f1).toBe(0);
    }
  });
});
