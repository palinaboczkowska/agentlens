# agentlens

Runs a small multi-agent Claude pipeline (classify → search a knowledge base → draft
a reply → review it) and automatically categorizes *why* a run succeeded or failed:
bad retrieval, bad reasoning, a wrong tool call, or hallucination.

> Status: work in progress, built across several sessions. See `docs/` as it fills in.

## Why this exists

I wanted a portfolio project that proves the same skill I used professionally —
tracing an AI system's full chain from retrieval to generated answer and pinpointing
where it broke down — as a reusable, from-scratch, open-source tool with no ties to
any employer's code or data.

## Status

- [x] Session 1 — orchestration engine, tracing, unit tests
- [x] Session 2 (built, live run pending) — real Claude-powered demo agents, local
      embedding retrieval, 26 synthetic tickets. Everything is built and typechecks;
      the retriever is unit-tested for free (no API key needed). The actual
      `demo:run` against Claude has not been executed yet — costs a small amount
      (well under $1 for a full run on Haiku) and needs an `ANTHROPIC_API_KEY`.
- [x] Session 3 (built, real numbers pending) — rule-based failure categorizer,
      metrics (precision/recall/F1 + confusion matrix), golden-set evaluation
      CLI, and an optional LLM-judge categorizer for comparison. Fully
      unit-tested against hand-built trace fixtures (free, no API key). The
      real golden-set numbers need a live `demo:run` first — see
      `docs/evaluation-methodology.md`.
- [ ] Session 4 — polish, docs, CI
- [ ] Session 5 (stretch) — MCP server, minimal dashboard

## Quickstart

```bash
npm install
npm test               # no API key needed — includes a real local-embedding test
npm run cli -- demo:fake   # toy pipeline, scripted fake LLM, no API key needed
```

Running the real demo needs an Anthropic API key (pay-per-use, separate from a
Claude.ai/Claude Code subscription):

```bash
cp .env.example .env   # then fill in ANTHROPIC_API_KEY
npm run cli -- demo:run     # ~26 tickets x 3 agents on claude-haiku-4-5, well under $1
npm run cli -- demo:report  # raw per-ticket summary from the saved traces
```

## Architecture (short version, full write-up coming)

- `src/orchestration/` — `Agent`/`Pipeline` abstractions. Agents are plain
  `(context) => Partial<context>` functions over a shared "blackboard" context.
- `src/tracing/` — a Zod-validated `Trace`/`StepTrace` schema capturing exact input,
  tool calls, model output, token usage and errors for every agent step.
- `src/evaluation/` — (Session 3) rule-based + optional LLM-judge failure
  categorization, validated against a manually labeled golden set.
- `src/demo/` — the concrete ticket-triage pipeline used to exercise all of the above.

## License

MIT — see [LICENSE](./LICENSE).
