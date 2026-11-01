/**
 * Scores the search against the benchmarks' judgments (spec 0008 §5, §6).
 *
 *   npm run benchmark:search -- --trec            TREC's nine cancer notes, once: refused if a result exists
 *   npm run benchmark:search -- --trec --check    rescore and compare with the latest result
 *   npm run benchmark:search -- --trialbench      NIH-TrialBench's NCI vignettes over the 2026-10 snapshot, once
 *   npm run benchmark:search -- --trialbench --check
 *
 * Deterministic: no model, no network, no clock. Every input is a committed file,
 * and the result names each one's sha256.
 */
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  scoreTrec,
  scoreTrialBench,
  type TrecSearchResult,
  type TrecSummary,
  type TrialBenchSearchResult,
  vocabulariesHash,
} from "../evals/benchmark/search-score.js";
import { fileSha256, SOURCES_PATH } from "../evals/benchmark/sources.js";
import {
  loadTrec,
  readTrecProfiles,
  TREC_PROFILES_PATH,
  TREC_QRELS_PATH,
  TREC_TOPICS_PATH,
  TREC_TRIALS_PATH,
} from "../evals/benchmark/trec.js";
import {
  loadTrialBench,
  readTrialBenchProfiles,
  TRIALBENCH_DIR,
  TRIALBENCH_PROFILES_PATH,
} from "../evals/benchmark/trialbench.js";
import { nextRunFile } from "../evals/run-file.js";
import { loadZipPoints } from "../src/search/geo.js";
import { loadOthers } from "../src/search/other.js";
import { loadVocabulary, type Vocabulary } from "../src/search/vocabulary.js";
import { loadSnapshot } from "../src/trials/snapshot-load.js";

export const RESULTS_DIR = fileURLToPath(
  new URL("../evals/results/benchmark/search", import.meta.url),
);

function vocabulariesFor(types: readonly string[]): Map<string, Vocabulary> {
  return new Map(types.map((t) => [t, loadVocabulary(t)]));
}

function trecResult(): TrecSearchResult {
  const { trials, judgments } = loadTrec();
  const profiles = readTrecProfiles();
  return scoreTrec({
    trials,
    judgments,
    profiles,
    vocabularies: vocabulariesFor(profiles.map((p) => p.cancerType)),
    sources: {
      manifest: fileSha256(SOURCES_PATH),
      topics: fileSha256(TREC_TOPICS_PATH),
      qrels: fileSha256(TREC_QRELS_PATH),
      trials: fileSha256(TREC_TRIALS_PATH),
      profiles: fileSha256(TREC_PROFILES_PATH),
    },
  });
}

/**
 * Why each target isn't in the snapshot, read by a person from the target's
 * registry entry in 2026-10 (the snapshot keeps recruiting trials only). Not
 * fetched by this script.
 */
const TARGET_NOTES: Record<string, string> = {
  NCT03476681: "ACTIVE_NOT_RECRUITING in the registry, read 2026-10.",
  NCT06865677: "TERMINATED in the registry, read 2026-10.",
  NCT07055477: "SUSPENDED in the registry, read 2026-10.",
};

function trialBenchResult(): TrialBenchSearchResult {
  const snapshot = loadSnapshot();
  const { vignettes, labels } = loadTrialBench();
  const profiles = readTrialBenchProfiles();
  const types = [...new Set(profiles.map((p) => p.cancerType))];
  return scoreTrialBench({
    snapshot,
    zipPoints: loadZipPoints(),
    vignettes,
    profiles,
    labels,
    vocabularies: vocabulariesFor(types),
    others: new Map(types.map((t) => [t, loadOthers(t)])),
    sources: {
      snapshot: snapshot.manifest.sha256,
      manifest: fileSha256(SOURCES_PATH),
      vignettes: fileSha256(join(TRIALBENCH_DIR, "vignettes.json")),
      labels: fileSha256(join(TRIALBENCH_DIR, "labels.json")),
      profiles: fileSha256(TRIALBENCH_PROFILES_PATH),
    },
    notes: TARGET_NOTES,
  });
}

export function latestResultFile(dir: string): string | undefined {
  if (!existsSync(dir)) return undefined;
  const names = readdirSync(dir)
    .filter((name) => /^\d+-[0-9a-f]+\.json$/.test(name))
    .sort((a, b) => Number(a.split("-")[0]) - Number(b.split("-")[0]));
  const last = names.at(-1);
  return last === undefined ? undefined : join(dir, last);
}

function percent(x: number): string {
  return `${(x * 100).toFixed(1)}%`;
}

function describe(s: TrecSummary): string {
  const r = s.relevant;
  return `${s.name.padEnd(18)} relevant kept ${r.kept}/${r.n} ${percent(r.rate)} (${percent(r.interval[0])}–${percent(r.interval[1])}); eligible ${s.eligible.kept}/${s.eligible.n}; not relevant kept ${s.notRelevant.kept}/${s.notRelevant.n}; dropped at age or sex ${s.droppedAtAgeOrSex.length}`;
}

function run(name: string, score: () => { vocabularies: Record<string, string> }): void {
  const dir = join(RESULTS_DIR, name);
  const check = process.argv.includes("--check");
  const latest = latestResultFile(dir);
  if (check) {
    if (latest === undefined) throw new Error(`No ${name} result to check.`);
    const rerun = `${JSON.stringify(score(), null, 2)}\n`;
    if (rerun !== readFileSync(latest, "utf8")) {
      console.error(`${latest} doesn't match a rerun.`);
      process.exitCode = 1;
      return;
    }
    console.log(`${latest} matches a rerun.`);
    return;
  }
  if (latest !== undefined) {
    throw new Error(`${latest} exists. The ${name} search is scored once; --check reruns it.`);
  }
  const result = score();
  mkdirSync(dir, { recursive: true });
  const path = join(dir, nextRunFile(dir, vocabulariesHash(result.vocabularies)));
  writeFileSync(path, `${JSON.stringify(result, null, 2)}\n`);
  console.log(`Wrote ${path}`);
}

function main(): void {
  if (process.argv.includes("--trec")) {
    run("trec", trecResult);
    const latest = latestResultFile(join(RESULTS_DIR, "trec"));
    if (latest !== undefined && !process.argv.includes("--check")) {
      const result = JSON.parse(readFileSync(latest, "utf8")) as TrecSearchResult;
      for (const s of [...result.byNote, ...result.byType, result.pooled]) console.log(describe(s));
    }
    return;
  }
  if (process.argv.includes("--trialbench")) {
    run("trialbench", trialBenchResult);
    const latest = latestResultFile(join(RESULTS_DIR, "trialbench"));
    if (latest !== undefined && !process.argv.includes("--check")) {
      const { summary } = JSON.parse(readFileSync(latest, "utf8")) as TrialBenchSearchResult;
      const show = (r: { kept: number; n: number }) => `${r.kept}/${r.n}`;
      console.log(
        `Targets kept: ${show(summary.targetKept)} (every purpose ${show(summary.targetKeptAllPurposes)}); not in the snapshot: ${summary.targetsNotInSnapshot.join(", ")}`,
      );
      console.log(`By reason: ${JSON.stringify(summary.byReason)}`);
      for (const [label, r] of Object.entries(summary.labelsKept)) {
        console.log(
          `  ${label}: ${show(r)} (every purpose ${show(summary.labelsKeptAllPurposes[label] ?? r)})`,
        );
      }
    }
    return;
  }
  throw new Error("Say which benchmark: --trec or --trialbench.");
}

main();
