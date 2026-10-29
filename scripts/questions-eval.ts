/**
 * Measures question selection on the made-up patients (spec 0003 §6).
 *
 *   npm run questions:eval                    dev and held-out; write evals/results/questions/NN-<settings>.json
 *   npm run questions:eval -- --dev           dev only; write evals/results/questions/dev/
 *   npm run questions:eval -- --check [--dev] rerun the latest committed result; non-zero on any difference
 *   npm run questions:eval -- --reads <file>  answer from a reads file (questions:read) instead of what
 *                                             the patients know; write evals/results/questions/with-reads/
 *
 * Deterministic: no model, no network, no clock. Each patient's search runs
 * on the snapshot, their trials' mappings come from the run named in
 * data/facts/<month>/latest, and their answers from what they know.
 */
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { basename, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { armsFor } from "../evals/questions/arms.js";
import type { ArmSummary } from "../evals/questions/metrics.js";
import { loadPatients, type Patient, type PatientSet } from "../evals/questions/patients.js";
import { fromReads, type ReadsFile, readReadsFile } from "../evals/questions/reads.js";
import {
  patientsSha256,
  type QuestionsEvalResult,
  readResult,
  summariesFor,
} from "../evals/questions/result.js";
import { nextRunFile } from "../evals/run-file.js";
import { readTrialFacts, runDirFor } from "../src/facts/run.js";
import type { FactVocabulary } from "../src/facts/types.js";
import { loadFactVocabulary } from "../src/facts/vocabulary.js";
import type { TrialInput } from "../src/questions/select.js";
import { type ConversationSettings, loadConversationSettings } from "../src/questions/settings.js";
import { trialsForSearch } from "../src/questions/trials.js";
import { loadZipPoints, type Point } from "../src/search/geo.js";
import { loadSnapshot } from "../src/trials/snapshot-load.js";

export const RESULTS_DIR = fileURLToPath(new URL("../evals/results/questions", import.meta.url));

export interface EvalContext {
  vocabulary: FactVocabulary;
  settings: ConversationSettings;
  zips: Map<string, Point>;
  snapshot: ReturnType<typeof loadSnapshot>;
  runDir: string;
}

export function loadContext(run?: string): EvalContext {
  const vocabulary = loadFactVocabulary();
  const snapshot = loadSnapshot();
  return {
    vocabulary,
    settings: loadConversationSettings(vocabulary),
    zips: loadZipPoints(),
    snapshot,
    runDir: runDirFor(snapshot.manifest.month, run),
  };
}

/** A patient's search, with each trial's mappings from the run, or `null` where it has none. */
export function trialsFor(patient: Patient, ctx: EvalContext): TrialInput[] {
  return trialsForSearch(patient.search, ctx.snapshot, ctx.zips, (nctId) =>
    readTrialFacts(ctx.runDir, nctId),
  );
}

export function scorePatients(
  sets: readonly PatientSet[],
  ctx: EvalContext,
  reads?: { path: string; file: ReadsFile },
): QuestionsEvalResult {
  const { vocabulary, settings } = ctx;
  if (reads !== undefined) {
    // Readings of replies a patient no longer gives would answer for them silently.
    for (const set of sets) {
      if (reads.file.set !== set || reads.file.patientsSha256 !== patientsSha256(set))
        throw new Error(
          `${reads.path} was read from other patients than the committed ${set} set.`,
        );
    }
    if (reads.file.vocabularySha256 !== vocabulary.sha256)
      throw new Error(`${reads.path} was read with another vocabulary.`);
  }
  const manifest = JSON.parse(readFileSync(join(ctx.runDir, "manifest.json"), "utf8")) as {
    run: { promptVersion: string; vocabularySha256: string };
  };
  const rows = sets.flatMap((set) =>
    loadPatients(set, vocabulary, ctx.zips).flatMap((patient) =>
      armsFor(patient, set, trialsFor(patient, ctx), vocabulary, settings, {
        fromStart: set === "dev",
        ...(reads === undefined ? {} : { answer: fromReads(reads.file) }),
      }),
    ),
  );
  const { sha256, ...rest } = settings;
  return {
    version: 1,
    sets: [...sets],
    patientsSha256: Object.fromEntries(sets.map((s) => [s, patientsSha256(s)])),
    settings: rest,
    settingsSha256: sha256,
    run: {
      name: basename(ctx.runDir),
      promptVersion: manifest.run.promptVersion,
      vocabularySha256: manifest.run.vocabularySha256,
    },
    snapshot: { month: ctx.snapshot.manifest.month, sha256: ctx.snapshot.manifest.sha256 },
    reads:
      reads === undefined
        ? null
        : relative(fileURLToPath(new URL("..", import.meta.url)), reads.path),
    rows,
    summaries: summariesFor(rows, sets),
  };
}

/**
 * The settings a `--check` reruns a committed result under: the ones it
 * records, so a dev result made before Gate 2 froze the settings still checks.
 * The vocabulary, patients and run are today's, and must reproduce it.
 */
export function settingsForCheck(
  committed: Pick<QuestionsEvalResult, "settings" | "settingsSha256">,
  _current: ConversationSettings,
): ConversationSettings {
  return { ...committed.settings, sha256: committed.settingsSha256 };
}

export function latestResultFile(dir: string): string | undefined {
  let names: string[];
  try {
    names = readdirSync(dir).filter((name) => /^\d+-[0-9a-f]+\.json$/.test(name));
  } catch {
    return undefined;
  }
  names.sort((a, b) => Number(a.split("-")[0]) - Number(b.split("-")[0]));
  const last = names.at(-1);
  return last === undefined ? undefined : join(dir, last);
}

const percent = (x: number | null) =>
  x === null ? "  -  " : `${(100 * x).toFixed(0)}%`.padStart(5);

export function formatSummaries(set: PatientSet, summaries: readonly ArmSummary[]): string {
  const lines = [
    `${set}:`,
    "  arm           scorer      agree  flag  follow-ups  don't-know  stops",
  ];
  for (const s of summaries) {
    const stops = Object.entries(s.stops)
      .map(([k, v]) => `${k} ${v}`)
      .join(", ");
    lines.push(
      `  ${s.arm.padEnd(13)} ${(s.scorer ?? "").padEnd(10)} ${percent(s.agreement)} ${percent(s.wouldFlag)}  ${s.followUps.toFixed(1).padStart(10)}  ${String(s.dontKnows).padStart(10)}  ${stops}`,
    );
  }
  const curves = summaries.filter((s) => s.curve !== null);
  if (curves.length > 0) {
    lines.push("", "  agreement after k follow-ups (k = 0, 2, 4, ... 20):");
    for (const s of curves) {
      const points = (s.curve ?? []).filter((_, k) => k % 2 === 0).map((p) => percent(p.agreement));
      lines.push(`  ${s.arm.padEnd(13)} ${(s.scorer ?? "").padEnd(10)} ${points.join(" ")}`);
    }
  }
  return lines.join("\n");
}

function main(): void {
  const args = process.argv.slice(2);
  const readsArg = args.includes("--reads") ? args[args.indexOf("--reads") + 1] : undefined;
  const reads =
    readsArg === undefined ? undefined : { path: readsArg, file: readReadsFile(readsArg) };
  const devOnly = args.includes("--dev");
  const dir =
    reads !== undefined
      ? join(RESULTS_DIR, "with-reads")
      : devOnly
        ? join(RESULTS_DIR, "dev")
        : RESULTS_DIR;
  const sets: PatientSet[] =
    reads !== undefined ? [reads.file.set] : devOnly ? ["dev"] : ["dev", "heldout"];

  if (args.includes("--check")) {
    const file = latestResultFile(dir);
    if (file === undefined) {
      console.error(`No committed result in ${dir} to check.`);
      process.exitCode = 1;
      return;
    }
    const committed = readResult(file);
    const ctx = loadContext();
    const rerun = scorePatients(
      committed.sets,
      { ...ctx, settings: settingsForCheck(committed, ctx.settings) },
      committed.reads === null
        ? undefined
        : {
            path: join(fileURLToPath(new URL("..", import.meta.url)), committed.reads),
            file: readReadsFile(
              join(fileURLToPath(new URL("..", import.meta.url)), committed.reads),
            ),
          },
    );
    const differing = rerun.rows.filter(
      (row, i) => JSON.stringify(row) !== JSON.stringify(committed.rows[i]),
    );
    if (
      differing.length > 0 ||
      rerun.rows.length !== committed.rows.length ||
      JSON.stringify(rerun.summaries) !== JSON.stringify(committed.summaries) ||
      rerun.settingsSha256 !== committed.settingsSha256
    ) {
      console.error(`${file} doesn't match a rerun: ${differing.length} rows differ.`);
      process.exitCode = 1;
      return;
    }
    console.log(`${file} matches a rerun, row for row.`);
    return;
  }

  const result = scorePatients(sets, loadContext(), reads);
  mkdirSync(dir, { recursive: true });
  const path = join(dir, nextRunFile(dir, result.settingsSha256.slice(0, 12)));
  writeFileSync(path, `${JSON.stringify(result, null, 2)}\n`, "utf8");
  console.log(`Wrote ${path}\n`);
  for (const set of sets) console.log(`${formatSummaries(set, result.summaries[set] ?? [])}\n`);
}

if (import.meta.main) {
  main();
}
