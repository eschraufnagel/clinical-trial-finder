import { readFileSync } from "node:fs";
import type { TrialFacts } from "../../src/facts/types.js";
import { type FactMetrics, type LabelRow, type MappingRow, metricsOf } from "./grade.js";
import type { FactLabelSet } from "./labels.js";

/**
 * A committed grading of a mapping run (spec 0002 §6.2), and the check that
 * one is what it says it is: its numbers follow from its rows, and it names
 * the labels and vocabulary in the repository.
 */
export interface FactsEvalResult {
  version: 1;
  set: FactLabelSet;
  /** The run's directory, relative to the repository root. */
  runDir: string;
  /** Model, quantization, temperature, seed, prompt and vocabulary of the run. */
  run: TrialFacts["run"];
  labelsSha256: string;
  trials: string[];
  /** Trials in the set with no mapping file in the run: ungraded, and named. */
  missing: string[];
  mappingRows: MappingRow[];
  labelRows: LabelRow[];
  rejected: { nctId: string; reason: string }[];
  metrics: FactMetrics;
  /**
   * Result 05 only: the trust list tried at Gate 2 and its numbers on those facts'
   * rows. The list was dropped when held-out found it no safer (`gate-2-finding.md`).
   */
  trustedFacts?: string[];
  trustedMetrics?: FactMetrics;
}

/** The rows and metrics for the trusted facts only. Rejected mappings carry no fact, so none count. */
export function trustedMetricsOf(
  result: Pick<FactsEvalResult, "mappingRows" | "labelRows" | "trials">,
  trusted: ReadonlySet<string>,
): FactMetrics {
  return metricsOf(
    result.mappingRows.filter((r) => trusted.has(r.factId)),
    result.labelRows.filter((r) => trusted.has(r.factId)),
    [],
    result.trials.length,
  );
}

export function readFactsResult(path: string): FactsEvalResult {
  return JSON.parse(readFileSync(path, "utf8")) as FactsEvalResult;
}

export function verifyFactsResult(
  result: FactsEvalResult,
  context: { labelsSha256: string; vocabularySha256: string; fileName?: string },
): string[] {
  const problems: string[] = [];
  const metrics = metricsOf(
    result.mappingRows,
    result.labelRows,
    result.rejected,
    result.trials.length,
  );
  if (JSON.stringify(metrics) !== JSON.stringify(result.metrics))
    problems.push("metrics don't follow from the rows");
  if (result.trustedFacts !== undefined) {
    const derived = trustedMetricsOf(result, new Set(result.trustedFacts));
    if (JSON.stringify(derived) !== JSON.stringify(result.trustedMetrics))
      problems.push("trusted metrics don't follow from the rows");
  }
  if (result.labelsSha256 !== context.labelsSha256)
    problems.push("labelsSha256 isn't the committed labels'");
  if (result.run.vocabularySha256 !== context.vocabularySha256)
    problems.push("the run's vocabulary isn't the committed vocabulary");
  for (const field of ["model", "quantization", "promptVersion"] as const) {
    if (typeof result.run[field] !== "string" || result.run[field] === "")
      problems.push(`run.${field} is missing`);
  }
  if (!("temperature" in result.run) || !("seed" in result.run))
    problems.push("run doesn't record temperature and seed");
  if (
    context.fileName !== undefined &&
    !context.fileName.endsWith(`-${result.run.promptVersion}.json`)
  )
    problems.push("file name doesn't carry the prompt version");
  const graded = new Set(result.trials);
  if (result.mappingRows.some((r) => !graded.has(r.nctId)))
    problems.push("a mapping row names a trial that wasn't graded");
  return problems;
}
