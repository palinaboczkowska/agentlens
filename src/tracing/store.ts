import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import type { Trace } from "./types.js";

export async function saveTrace(trace: Trace, dir = "traces"): Promise<string> {
  await mkdir(dir, { recursive: true });
  const filePath = path.join(dir, `${trace.ticketId}-${trace.runId}.json`);
  await writeFile(filePath, JSON.stringify(trace, null, 2), "utf8");
  return filePath;
}
