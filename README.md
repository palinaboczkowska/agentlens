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

- [x] Session 1 — orchestration engine, tracing, unit tests (this commit)
- [ ] Session 2 — real Claude-powered demo agents + synthetic ticket set
- [ ] Session 3 — failure categorizer + golden-set evaluation
- [ ] Session 4 — polish, docs, CI
- [ ] Session 5 (stretch) — MCP server, minimal dashboard

## Quickstart (current: no API key needed yet)

```bash
npm install
npm test
npm run cli -- demo:fake
```

`demo:fake` runs a toy 2-agent pipeline against a scripted fake LLM client and writes
a trace to `traces/`. The real, Claude-powered demo lands in Session 2.

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
