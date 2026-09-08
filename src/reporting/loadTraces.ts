import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { TraceSchema, type Trace } from "../tracing/types.js";

export async function loadTraces(dir = "traces"): Promise<Trace[]> {
  let files: string[];
  try {
    files = await readdir(dir);
  } catch {
    return [];
  }
  const traces: Trace[] = [];
  for (const file of files) {
    if (!file.endsWith(".json")) continue;
    const raw = await readFile(path.join(dir, file), "utf8");
    traces.push(TraceSchema.parse(JSON.parse(raw)));
  }
  traces.sort((a, b) => a.ticketId.localeCompare(b.ticketId));
  return traces;
}
