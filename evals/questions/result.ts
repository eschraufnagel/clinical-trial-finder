import { createHash } from "node:crypto";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { ConversationSettings } from "../../src/questions/settings.js";
import { type ArmRow, type ArmSummary, agreement, summarize, wouldFlag } from "./metrics.js";
import { PATIENTS_DIR, type PatientSet } from "./patients.js";

/**
 * A committed measurement of question selection (spec 0003 §6), and the check
 * that one is what it says it is.
 */
export interface QuestionsEvalResult {
  version: 1;
  sets: PatientSet[];
  /** Per set, of the patient files' names and bytes, so a changed patient is a different experiment. */
  patientsSha256: Partial<Record<PatientSet, string>>;
  /** `order` is absent from results made before slice 0004, which ran under `hints`. */
  settings: Omit<ConversationSettings, "sha256" | "order"> & {
    order?: ConversationSettings["order"];
  };
  settingsSha256: string;
  run: { name: string; promptVersion: string; vocabularySha256: string };
  snapshot: { month: string; sha256: string };
  /** The reads result the conversation arms answered from, or `null` for what the patient knows. */
  reads: string | null;
  rows: ArmRow[];
  summaries: Partial<Record<PatientSet, ArmSummary[]>>;
}

export function patientsSha256(set: PatientSet, dir: string = PATIENTS_DIR): string {
  const hash = createHash("sha256");
  const setDir = join(dir, set);
  for (const name of readdirSync(setDir)
    .filter((n) => n.endsWith(".json"))
    .sort()) {
    hash
      .update(name)
      .update("\0")
      .update(readFileSync(join(setDir, name)))
      .update("\0");
  }
  return hash.digest("hex");
}

export function summariesFor(rows: readonly ArmRow[], sets: readonly PatientSet[]) {
  const summaries: Partial<Record<PatientSet, ArmSummary[]>> = {};
  for (const set of sets) summaries[set] = summarize(rows.filter((r) => r.set === set));
  return summaries;
}

export function readResult(path: string): QuestionsEvalResult {
  return JSON.parse(readFileSync(path, "utf8")) as QuestionsEvalResult;
}

/**
 * Everything wrong with a result, or nothing: a summary that doesn't follow
 * from the rows, a row's agreement or would-flag that doesn't follow from its
 * short list and the record row's, or a checksum that isn't the committed
 * file's.
 */
export function verifyResult(
  result: QuestionsEvalResult,
  context: {
    patientsSha256: Partial<Record<PatientSet, string>>;
    settingsSha256?: string;
    fileName?: string;
  },
): string[] {
  const problems: string[] = [];
  if (JSON.stringify(summariesFor(result.rows, result.sets)) !== JSON.stringify(result.summaries))
    problems.push("summaries don't follow from the rows");

  const records = new Map(result.rows.filter((r) => r.arm === "record").map((r) => [r.patient, r]));
  for (const row of result.rows) {
    const record = records.get(row.patient);
    if (record === undefined) {
      problems.push(`${row.patient} has no record row`);
      continue;
    }
    const flagged = new Set(record.recordFlagged ?? []);
    if (agreement(row.shortlist, record.shortlist) !== row.agreement)
      problems.push(`${row.patient} ${row.arm} ${row.scorer ?? ""}: agreement doesn't follow`);
    if (wouldFlag(row.shortlist, flagged) !== row.wouldFlag)
      problems.push(`${row.patient} ${row.arm} ${row.scorer ?? ""}: would-flag doesn't follow`);
  }

  for (const set of result.sets) {
    if (result.patientsSha256[set] !== context.patientsSha256[set])
      problems.push(`the ${set} patients' checksum isn't the committed patients'`);
  }
  if (context.settingsSha256 !== undefined && result.settingsSha256 !== context.settingsSha256)
    problems.push("settingsSha256 isn't the committed settings'");
  if (
    context.fileName !== undefined &&
    !context.fileName.endsWith(`-${result.settingsSha256.slice(0, 12)}.json`)
  )
    problems.push("file name doesn't carry the settings' checksum");
  return problems;
}
