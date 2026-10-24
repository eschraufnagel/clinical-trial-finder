/**
 * Measures the fact vocabulary and, from step 8, the mapper (spec 0002 §6).
 *
 *   npm run facts:eval -- --coverage [--set dev|heldout]   what the vocabulary can express, from the labels alone
 *   npm run facts:eval -- --run <dir> --set dev|heldout    grade a mapping run; write evals/results/facts/NN-<prompt>.json
 *   npm run facts:eval -- --check                          regrade the latest result from its run; non-zero on any difference
 *
 * Deterministic: no model, no network, no clock.
 */
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { type Coverage, coverageOf } from "../evals/facts/coverage.js";
import { type FactMetrics, gradeTrial, metricsOf } from "../evals/facts/grade.js";
import {
  FACT_LABELS_DIR,
  type FactLabelSet,
  type FactLabels,
  factLabelsSha256,
  loadFactLabels,
} from "../evals/facts/labels.js";
import { type FactsEvalResult, readFactsResult, trustedMetricsOf } from "../evals/facts/result.js";
import { nextRunFile } from "../evals/run-file.js";
import type { TrialFacts } from "../src/facts/types.js";
import { loadFactVocabulary, loadTrustedFacts } from "../src/facts/vocabulary.js";
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

export const ROOT = fileURLToPath(new URL("..", import.meta.url));
export const FACT_RESULTS_DIR = join(ROOT, "evals", "results", "facts");

/** Grades the set's trials that have a mapping file in `runDir`. Throws if the run's files disagree. */
export function gradeRun(
  runDir: string,
  labels: readonly FactLabels[],
  set: FactLabelSet,
  labelsSha256: string,
  vocabularySha256: string,
): FactsEvalResult {
  const chosen = labels.filter((l) => l.set === set);
  const graded: TrialFacts[] = [];
  const missing: string[] = [];
  for (const l of chosen) {
    const path = join(runDir, `${l.nctId}.json`);
    if (existsSync(path)) graded.push(JSON.parse(readFileSync(path, "utf8")) as TrialFacts);
    else missing.push(l.nctId);
  }
  const first = graded[0];
  if (first === undefined) throw new Error(`${runDir} has no mapping for any ${set} trial.`);
  for (const t of graded) {
    for (const key of [
      "model",
      "promptVersion",
      "vocabularySha256",
      "seed",
      "temperature",
    ] as const) {
      if (t.run[key] !== first.run[key])
        throw new Error(`${t.nctId} was mapped with a different ${key} from the rest of the run.`);
    }
  }
  if (first.run.vocabularySha256 !== vocabularySha256)
    throw new Error("The run was mapped with a different vocabulary from the committed one.");
  const byId = new Map(chosen.map((l) => [l.nctId, l]));
  const mappingRows = [];
  const labelRows = [];
  const rejected = [];
  for (const t of graded) {
    const label = byId.get(t.nctId);
    if (label === undefined) continue;
    const g = gradeTrial(label, t);
    mappingRows.push(...g.mappings);
    labelRows.push(...g.labels);
    rejected.push(...t.rejected.map((r) => ({ nctId: t.nctId, reason: r.reason })));
  }
  const trials = graded.map((t) => t.nctId);
  return {
    version: 1,
    set,
    runDir: relative(ROOT, resolve(runDir)),
    run: first.run,
    labelsSha256,
    trials,
    missing,
    mappingRows,
    labelRows,
    rejected,
    metrics: metricsOf(mappingRows, labelRows, rejected, trials.length),
  };
}

