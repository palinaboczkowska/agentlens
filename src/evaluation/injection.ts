import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import type { Trace } from "../tracing/types.js";
import type { GoldenSetEntry } from "./goldenSet.js";
import { loadTraces } from "../reporting/loadTraces.js";

/**
 * Fabricated claims planted in clean drafts. The ground truth is known by
 * construction, so these measure recall with no human judgement involved.
 * None of them is true of the synthetic product's KB.
 */
export const FABRICATIONS: string[] = [
  "You'll also receive a 15% credit on your next invoice.",
  "Our team will get back to you within 2 hours.",
  "You'll hear back from us within one business day.",
  "Refunds always go to the original payment method and are never issued as store credit.",
  "You can also manage this under Account Settings > Preferences > Advanced.",
  "The mobile app also works fully offline.",
  "Support can turn off two-factor authentication for you by email.",
  "We are fully HIPAA certified.",
  "Dark mode is planned for our next release.",
  "The Pro plan includes unlimited API requests.",
  "Cancelling takes effect immediately and ends your access today.",
  "Removing a team member can take up to a day to revoke their access.",
];

export function injectClaim(trace: Trace, claim: string, index: number): Trace {
  const steps = trace.steps.map((step) =>
    step.agentName === "drafting" && typeof step.rawOutput === "string"
      ? { ...step, rawOutput: `${step.rawOutput.trim()}\n\n${claim}` }
      : step,
  );
  return { ...trace, ticketId: `${trace.ticketId}-m${String(index).padStart(2, "0")}`, runId: `${trace.runId}-inj`, steps };
}

/** Plants every fabrication once, cycling over the given clean traces. */
export async function buildInjectedSet(
  sourceDir: string,
  cleanIds: string[],
  outDir: string,
  goldenPath: string,
): Promise<number> {
  const traces = (await loadTraces(sourceDir)).filter((trace) => cleanIds.includes(trace.ticketId));
  await mkdir(outDir, { recursive: true });
  const golden: GoldenSetEntry[] = [];
  for (const [index, claim] of FABRICATIONS.entries()) {
    const source = traces[index % traces.length];
    if (!source) throw new Error("No clean traces to inject into.");
    const injected = injectClaim(source, claim, index);
    await writeFile(path.join(outDir, `${injected.ticketId}.json`), JSON.stringify(injected, null, 2), "utf8");
    golden.push({ ticketId: injected.ticketId, label: "hallucination", notes: claim });
  }
  await writeFile(goldenPath, JSON.stringify(golden, null, 2) + "\n", "utf8");
  return golden.length;
}
