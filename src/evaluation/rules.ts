import type { RetrievedDoc, TicketContext } from "../orchestration/context.js";
import type { StepTrace, Trace } from "../tracing/types.js";
import type { CategorizationResult, Categorizer } from "./categorizer.js";

export interface RuleThresholds {
  /** Cosine-similarity score below which the top retrieved doc counts as a bad match. */
  minRetrievalScore: number;
}

/**
 * Starting point, not gospel — these get empirically tuned in Session 3 once
 * real traces exist to tune against (see docs/evaluation-methodology.md).
 */
export const DEFAULT_THRESHOLDS: RuleThresholds = {
  minRetrievalScore: 0.3,
};

const CLAIM_PATTERNS: RegExp[] = [
  /\$\s?\d+(\.\d+)?/g,
  /\d+(\.\d+)?\s?%/g,
  /\d+\s?(business\s)?days?/gi,
  /\d+\s?(hours?|minutes?)/gi,
  /\b(one|two|three|four|five|six|seven|ten|24|48)[\s-](business[\s-])?(days?|hours?|minutes?|weeks?)\b/gi,
];

const KB_GAP_PATTERNS: RegExp[] = [
  /\b(don't|do not|didn't|did not) (have|find|see)\b/i,
  /\b(wasn't|was not|couldn't|could not|unable to) (able to )?find\b/i,
  /\bno (information|documentation|article)\b/i,
  /\b(could|can) you\b.*\?/i,
  /\bwhat (specifically|exactly)\b/i,
  /\bmore (details?|information)\b/i,
];

/** An honest "the KB doesn't cover this" isn't bad retrieval, it's the right answer. */
function admitsKbGap(draft: string): boolean {
  return KB_GAP_PATTERNS.some((pattern) => pattern.test(draft));
}

function extractClaims(text: string): string[] {
  const claims: string[] = [];
  for (const pattern of CLAIM_PATTERNS) {
    const matches = text.match(pattern);
    if (matches) {
      claims.push(...matches.map((match) => match.toLowerCase().trim()));
    }
  }
  return claims;
}

function findStep(trace: Trace, agentName: string): StepTrace | undefined {
  return trace.steps.find((step) => step.agentName === agentName);
}

/** Structural tool problems. Shared with the claim verifier, which needs no model for these. */
export function findToolFailure(trace: Trace): CategorizationResult | undefined {
  const erroredStep = trace.steps.find((step) => step.error);
  if (erroredStep) {
    return {
      category: "wrong-tool-call",
      rationale: `Step "${erroredStep.agentName}" errored: ${erroredStep.error}`,
    };
  }

  const draftingStep = findStep(trace, "drafting");
  const searchCalls = draftingStep?.toolCalls.filter((call) => call.toolName === "search_kb") ?? [];

  if (draftingStep && searchCalls.length === 0) {
    return {
      category: "wrong-tool-call",
      rationale: "Drafting agent never called search_kb before answering.",
    };
  }
  if (searchCalls.some((call) => call.isError)) {
    return { category: "wrong-tool-call", rationale: "A search_kb call returned an error." };
  }
  const hasDegenerateQuery = searchCalls.some((call) => {
    const query = (call.input as { query?: string } | undefined)?.query ?? "";
    return query.trim().length < 3;
  });
  if (hasDegenerateQuery) {
    return { category: "wrong-tool-call", rationale: "search_kb was called with a near-empty query." };
  }
  return undefined;
}

/**
 * Priority-ordered, deterministic failure categorization. First match wins:
 * wrong-tool-call > bad-retrieval > hallucination > bad-reasoning > success.
 * See docs/evaluation-methodology.md for the reasoning behind each rule and
 * how the thresholds get tuned against a real golden set.
 */
export function categorizeByRules(
  trace: Trace,
  thresholds: RuleThresholds = DEFAULT_THRESHOLDS,
): CategorizationResult {
  const toolFailure = findToolFailure(trace);
  if (toolFailure) return toolFailure;

  const classifierStep = findStep(trace, "classifier");
  const draftingStep = findStep(trace, "drafting");
  const supervisorStep = findStep(trace, "supervisor");

  const searchCalls = draftingStep?.toolCalls.filter((call) => call.toolName === "search_kb") ?? [];
  const draftText = typeof draftingStep?.rawOutput === "string" ? draftingStep.rawOutput : "";

  const topScores = searchCalls.map((call) => call.retrievedDocs?.[0]?.score ?? 0);
  const topScore = topScores.length > 0 ? Math.max(...topScores) : undefined;
  if (
    topScore !== undefined &&
    topScore < thresholds.minRetrievalScore &&
    !admitsKbGap(draftText)
  ) {
    return {
      category: "bad-retrieval",
      rationale: `Top retrieved doc score ${topScore.toFixed(2)} is below the ${thresholds.minRetrievalScore} threshold.`,
    };
  }

  const retrievedContent = searchCalls
    .flatMap((call) => (call.output as RetrievedDoc[] | undefined) ?? [])
    .map((doc) => doc.content)
    .join("\n")
    .toLowerCase();
  const ticketBody = (
    (classifierStep?.input as Partial<TicketContext> | undefined)?.ticket?.body ?? ""
  ).toLowerCase();
  const groundedText = `${retrievedContent}\n${ticketBody}`;

  const ungroundedClaims = extractClaims(draftText).filter((claim) => !groundedText.includes(claim));
  if (ungroundedClaims.length > 0) {
    return {
      category: "hallucination",
      rationale: `Draft makes claim(s) not found in retrieved docs or the ticket: ${ungroundedClaims.join(", ")}.`,
    };
  }

  const supervisorVerdict = (supervisorStep?.rawOutput as { verdict?: string } | undefined)?.verdict;
  if (supervisorVerdict === "reject") {
    return {
      category: "bad-reasoning",
      rationale: "Supervisor rejected the draft despite no detected retrieval or hallucination issue.",
    };
  }

  return { category: "success", rationale: "No failure pattern detected; supervisor approved." };
}

export class RuleBasedCategorizer implements Categorizer {
  constructor(private readonly thresholds: RuleThresholds = DEFAULT_THRESHOLDS) {}

  async categorize(trace: Trace): Promise<CategorizationResult> {
    return categorizeByRules(trace, this.thresholds);
  }
}
