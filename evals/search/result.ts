import { readFileSync } from "node:fs";
import type { SearchLabels } from "./labels.js";
import { type Metrics, metricsFor, type ResultRow } from "./metrics.js";

/**
 * A committed measurement of the search (spec 0001 §6.3), and the check that
 * one is what it says it is.
 */
export interface SearchEvalResult {
  version: 1;
  cancerType: string;
  snapshot: { month: string; sha256: string };
  vocabularySha256: string;
  labelsSha256: string;
  rows: ResultRow[];
  /** `null` in a dev-only run, so the held-out sample isn't looked at while tuning. */
  heldout: Metrics | null;
  dev: Metrics;
}

export function readResult(path: string): SearchEvalResult {
  return JSON.parse(readFileSync(path, "utf8")) as SearchEvalResult;
}

/**
 * Everything wrong with a result, or nothing: its metrics don't follow from
 * its rows, a row's label isn't the committed label, or a checksum doesn't
 * match what it names.
 */
export function verifyResult(
  result: SearchEvalResult,
  context: {
    labels: SearchLabels;
    labelsSha256: string;
    snapshotSha256: string;
    fileName?: string;
  },
): string[] {
  const problems: string[] = [];
  const bySet = (set: string) => result.rows.filter((r) => r.set === set);

  const dev = metricsFor(bySet("dev"));
  if (JSON.stringify(dev) !== JSON.stringify(result.dev)) {
    problems.push("dev metrics don't follow from the rows");
  }
  if (result.heldout !== null) {
    const heldout = metricsFor(bySet("heldout"));
    if (JSON.stringify(heldout) !== JSON.stringify(result.heldout)) {
      problems.push("held-out metrics don't follow from the rows");
    }
  } else if (bySet("heldout").length > 0) {
    problems.push("held-out rows in a dev-only result");
  }

  const labelled = new Map(context.labels.labels.map((l) => [l.nctId, l]));
  for (const row of result.rows) {
    const label = labelled.get(row.nctId);
    if (label === undefined) {
      problems.push(`${row.nctId} isn't in the label file`);
    } else if (label.relevant !== row.relevant || label.set !== row.set) {
      problems.push(`${row.nctId}'s row doesn't match its committed label`);
    }
  }
  if (result.labelsSha256 !== context.labelsSha256) {
    problems.push("labelsSha256 isn't the committed label file's");
  }
  if (result.snapshot.sha256 !== context.snapshotSha256) {
    problems.push("snapshot sha256 isn't the committed snapshot's");
  }
  if (!/^[0-9a-f]{64}$/.test(result.vocabularySha256)) {
    problems.push("vocabularySha256 isn't a sha256");
  } else if (
    context.fileName !== undefined &&
    !context.fileName.endsWith(`-${result.vocabularySha256.slice(0, 12)}.json`)
  ) {
    problems.push(`file name doesn't carry the vocabulary's checksum`);
  }
  return problems;
}
