/**
 * One made-up patient's conversation, step by step (spec 0003 §1).
 *
 *   npm run questions:try -- --patient evals/cases/patients/dev/p08.json
 *       [--scorer fixed|count|shortlist] [--budget N] [--run <dir>] [--reads <file>]
 *
 * Runs the patient's search, then the intake and the chosen questions,
 * answered from what the patient knows, or with `--reads` from the reader's
 * readings of their replies (questions:read). Prints each question, the answer or
 * "doesn't know", and which trials entered or left the short list; then the
 * stop, the short list with each trial's hints in the trial's own words, and
 * the questions left for the oncologist. No trial is dropped, and nothing
 * here says a trial fits. No model, no network.
 */
import { fromKnowledge } from "../evals/questions/arms.js";
import { loadPatient } from "../evals/questions/patients.js";
import { fromReads, readReadsFile } from "../evals/questions/reads.js";
import type { FactVocabulary } from "../src/facts/types.js";
import {
  type ConversationResult,
  openQuestions,
  runConversation,
} from "../src/questions/conversation.js";
import { UNKNOWN } from "../src/questions/select.js";
import { SCORERS, type ScorerName, skippedFacts } from "../src/questions/settings.js";
import { describeMapping } from "./facts-show.js";
import { loadContext, trialsFor } from "./questions-eval.js";

const STOPS = {
  budget: "the question budget was reached",
  "nothing-left": "no question is left that any of these trials asks about",
  stable: "no answer to any question left could change the short list",
} as const;

export function formatTry(
  patientId: string,
  result: ConversationResult,
  vocabulary: FactVocabulary,
  candidates: number,
  skipped: readonly string[] = [],
): string {
  const fact = (id: string) => vocabulary.facts.find((f) => f.id === id);
  const words = (factId: string, reply: string) =>
    reply === UNKNOWN
      ? "doesn't know"
      : (fact(factId)?.answers.find((a) => a.id === reply)?.words ?? reply);

  const lines = [`${patientId}: ${candidates} trials from the search.`, ""];
  let n = 0;
  for (const step of result.steps) {
    n++;
    const label = step.phase === "intake" ? "intake" : `follow-up, score ${step.score?.toFixed(2)}`;
    lines.push(
      `${String(n).padStart(2)}. ${fact(step.factId)?.question ?? step.factId}  (${label})`,
    );
    lines.push(`    ${words(step.factId, step.reply)}`);
    if (step.left.length > 0)
      lines.push(`    moved down: ${step.left.join(" ")}; moved up: ${step.entered.join(" ")}`);
  }
  lines.push(
    "",
    `Stopped: ${STOPS[result.stop]}.`,
    "",
    "Short list, nearest first among trials with fewest hints:",
  );
  for (const e of result.shortlist) {
    const status = e.status;
    const miles = e.candidate.nearestSite?.miles;
    lines.push(
      `  ${e.candidate.nctId}  ${miles === null || miles === undefined ? "distance unknown" : `${miles} mi`}  ${e.candidate.briefTitle}`,
    );
    const hints = [...(status?.hints ?? []), ...(status?.partHints ?? [])];
    if (status === null) lines.push("    not mapped: no hints either way");
    else if (hints.length === 0) lines.push("    no hint from these answers");
    for (const m of hints) {
      lines.push(`    - ${describeMapping(m, vocabulary)}`);
      lines.push(`      "${m.source.text.replace(/\s+/g, " ").trim().slice(0, 160)}"`);
    }
  }
  lines.push("", "Questions for the oncologist, by how many short-list trials ask about them:");
  for (const { factId, trials } of openQuestions(
    result.shortlist,
    result.profile,
    vocabulary,
    skipped,
  )) {
    lines.push(`  ${String(trials).padStart(3)}  ${fact(factId)?.question ?? factId}`);
  }
  lines.push("", "None of this says a trial fits. The oncologist and the trial team decide.");
  return `${lines.join("\n")}\n`;
}

function main(): void {
  const args = process.argv.slice(2);
  const value = (flag: string) => (args.includes(flag) ? args[args.indexOf(flag) + 1] : undefined);
  const path = value("--patient");
  if (path === undefined) {
    console.error("Give --patient <file>.");
    process.exitCode = 1;
    return;
  }
  const scorer = value("--scorer");
  if (scorer !== undefined && !SCORERS.includes(scorer as ScorerName)) {
    console.error(`--scorer is one of ${SCORERS.join(", ")}.`);
    process.exitCode = 1;
    return;
  }
  const budget = value("--budget");
  const ctx = loadContext(value("--run"));
  const patient = loadPatient(path, ctx.vocabulary, ctx.zips);
  const trials = trialsFor(patient, ctx);
  const readsPath = value("--reads");
  const answerFrom = readsPath === undefined ? fromKnowledge : fromReads(readReadsFile(readsPath));
  const result = runConversation({
    trials,
    vocabulary: ctx.vocabulary,
    settings: ctx.settings,
    cancerType: patient.search.cancerType,
    sex: patient.search.sex,
    answer: (factId) => answerFrom(patient, factId),
    ...(scorer === undefined ? {} : { scorer: scorer as ScorerName }),
    ...(budget === undefined ? {} : { budget: Number(budget) }),
  });
  process.stdout.write(
    formatTry(
      patient.id,
      result,
      ctx.vocabulary,
      trials.length,
      skippedFacts(ctx.settings, patient.search.sex),
    ),
  );
}

if (import.meta.main) {
  main();
}
