import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
// Straight from the modules, not the barrel, as `src/facts/map.ts` does.
import { parseCriteria } from "../criteria/parse.js";
import { type ParseableTrial, parseIdentity } from "../criteria/prompt.js";
import type { ParsedCriteria } from "../criteria/types.js";
import type { ModelAdapter, ModelDescriptor } from "../models/types.js";

/**
 * A picked trial's parse, cached where it can be read again (spec 0007 §2).
 *
 * As `evals/runner.ts` keys its cache, the file name carries the trial, the
 * model, the parser's identity (prompt and normalize versions) and the seed:
 * a parse made under any other of those is a different experiment, and
 * reusing it would silently mix them. The file also records the checksum of
 * the criteria text it read, so a refreshed snapshot that changed a trial's
 * text is a miss, not a stale parse.
 *
 * Used with `local/parses/` by the page, and with a committed run directory
 * under `data/criteria/` by the measurement and `--fake`.
 */

/** Committed parse runs, one directory per snapshot month and run, as `data/facts/` holds mappings. */
export const CRITERIA_DATA_DIR = fileURLToPath(new URL("../../data/criteria", import.meta.url));

/** The run directory named in `data/criteria/<month>/latest`, or undefined when there's none. */
export function latestCriteriaRun(month: string, root = CRITERIA_DATA_DIR): string | undefined {
  const latest = join(root, month, "latest");
  return existsSync(latest) ? join(root, month, readFileSync(latest, "utf8").trim()) : undefined;
}

/** A parse run's directory name: the model, the parser's prompt and its normalize version. */
export function criteriaRunName(
  model: string,
  promptVersion: string,
  normalizeVersion: string,
): string {
  const slug = model
    .toLowerCase()
    .replace(/[^a-z0-9.]+/g, "-")
    .replace(/^-|-$/g, "");
  return `${slug}-${promptVersion.slice(0, 8)}-n${normalizeVersion}`;
}

export interface CachedParse extends ParsedCriteria {
  criteriaSha256: string;
}

export interface ParseOutcome {
  parsed: CachedParse;
  source: "cache" | "model";
}

export function criteriaSha256(text: string): string {
  return createHash("sha256").update(text).digest("hex");
}

/** The cache file's name for a trial parsed by a model. */
export function parseCacheName(
  nctId: string,
  parser: Pick<ModelDescriptor, "model" | "seed" | "thinking">,
): string {
  const parts = [nctId, parser.model, parseIdentity(parser), String(parser.seed)];
  return `${parts.map((p) => p.replace(/[^A-Za-z0-9._-]/g, "_")).join("-")}.json`;
}

/** A cached parse at `path` for this text, or undefined: missing, unreadable or stale. */
export function readCachedParse(path: string, criteriaText: string): CachedParse | undefined {
  if (!existsSync(path)) return undefined;
  try {
    const parsed = JSON.parse(readFileSync(path, "utf8")) as CachedParse;
    return parsed.criteriaSha256 === criteriaSha256(criteriaText) ? parsed : undefined;
  } catch {
    // A corrupt cache is a miss, not a failure.
    return undefined;
  }
}

/**
 * The one parse of `nctId` in a run directory, whatever model made it: a
 * committed run holds one model's parses. Undefined when there's none, or
 * it's stale.
 */
export function findParse(
  dir: string,
  nctId: string,
  criteriaText: string,
): CachedParse | undefined {
  if (!existsSync(dir)) return undefined;
  const name = readdirSync(dir).find((f) => f.startsWith(`${nctId}-`) && f.endsWith(".json"));
  return name === undefined ? undefined : readCachedParse(join(dir, name), criteriaText);
}

/** The cached parse, or a new one from the model, written as soon as it returns. */
export async function parseWithCache(
  trial: ParseableTrial,
  adapter: ModelAdapter,
  dir: string,
): Promise<ParseOutcome> {
  const text = trial.eligibility.criteriaText;
  const path = join(dir, parseCacheName(trial.nctId, adapter.descriptor));
  const cached = readCachedParse(path, text);
  if (cached !== undefined) return { parsed: cached, source: "cache" };

  const parsed: CachedParse = {
    ...(await parseCriteria(trial, adapter)),
    criteriaSha256: criteriaSha256(text),
  };
  mkdirSync(dir, { recursive: true });
  writeFileSync(path, `${JSON.stringify(parsed, null, 2)}\n`, "utf8");
  return { parsed, source: "model" };
}
