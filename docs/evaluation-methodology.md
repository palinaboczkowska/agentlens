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

Measured 2026-11-06. Pipeline on `claude-haiku-4-5`, verifier on `claude-opus-5-5`.

### Held-out result (the number to quote)

24 tickets written before the verifier existed and never used to tune it. Labels
were fixed before the verifier's output was looked at, and the code was frozen by
hash before the run. Six replies were labeled bad, three of them judgement calls.

| Check | Bad replies caught (of 6) | Good replies flagged (of 18) |
|---|---|---|
| Claim verifier | **5** | 7 |
| Supervisor agent | 1 | 0 |
| Rule categorizer | 1 | 1 |

Accuracy alone misleads here: answering "success" every time would score 75%, the
rules score 70.8% and the verifier 66.7%. What matters is catching bad replies,
and there the verifier is well ahead, at the price of too many false alarms.

**It is a filter in front of a human, not an autonomous judge.** It sent 12 of 24
replies to review and let one bad reply through (an invented claim that a browser
hadn't been tested). Some false alarms are arguable: h-14, h-15 and h-17 describe
support processes no article states. They stay counted as false alarms, because
relabeling after seeing the output would make the number worthless.

The verifier was not tuned on this set. Improving it means a new held-out set.

### Known-truth tests

Ground truth by construction, so no human judgement is involved.

| Test | Rules | Verifier |
|---|---|---|
| Fabricated claims planted in clean replies | 3 of 12 | 12 of 12 |
| Retrieval returning wrong documents | 0 of 6 | 6 of 6 |
| Search tool failing | 3 of 3 | 3 of 3 |

Planted claims are appended sentences, which is easier than a subtle real one.

### Development set (not evidence)

26 tickets used to build the verifier, so these scores are optimistic. Rules went
from 69.2% to 88.5% after fixes made for these tickets. An LLM judge reading the
whole trace scored 73.1%. The verifier scored 88.5%, catching all 5 bad replies
with 3 false alarms. The first version caught all 5 with 11 false alarms, which is
why claims now carry a severity.

### What the first live run found

The drafting agent kept only the documents from its last search, so in 15 of 26
runs the supervisor reviewed a draft without documents the agent had used, and it
rejected two correct answers as ungrounded. Unit tests with a fake LLM couldn't
show this. Fixed with `mergeRetrievedDocs`.

### How the verifier works

The model lists each checkable claim with a quote and a source. Plain code then
checks that the quote exists in that source, and decides the category. A fake
quote is treated as an invented claim, so the model can't vouch for itself.

`npm run gate` replays stored verdicts from `tests/fixtures/verdicts.json` and fails
if recall drops. It runs on every push with no API key and no cost. It proves the
decision logic and the stored results still hold. Prompt or model changes need a
live run.
