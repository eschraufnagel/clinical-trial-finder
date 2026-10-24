/**
 * Prints a trial for fact labelling (spec 0002 §5.2).
 *
 *   npm run facts:label-show -- NCT05053555        the trial and its numbered passages
 *   npm run facts:label-show -- --next             the first trial with an unlabelled passage
 *   npm run facts:label-show -- --vocabulary       the facts and their answer ids
 *
 * Can't see the mapper: it reaches `src/facts/` only for the vocabulary and
 * its types, and no model (`tests/boundary.test.ts`).
 */
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { FACT_LABELS_DIR, type FactLabels, isComplete } from "../evals/facts/labels.js";
import type { FactVocabulary } from "../src/facts/types.js";
import { factsFor, loadFactVocabulary } from "../src/facts/vocabulary.js";
import { loadSnapshot } from "../src/trials/snapshot-load.js";
import type { SnapshotTrial } from "../src/trials/snapshot-types.js";

export function formatVocabulary(vocabulary: FactVocabulary): string {
  return factsFor(vocabulary, "nsclc")
    .map((f) => `${f.id.padEnd(26)} ${f.answers.map((a) => a.id).join(" | ")}`)
    .join("\n");
}

export function formatForLabelling(trial: SnapshotTrial, labels: FactLabels): string {
  const lines = [
    `${trial.nctId}  (${labels.set})  ${trial.briefTitle}`,
    `Conditions: ${trial.conditions.join("; ")}`,
    `Phases: ${trial.phases.join(", ") || "—"}`,
    "",
    "Full text:",
    trial.eligibility.criteriaText,
    "",
    "Passages:",
    ...labels.passages.map((p, i) => {
      const done = p.mappings.length > 0 || p.unmapped !== null ? "x" : " ";
      return `[${done}] ${String(i + 1).padStart(3)}  ${p.quote}`;
    }),
  ];
  return `${lines.join("\n")}\n`;
}

function readLabels(nctId: string): FactLabels {
  return JSON.parse(readFileSync(join(FACT_LABELS_DIR, `${nctId}.json`), "utf8")) as FactLabels;
}

function main(): void {
  const args = process.argv.slice(2);
  const vocabulary = loadFactVocabulary();
  if (args.includes("--vocabulary")) {
    console.log(formatVocabulary(vocabulary));
    return;
  }
  let nctId = args.find((a) => /^NCT\d{8}$/.test(a));
  if (args.includes("--next")) {
    nctId = readdirSync(FACT_LABELS_DIR)
      .filter((n) => /^NCT\d{8}\.json$/.test(n))
      .sort()
      .map((n) => n.slice(0, -5))
      .find((id) => !isComplete(readLabels(id)));
    if (nctId === undefined) {
      console.log("Every trial is labelled.");
      return;
    }
  }
  if (nctId === undefined) {
    console.error("Give an NCT ID, --next or --vocabulary.");
    process.exitCode = 1;
    return;
  }
  const trial = loadSnapshot().trials.find((t) => t.nctId === nctId);
  if (trial === undefined) {
    console.error(`${nctId} isn't in the snapshot.`);
    process.exitCode = 1;
    return;
  }
  process.stdout.write(formatForLabelling(trial, readLabels(nctId)));
}

if (import.meta.main) {
  main();
}
