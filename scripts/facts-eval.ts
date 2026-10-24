/**
 * Measures the fact vocabulary and, from step 8, the mapper (spec 0002 §6).
 *
 *   npm run facts:eval -- --coverage [--set dev|heldout]   what the vocabulary can express, from the labels alone
 *
 * Deterministic: no model, no network, no clock.
 */
import { type Coverage, coverageOf } from "../evals/facts/coverage.js";
import { FACT_LABELS_DIR, type FactLabelSet, loadFactLabels } from "../evals/facts/labels.js";
import { loadFactVocabulary } from "../src/facts/vocabulary.js";
import { loadSnapshot } from "../src/trials/snapshot-load.js";

export function formatCoverage(c: Coverage, label: string): string {
  const pct = (x: number) => `${(x * 100).toFixed(1)}%`;
  const lines = [
    `${label}: ${c.trials} trials, ${c.passages} passages, ${c.rules} of them rules`,
    `  mapped ${c.byCategory.mapped} · vocabulary gap ${c.byCategory["vocabulary-gap"]} · trial-specific ${c.byCategory["trial-specific"]} · organ function ${c.byCategory["organ-function"]} · procedure ${c.byCategory.procedure} · not a rule ${c.byCategory["not-a-rule"]}`,
    `  mapped share of rules ${pct(c.mappedShare)}; of rules about the person ${pct(c.mappedShareOfPersonRules)} (${c.byCategory.mapped} of ${c.personRules})`,
    `  mappings scoped to part of a trial: ${c.scoped}`,
    "",
    "  Facts used (trials · mappings):",
    ...c.factUse.map(
      (f) => `    ${f.factId.padEnd(26)} ${String(f.trials).padStart(3)} · ${f.mappings}`,
    ),
    "",
    "  Vocabulary gaps (trials · passages):",
    ...c.gaps.map((g) => `    ${g.gap.padEnd(44)} ${String(g.trials).padStart(3)} · ${g.passages}`),
  ];
  return `${lines.join("\n")}\n`;
}

function main(): void {
  const args = process.argv.slice(2);
  const setArg = args[args.indexOf("--set") + 1];
  const set = args.includes("--set") ? (setArg as FactLabelSet) : undefined;
  if (set !== undefined && set !== "dev" && set !== "heldout") {
    console.error("--set must be dev or heldout");
    process.exitCode = 1;
    return;
  }
  if (!args.includes("--coverage")) {
    console.error("Give --coverage. Grading a mapping run arrives with the mapper.");
    process.exitCode = 1;
    return;
  }
  const texts = new Map(loadSnapshot().trials.map((t) => [t.nctId, t.eligibility.criteriaText]));
  const labels = loadFactLabels(FACT_LABELS_DIR, loadFactVocabulary(), texts);
  process.stdout.write(formatCoverage(coverageOf(labels, set), set ?? "dev and held-out"));
}

if (import.meta.main) {
  main();
}
