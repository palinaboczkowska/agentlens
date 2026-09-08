import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { KbArticle } from "../retriever.js";

const currentDir = path.dirname(fileURLToPath(import.meta.url));

export async function loadKbArticles(): Promise<KbArticle[]> {
  const raw = await readFile(path.join(currentDir, "articles.json"), "utf8");
  return JSON.parse(raw) as KbArticle[];
}
