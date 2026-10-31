import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import type { ModelRunMetadata } from "../../src/models/types.js";
import type { PatientSet } from "../questions/patients.js";
import { type CheckSummary, type PairRow, scorePair, summarize } from "./metrics.js";
import type { PairLabels } from "./pairs.js";
import type { PairTranscript } from "./transcript.js";

/**
 * A check measurement's result (spec 0007 §7.4): what ran, on what, and every
 * pair's row. Every number traces to a transcript committed beside it, and
 * the result records what a reader needs to reproduce it: each model's name,
 * quantization, temperature and seed, every prompt version, the mapping and
 * parse runs, the labels' and patients' checksums, and the link's threshold.
 */

export interface CheckEvalResult {
  version: 1;
  set: PatientSet;
  labelsSha256: string;
  patientsSha256: string;
  snapshot: { month: string; sha256: string };
  mappingRun: string;
  parseRun: string | null;
  parser: ModelRunMetadata | null;
  linkThreshold: number;
  run: {
    agent: ModelRunMetadata | null;
    participant: ModelRunMetadata;
  };
  /** Repository-relative directory of the transcripts, one file per pair. */
  transcripts: string;
  rows: PairRow[];
  summary: CheckSummary;
}

export function fileSha256(path: string): string {
  return createHash("sha256").update(readFileSync(path)).digest("hex");
}

/** What a run's name hashes: anything that, changed, makes it a different measurement. */
export function runHash(parts: readonly string[]): string {
  return createHash("sha256").update(parts.join("\n")).digest("hex").slice(0, 12);
}

/** Rows and summary from transcripts and labels, in label order. */
export function scoreTranscripts(
  transcripts: readonly PairTranscript[],
  labels: PairLabels,
  textOf: (nctId: string) => string,
): { rows: PairRow[]; summary: CheckSummary } {
  const byKey = new Map(transcripts.map((t) => [`${t.patient} ${t.nctId}`, t]));
  const rows = labels.pairs.flatMap((l) => {
    const t = byKey.get(`${l.patient} ${l.nctId}`);
    return t === undefined ? [] : [scorePair(t, l, textOf(l.nctId))];
  });
  return { rows, summary: summarize(rows) };
}

/**
 * Differences between a committed result and a regrade of its transcripts
 * under today's code, labels and snapshot. Empty when they match.
 */
export function regradeProblems(
  committed: CheckEvalResult,
  transcripts: readonly PairTranscript[],
  labels: PairLabels,
  labelsSha256: string,
  textOf: (nctId: string) => string,
): string[] {
  const problems: string[] = [];
  if (committed.labelsSha256 !== labelsSha256) problems.push("labelsSha256 differs");
  const set = labels.pairs.filter((p) => p.set === committed.set);
  const again = scoreTranscripts(transcripts, { ...labels, pairs: set }, textOf);
  if (JSON.stringify(again.rows) !== JSON.stringify(committed.rows)) {
    const first = again.rows.findIndex(
      (r, i) => JSON.stringify(r) !== JSON.stringify(committed.rows[i]),
    );
    problems.push(
      `rows differ${first >= 0 ? `, first at ${again.rows[first]?.patient} ${again.rows[first]?.nctId}` : ""}`,
    );
  }
  if (JSON.stringify(again.summary) !== JSON.stringify(committed.summary)) {
    problems.push("summary differs");
  }
  return problems;
}
