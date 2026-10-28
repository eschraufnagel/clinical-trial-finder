import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import type { TrialFacts } from "./types.js";

/**
 * Where mapping runs live, and how one is read (spec 0002 §3.4). Moved here
 * from `scripts/` in slice 0003, so the measurement under `evals/` can read a
 * run without importing a script. Files only: no model.
 */

export const FACTS_DATA_DIR = fileURLToPath(new URL("../../data/facts", import.meta.url));

/** The run directory named in `<month>/latest`, or the one given. */
export function runDirFor(month: string, given: string | undefined): string {
  if (given !== undefined) return given;
  const latest = join(FACTS_DATA_DIR, month, "latest");
  if (!existsSync(latest)) throw new Error(`No ${latest}: give --run <dir>.`);
  return join(FACTS_DATA_DIR, month, readFileSync(latest, "utf8").trim());
}

/** A trial's mappings in a run, or `undefined` when the run has none for it. */
export function readTrialFacts(dir: string, nctId: string): TrialFacts | undefined {
  const path = join(dir, `${nctId}.json`);
  return existsSync(path) ? (JSON.parse(readFileSync(path, "utf8")) as TrialFacts) : undefined;
}
