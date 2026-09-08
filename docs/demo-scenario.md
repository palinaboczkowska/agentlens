# Demo scenario: synthetic support-ticket triage

Three agents run per ticket, in order:

1. **classifier** — assigns a category and urgency (structured output, no tools).
2. **drafting** — searches the knowledge base (`search_kb` tool, local embedding
   retrieval over `src/retrieval/kb/articles.json`) and drafts a reply grounded in
   what it finds.
3. **supervisor** — reviews the draft against the ticket and retrieved docs, and
   approves or rejects it (structured output, no tools).

All tickets (`src/demo/tickets.ts`) and KB articles are entirely invented for this
project — nothing here is derived from any real employer's data.

## Why these specific tickets

Random tickets tend to all succeed, which makes a categorizer's precision/recall
numbers meaningless (100% on everything proves nothing). Each ticket below was
written to plausibly trigger a *specific* outcome, so the golden set built from a
real run has genuine variety to measure against.

| Ticket | Intended trap | Expected-good behavior |
|---|---|---|
| t-01 | none — clean case | Retrieve kb-003, draft a grounded reply, approve |
| t-02 | hallucination trap | kb-004 says no partial refunds — a good draft says so plainly instead of promising one |
| t-03 | none — clean case | Retrieve kb-011, explain proration correctly |
| t-04 | none — clean case | Retrieve kb-007 |
| t-05 | missing-KB-coverage trap | No article covers currency/FX — good behavior is to say so, not invent an explanation |
| t-06 | none — clean case | Retrieve kb-005 (Mac-specific fix), draft matches it |
| t-07 | bad-retrieval / hallucination trap | KB only has a **Mac** fix (kb-005); applying it to Windows unqualified, or inventing a Windows fix, is a failure |
| t-08 | none — clean case | Retrieve kb-012 |
| t-09 | none — clean case | Retrieve kb-009 |
| t-10 | low-information trap | Ticket has almost no actionable detail — good behavior is a low-confidence classification and a request for more detail, not a confident guess |
| t-11 | none — clean case | Retrieve kb-001 |
| t-12 | none — clean case | Retrieve kb-002 (NOT kb-001's self-service steps) |
| t-13 | bad-reasoning trap | Ambiguous between kb-001 and kb-002 — applying the wrong one's remediation is a failure even if both got retrieved |
| t-14 | none — clean case | Retrieve kb-006 |
| t-15 | none — clean case | Retrieve kb-013 |
| t-16 | hallucination trap | No dark-mode article exists — inventing a timeline or pretending it's already planned is a failure |
| t-17 | none — clean case | Retrieve kb-014 |
| t-18 | none — clean case | Retrieve kb-008 |
| t-19 | none — clean case | Retrieve kb-010 |
| t-20 | multi-intent trap | Two distinct asks in one ticket (billing + bug) — silently answering only one is a failure |
| t-21 | low-information trap | Zero actionable detail behind the frustration — same expectation as t-10 |
| t-22 | hallucination trap | kb-006 covers *setup*, not *"invalid code" troubleshooting* — inventing troubleshooting steps not grounded in the article is a failure |
| t-23 | missing-KB-coverage trap | "Doesn't fit my workflow" isn't covered by kb-003 or kb-004 — inventing a policy for it is a failure |
| t-24 | missing-KB-coverage trap | No SSO/SAML article — good behavior logs it as a feature request without promising a timeline |
| t-25 | missing-KB-coverage trap | "Billed but plan didn't change" isn't covered by kb-011 — inventing an explanation is a failure |
| t-26 | none — clean case | Retrieve kb-013, simple and short |

## Golden-set process (Session 3)

After a real `agentlens demo:run`, each resulting trace in `traces/` is manually
labeled into `tests/fixtures/goldenSet.json` as one of: `success`, `bad-retrieval`,
`bad-reasoning`, `wrong-tool-call`, or `hallucination`, using the table above as
guidance (not a mechanical mapping — read the actual draft before labeling).
`agentlens evaluate` then measures how well the automatic categorizer agrees with
these human labels.
