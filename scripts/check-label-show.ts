/**
 * Prints a pair for slice 0007's labels (spec 0007 §7.1): the patient's file
 * and the trial's eligibility text, numbered by line.
 *
 *   npm run check:label-show -- <patient> <NCT ID>   one pair
 *   npm run check:label-show -- --next               the first pick with no label
 *   npm run check:label-show -- --list               every pick, and whether it's labelled
 *
 * Can't see the parser, the link or a model (`tests/boundary.test.ts`): a
 * label says what the trial's text and the patient's file say, before
 * anything reads the trial.
 */
import { existsSync } from "node:fs";
import {
  type CheckContext,
  conversationsFor,
  loadCheckContext,
  PAIR_LABELS_PATH,
  type PairPick,
  picksOf,
  picksProblems,
  readCommittedQuestionsResult,
  readPairLabels,
} from "../evals/check/pairs.js";
import type { Patient } from "../evals/questions/patients.js";
import { factsFor } from "../src/facts/vocabulary.js";
import type { SnapshotTrial } from "../src/trials/snapshot-types.js";

export function formatPatient(patient: Patient, ctx: Pick<CheckContext, "vocabulary">): string {
  const s = patient.search;
  const lines = [
    `${patient.id}: ${patient.persona}`,
    `Search: ${s.cancerType}, ${s.age}, ${s.sex}, ZIP ${s.zip}, ${s.radiusMiles ?? "anywhere"} miles`,
    "Record (* the person knows it):",
    ...factsFor(ctx.vocabulary, s.cancerType).map((f) => {
      const value = patient.record[f.id] ?? "—";
      const known = patient.knows.includes(f.id) ? "*" : " ";
      const said = patient.says[f.id];
      return `  ${known} ${f.id.padEnd(26)} ${value}${said === undefined ? "" : `   "${said}"`}`;
    }),
  ];
  return lines.join("\n");
}

export function formatTrial(trial: SnapshotTrial): string {
  return [
    `${trial.nctId}  ${trial.briefTitle}`,
    `Conditions: ${trial.conditions.join("; ")}`,
    `Phases: ${trial.phases.join(", ") || "—"}`,
    "",
    ...trial.eligibility.criteriaText
      .split("\n")
      .map((line, i) => `${String(i + 1).padStart(4)}  ${line}`),
  ].join("\n");
}

function main(): void {
  const args = process.argv.slice(2);
  const ctx = loadCheckContext();
  const bySet = (["dev", "heldout"] as const).map((set) => ({
    set,
    conversations: conversationsFor(set, ctx),
  }));
  const conversations = bySet.flatMap((s) => s.conversations);
  const picks: PairPick[] = bySet.flatMap((s) => s.conversations.flatMap((c) => picksOf(c, s.set)));
  const problems = picksProblems(picks, readCommittedQuestionsResult());
  if (problems.length > 0) {
    console.error(`The picks don't match the committed result:\n  ${problems.join("\n  ")}`);
    process.exitCode = 1;
    return;
  }
  const labelled = new Set(
    existsSync(PAIR_LABELS_PATH)
      ? readPairLabels().pairs.map((p) => `${p.patient} ${p.nctId}`)
      : [],
  );
  const key = (p: PairPick) => `${p.patient} ${p.nctId}`;

  if (args.includes("--list")) {
    for (const p of picks)
      console.log(`${labelled.has(key(p)) ? "x" : " "} ${p.set.padEnd(7)} ${key(p)}  #${p.rank}`);
    return;
  }
  let pick: PairPick | undefined;
  if (args.includes("--next")) {
    pick = picks.find((p) => !labelled.has(key(p)));
    if (pick === undefined) {
      console.log("Every pair is labelled.");
      return;
    }
  } else {
    const [patient, nctId] = args.filter((a) => !a.startsWith("--"));
    pick = picks.find((p) => p.patient === patient && p.nctId === nctId);
    if (pick === undefined) {
      console.error("Give a patient and an NCT ID that's one of their picks, --next or --list.");
      process.exitCode = 1;
      return;
    }
  }
  const patient = conversations.find((c) => c.patient.id === pick.patient)?.patient;
  const trial = ctx.snapshot.trials.find((t) => t.nctId === pick.nctId);
  if (patient === undefined || trial === undefined) throw new Error(`No ${key(pick)}`);
  process.stdout.write(
    `${pick.set} pair, pick #${pick.rank}\n\n${formatPatient(patient, ctx)}\n\n${formatTrial(trial)}\n`,
  );
}

if (import.meta.main) {
  main();
}
