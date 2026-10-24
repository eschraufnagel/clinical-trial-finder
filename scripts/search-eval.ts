/**
 * Measures the search's cancer-type stage against the labels (spec 0001 §6.3).
 *
 *   npm run search:eval             score held-out and dev; write evals/results/search/NN-<vocab>.json
 *   npm run search:eval -- --dev    score the dev pool only; write evals/results/search/dev/
 *   npm run search:eval -- --check  rerun the latest committed held-out result; non-zero if any row differs
 *
 * Deterministic: no model, no network, no clock. Only the cancer-type stage
 * is measured. Purpose is fixed by how the sample was drawn, and age, sex and
 * distance are arithmetic that tests prove.
 */
import { mkdirSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { nextRunFile } from "../evals/run-file.js";
import {
  completeLabels,
  labelsSha256,
  NSCLC_LABELS,
  readSearchLabels,
} from "../evals/search/labels.js";
import { metricsFor, type ResultRow } from "../evals/search/metrics.js";
import { readResult, type SearchEvalResult } from "../evals/search/result.js";
import { loadVocabulary, reasonsFor } from "../src/search/vocabulary.js";
import { loadSnapshot } from "../src/trials/snapshot-load.js";

export const RESULTS_DIR = fileURLToPath(new URL("../evals/results/search", import.meta.url));

export function scoreLabels(devOnly: boolean): SearchEvalResult {
  const labels = readSearchLabels(NSCLC_LABELS);
  const complete = completeLabels(labels).filter((l) => !devOnly || l.set === "dev");
  const { manifest, trials } = loadSnapshot();
  if (labels.snapshot !== manifest.month) {
    throw new Error(
      `The labels are for snapshot ${labels.snapshot}, but the snapshot is ${manifest.month}.`,
    );
  }
  const vocabulary = loadVocabulary(labels.cancerType);
  const byId = new Map(trials.map((t) => [t.nctId, t]));

  const rows: ResultRow[] = complete.map((label) => {
    const trial = byId.get(label.nctId);
    if (trial === undefined)
      throw new Error(`${label.nctId} is labelled but isn't in the snapshot.`);
    const reasons = reasonsFor(trial, vocabulary);
    return {
      nctId: label.nctId,
      set: label.set,
      relevant: label.relevant,
      kept: reasons.length > 0,
      reasons,
    };
  });

  return {
    version: 1,
    cancerType: labels.cancerType,
    snapshot: { month: manifest.month, sha256: manifest.sha256 },
    vocabularySha256: vocabulary.sha256,
    labelsSha256: labelsSha256(NSCLC_LABELS),
    rows,
    heldout: devOnly ? null : metricsFor(rows.filter((r) => r.set === "heldout")),
    dev: metricsFor(rows.filter((r) => r.set === "dev")),
  };
}

export function latestResultFile(dir: string = RESULTS_DIR): string | undefined {
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

function describe(name: string, m: SearchEvalResult["dev"]): string {
  const percent = (x: number) => `${(x * 100).toFixed(1)}%`;
  return [
    `${name}: ${m.labelled} labelled, ${m.relevant} relevant, ${m.kept} kept`,
    `  recall ${percent(m.recall)} (95% interval ${percent(m.recallInterval[0])} to ${percent(m.recallInterval[1])}), precision ${percent(m.precision)}`,
    `  by reason: ${m.byReason.map((r) => `${r.reason} ${r.keptRelevant}/${r.kept}`).join(", ")}`,
    `  misses: ${m.misses.length === 0 ? "none" : m.misses.join(" ")}`,
  ].join("\n");
}

function main(): void {
  const args = process.argv.slice(2);

  if (args.includes("--check")) {
    const file = latestResultFile();
    if (file === undefined) {
      console.error("No committed held-out result to check.");
      process.exitCode = 1;
      return;
    }
    const committed = readResult(file);
    const rerun = scoreLabels(false);
    const differing = rerun.rows.filter(
      (row, i) => JSON.stringify(row) !== JSON.stringify(committed.rows[i]),
    );
    if (
      differing.length > 0 ||
      rerun.rows.length !== committed.rows.length ||
      rerun.vocabularySha256 !== committed.vocabularySha256
    ) {
      console.error(`${file} doesn't match a rerun: ${differing.length} rows differ.`);
      process.exitCode = 1;
      return;
    }
    console.log(`${file} matches a rerun, row for row.`);
    return;
  }

  const devOnly = args.includes("--dev");
  const result = scoreLabels(devOnly);
  const dir = devOnly ? join(RESULTS_DIR, "dev") : RESULTS_DIR;
  mkdirSync(dir, { recursive: true });
  const path = join(dir, nextRunFile(dir, result.vocabularySha256.slice(0, 12)));
  writeFileSync(path, `${JSON.stringify(result, null, 2)}\n`, "utf8");
  console.log(`Wrote ${path}`);
  if (result.heldout !== null) console.log(describe("Held-out", result.heldout));
  console.log(describe("Dev (tuned on)", result.dev));
}

if (import.meta.main) {
  main();
}
