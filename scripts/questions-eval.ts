/**
 * Measures question selection on the made-up patients (spec 0003 §6).
 *
 *   npm run questions:eval                    dev and held-out; write evals/results/questions/NN-<settings>.json
 *   npm run questions:eval -- --dev           dev only; write evals/results/questions/dev/
 *   npm run questions:eval -- --check [--dev] rerun the latest committed result; non-zero on any difference
 *
 * Deterministic: no model, no network, no clock. Each patient's search runs
 * on the snapshot, their trials' mappings come from the run named in
 * data/facts/<month>/latest, and their answers from what they know.
 */
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { basename, join } from "node:path";
import { fileURLToPath } from "node:url";
import { armsFor } from "../evals/questions/arms.js";
import type { ArmSummary } from "../evals/questions/metrics.js";
import { loadPatients, type Patient, type PatientSet } from "../evals/questions/patients.js";
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
import { loadZipPoints, type Point } from "../src/search/geo.js";
import { searchTrials } from "../src/search/search.js";
import { loadVocabulary } from "../src/search/vocabulary.js";
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
  const cancer = loadVocabulary(patient.search.cancerType);
  const { manifest, trials } = ctx.snapshot;
  const result = searchTrials(trials, manifest, cancer, ctx.zips, {
    ...patient.search,
    purposes: ["TREATMENT"],
  });
  return result.candidates.map((candidate) => ({
    candidate,
    facts: readTrialFacts(ctx.runDir, candidate.nctId) ?? null,
  }));
}

export function scorePatients(sets: readonly PatientSet[], ctx: EvalContext): QuestionsEvalResult {
  const { vocabulary, settings } = ctx;
  const manifest = JSON.parse(readFileSync(join(ctx.runDir, "manifest.json"), "utf8")) as {
    run: { promptVersion: string; vocabularySha256: string };
  };
  const rows = sets.flatMap((set) =>
    loadPatients(set, vocabulary, ctx.zips).flatMap((patient) =>
      armsFor(patient, set, trialsFor(patient, ctx), vocabulary, settings, {
        fromStart: set === "dev",
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
    reads: null,
    rows,
    summaries: summariesFor(rows, sets),
  };
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
  const devOnly = args.includes("--dev");
  const dir = devOnly ? join(RESULTS_DIR, "dev") : RESULTS_DIR;
  const sets: PatientSet[] = devOnly ? ["dev"] : ["dev", "heldout"];

  if (args.includes("--check")) {
    const file = latestResultFile(dir);
    if (file === undefined) {
      console.error(`No committed result in ${dir} to check.`);
      process.exitCode = 1;
      return;
    }
    const committed = readResult(file);
    const rerun = scorePatients(committed.sets, loadContext());
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

  const result = scorePatients(sets, loadContext());
  mkdirSync(dir, { recursive: true });
  const path = join(dir, nextRunFile(dir, result.settingsSha256.slice(0, 12)));
  writeFileSync(path, `${JSON.stringify(result, null, 2)}\n`, "utf8");
  console.log(`Wrote ${path}\n`);
  for (const set of sets) console.log(`${formatSummaries(set, result.summaries[set] ?? [])}\n`);
}

if (import.meta.main) {
  main();
}