export function formatMetrics(m: FactMetrics, label: string): string {
  const pct = (x: number) => `${(x * 100).toFixed(1)}%`;
  return [
    `${label}: ${m.trials} trials, ${m.modelMappings} model mappings, ${m.labelled} labelled`,
    `  wrong rule-outs ${m.wrong} (${pct(m.wrongShare)}, 95% interval ${pct(m.wrongInterval[0])} to ${pct(m.wrongInterval[1])}); whole-trial ${m.wrongWholeTrial}, in ${m.trialsWithWrongWholeTrial} trials`,
    `  mapping recall ${pct(m.recall)} (${m.found} of ${m.labelled}; 95% interval ${pct(m.recallInterval[0])} to ${pct(m.recallInterval[1])})`,
    `  exact ${m.exact} · safe ${m.safe} · wrong ${m.wrong} · unplaced ${m.unplaced}; exact share of matched ${pct(m.exactShare)}`,
    `  rejected ${m.rejected}${m.rejectedByReason.map((r) => `; ${r.reason} ${r.count}`).join("")}`,
  ].join("\n");
}

function latestResult(): string | undefined {
  if (!existsSync(FACT_RESULTS_DIR)) return undefined;
  const names = readdirSync(FACT_RESULTS_DIR)
    .filter((n) => /^\d+-[0-9a-f]+\.json$/.test(n))
    .sort((a, b) => Number(a.split("-")[0]) - Number(b.split("-")[0]));
  const last = names.at(-1);
  return last === undefined ? undefined : join(FACT_RESULTS_DIR, last);
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
  const texts = new Map(loadSnapshot().trials.map((t) => [t.nctId, t.eligibility.criteriaText]));
  const vocabulary = loadFactVocabulary();
  const labels = loadFactLabels(FACT_LABELS_DIR, vocabulary, texts);
  const labelsSha = factLabelsSha256(FACT_LABELS_DIR);

  if (args.includes("--coverage")) {
    process.stdout.write(formatCoverage(coverageOf(labels, set), set ?? "dev and held-out"));
    return;
  }
  if (args.includes("--check")) {
    const file = latestResult();
    if (file === undefined) {
      console.error("No committed facts result to check.");
      process.exitCode = 1;
      return;
    }
    const committed = readFactsResult(file);
    const rerun = gradeRun(
      join(ROOT, committed.runDir),
      labels,
      committed.set,
      labelsSha,
      vocabulary.sha256,
    );
    if (
      JSON.stringify(rerun.mappingRows) !== JSON.stringify(committed.mappingRows) ||
      JSON.stringify(rerun.labelRows) !== JSON.stringify(committed.labelRows)
    ) {
      console.error(`${file} doesn't match a regrade of ${committed.runDir}.`);
      process.exitCode = 1;
      return;
    }
    console.log(`${file} matches a regrade of ${committed.runDir}, row for row.`);
    return;
  }
  const runDir = args.includes("--run") ? args[args.indexOf("--run") + 1] : undefined;
  if (runDir === undefined || set === undefined) {
    console.error("Give --coverage, --check, or --run <dir> --set dev|heldout.");
    process.exitCode = 1;
    return;
  }
  const graded = gradeRun(runDir, labels, set, labelsSha, vocabulary.sha256);
  const trusted = loadTrustedFacts(vocabulary);
  const result: FactsEvalResult = {
    ...graded,
    trustedFacts: [...trusted].sort(),
    trustedMetrics: trustedMetricsOf(graded, trusted),
  };
  mkdirSync(FACT_RESULTS_DIR, { recursive: true });
  const path = join(FACT_RESULTS_DIR, nextRunFile(FACT_RESULTS_DIR, result.run.promptVersion));
  writeFileSync(path, `${JSON.stringify(result, null, 2)}\n`, "utf8");
  console.log(`Wrote ${relative(ROOT, path)}`);
  console.log(
    `Model ${result.run.model} (${result.run.quantization}), temperature ${result.run.temperature}, seed ${result.run.seed}, prompt ${result.run.promptVersion}`,
  );
  if (result.missing.length > 0)
    console.log(`Not mapped, so not graded: ${result.missing.join(" ")}`);
  console.log(formatMetrics(result.metrics, `${set}, all facts`));
  if (result.trustedMetrics !== undefined)
    console.log(formatMetrics(result.trustedMetrics, `${set}, the ${trusted.size} trusted facts`));
}

if (import.meta.main) {
  main();
}
