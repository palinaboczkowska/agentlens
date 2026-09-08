import { readFile } from "node:fs/promises";
import { z } from "zod";

export const GoldenSetEntrySchema = z.object({
  ticketId: z.string(),
  label: z.enum(["success", "bad-retrieval", "bad-reasoning", "wrong-tool-call", "hallucination"]),
  notes: z.string().optional(),
});

export const GoldenSetSchema = z.array(GoldenSetEntrySchema);

export type GoldenSetEntry = z.infer<typeof GoldenSetEntrySchema>;

export async function loadGoldenSet(filePath: string): Promise<GoldenSetEntry[]> {
  const raw = await readFile(filePath, "utf8");
  return GoldenSetSchema.parse(JSON.parse(raw));
}
