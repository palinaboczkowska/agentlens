# Evaluation methodology

## Why a golden set, not just "does it look right"

A categorizer that always says "success" looks fine until you check it against
cases you know are failures. The only honest way to know whether the automatic
categorizer works is to compare it against human judgement on the same traces —
exactly the process used professionally for auditing a support bot's answer
quality (trace the chain, find where it diverged from what a human would have
done, categorize the divergence).

## Process

1. Run the real pipeline: `npm run cli -- demo:run` (needs `ANTHROPIC_API_KEY`).
   This writes one trace JSON per ticket under `traces/`.
2. Read each trace and manually assign one label — `success`, `bad-retrieval`,
   `bad-reasoning`, `wrong-tool-call`, or `hallucination` — into
   `tests/fixtures/goldenSet.json`, using `docs/demo-scenario.md`'s per-ticket
   notes as a starting hypothesis, not a mechanical mapping (read the actual
   draft; a ticket built to trigger one trap can still come out clean, and
   vice versa).
3. Run `npm run cli -- evaluate --golden tests/fixtures/goldenSet.json`. This
   re-categorizes every labeled trace with `RuleBasedCategorizer` and reports
   precision/recall/F1 per category plus a confusion matrix, by comparing
   against the human labels.
4. Tune `DEFAULT_THRESHOLDS` in `src/evaluation/rules.ts` (currently just
   `minRetrievalScore: 0.3`, a starting guess) against what the confusion
   matrix actually shows, and re-run step 3 until the numbers stabilize.
5. Optional: run the same golden set through `LLMJudgeCategorizer`
   (`src/evaluation/llmJudge.ts`, costs one extra API call per trace) and
   report both categorizers' numbers side by side — a rule-based heuristic
   that catches most cases cheaply, versus an LLM judge that costs more but
   may catch subtler cases the rules miss.

## Measured results

Not yet run — `demo:run` requires a paid Anthropic API key, deferred until
that's set up. This section gets the real precision/recall/F1 numbers once
step 3 above has actually been executed against a real pipeline run.
