import { FAILURE_CATEGORIES, type FailureCategory } from "./categorizer.js";

export interface PredictionVsLabel {
  ticketId: string;
  predicted: FailureCategory;
  actual: FailureCategory;
}

export interface CategoryMetrics {
  category: FailureCategory;
  truePositives: number;
  falsePositives: number;
  falseNegatives: number;
  precision: number;
  recall: number;
  f1: number;
}

export type ConfusionMatrix = Record<FailureCategory, Record<FailureCategory, number>>;

export interface EvaluationReport {
  total: number;
  overallAccuracy: number;
  perCategory: CategoryMetrics[];
  confusionMatrix: ConfusionMatrix;
}

function emptyConfusionMatrix(): ConfusionMatrix {
  const matrix = {} as ConfusionMatrix;
  for (const actual of FAILURE_CATEGORIES) {
    matrix[actual] = {} as Record<FailureCategory, number>;
    for (const predicted of FAILURE_CATEGORIES) {
      matrix[actual][predicted] = 0;
    }
  }
  return matrix;
}

/**
 * Measures how well a categorizer's predictions agree with human labels —
 * the whole point of the golden-set methodology described in
 * docs/evaluation-methodology.md.
 */
export function evaluate(predictions: PredictionVsLabel[]): EvaluationReport {
  const confusionMatrix = emptyConfusionMatrix();
  let correct = 0;

  for (const { predicted, actual } of predictions) {
    confusionMatrix[actual][predicted] += 1;
    if (predicted === actual) correct += 1;
  }

  const perCategory: CategoryMetrics[] = FAILURE_CATEGORIES.map((category) => {
    let truePositives = 0;
    let falsePositives = 0;
    let falseNegatives = 0;
    for (const { predicted, actual } of predictions) {
      if (predicted === category && actual === category) truePositives += 1;
      else if (predicted === category && actual !== category) falsePositives += 1;
      else if (predicted !== category && actual === category) falseNegatives += 1;
    }
    const precision =
      truePositives + falsePositives === 0 ? 0 : truePositives / (truePositives + falsePositives);
    const recall = truePositives + falseNegatives === 0 ? 0 : truePositives / (truePositives + falseNegatives);
    const f1 = precision + recall === 0 ? 0 : (2 * precision * recall) / (precision + recall);
    return { category, truePositives, falsePositives, falseNegatives, precision, recall, f1 };
  });

  return {
    total: predictions.length,
    overallAccuracy: predictions.length === 0 ? 0 : correct / predictions.length,
    perCategory,
    confusionMatrix,
  };
}
