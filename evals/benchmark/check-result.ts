import type { ModelRunMetadata } from "../../src/models/types.js";
import {
  type ArmSummary,
  type ArmsCompared,
  type BenchmarkRow,
  compareArms,
  scoreBenchmarkPair,
  summarizeArm,
} from "./check-metrics.js";
import { type PartsRow, type PartsSummary, scorePartsPair, summarizeParts } from "./check-parts.js";
import type { Arm, BenchmarkTranscript } from "./check-run.js";
import type { BenchmarkPair, BenchmarkSet, PairReason } from "./pairs.js";

/**
 * A check measurement against clinicians (spec 0008 §7.7): what ran, on what,
 * and every pair's row in every arm. Each number traces to a transcript
 * committed beside it, and the result records each model's name,
 * quantization, temperature and seed, every prompt version, the parse run,
 * and the pairs', accounts' and reasons' checksums.
 */

export interface BenchmarkCheckResult {
  version: 1;
  set: BenchmarkSet;
  arms: Arm[];
  pairsSha256: string;
  accountsSha256: string;
  reasonsSha256: string;
  parseRun: string;
  parser: ModelRunMetadata | null;
  run: { agent: ModelRunMetadata | null; participant: ModelRunMetadata };
  /** Repository-relative directory of the transcripts, one file per pair and arm. */
  transcripts: string;
  rows: BenchmarkRow[];
  byArm: ArmSummary[];
  compared: ArmsCompared;
  /**
   * Slice 0009's measure, beside the frozen one (spec 0009 §5.2). Absent on
   * results written before it, which regrade without it.
   */
  parts?: { rows: PartsRow[]; byArm: PartsSummary[] };
}

/** Rows in pair order, arm by arm, and their summaries. */
export function scoreBenchmark(
  transcripts: readonly BenchmarkTranscript[],
  pairs: readonly BenchmarkPair[],
  arms: readonly Arm[],
  reasons: readonly PairReason[],
  textOf: (nctId: string) => string,
): Required<Pick<BenchmarkCheckResult, "rows" | "byArm" | "compared" | "parts">> {
  const byKey = new Map(transcripts.map((t) => [`${t.patient} ${t.nctId} ${t.arm}`, t]));
  const reasonOf = new Map(reasons.map((r) => [`${r.patient} ${r.nctId}`, r]));
  const found = arms.flatMap((arm) =>
    pairs.flatMap((p) => {
      const t = byKey.get(`${p.patient} ${p.nctId} ${arm}`);
      return t === undefined ? [] : [{ t, reason: reasonOf.get(`${p.patient} ${p.nctId}`) }];
    }),
  );
  const rows = found.map(({ t, reason }) => scoreBenchmarkPair(t, reason, textOf(t.nctId)));
  const partsRows = found.map(({ t, reason }) => scorePartsPair(t, reason, textOf(t.nctId)));
  return {
    rows,
    byArm: arms.map((arm) =>
      summarizeArm(
        arm,
        rows.filter((r) => r.arm === arm),
      ),
    ),
    compared: compareArms(rows),
    parts: {
      rows: partsRows,
      byArm: arms.map((arm) =>
        summarizeParts(
          arm,
          partsRows.filter((r) => r.arm === arm),
        ),
      ),
    },
  };
}

/** Differences between a committed result and a regrade of its transcripts. Empty when they match. */
export function benchmarkRegradeProblems(
  committed: BenchmarkCheckResult,
  transcripts: readonly BenchmarkTranscript[],
  pairs: readonly BenchmarkPair[],
  reasons: readonly PairReason[],
  textOf: (nctId: string) => string,
  checksums: Pick<BenchmarkCheckResult, "pairsSha256" | "accountsSha256" | "reasonsSha256">,
): string[] {
  const problems: string[] = [];
  for (const k of ["pairsSha256", "accountsSha256", "reasonsSha256"] as const) {
    if (committed[k] !== checksums[k]) problems.push(`${k} differs`);
  }
  const set = pairs.filter((p) => p.set === committed.set);
  const again = scoreBenchmark(transcripts, set, committed.arms, reasons, textOf);
  if (JSON.stringify(again.rows) !== JSON.stringify(committed.rows)) problems.push("rows differ");
  if (JSON.stringify(again.byArm) !== JSON.stringify(committed.byArm)) {
    problems.push("summaries differ");
  }
  if (JSON.stringify(again.compared) !== JSON.stringify(committed.compared)) {
    problems.push("the arms' comparison differs");
  }
  if (
    committed.parts !== undefined &&
    JSON.stringify(again.parts) !== JSON.stringify(committed.parts)
  ) {
    problems.push("the parts measure differs");
  }
  return problems;
}
