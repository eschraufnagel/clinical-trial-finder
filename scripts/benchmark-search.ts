/**
 * Scores the search against the benchmarks' judgments (spec 0008 §5, §6).
 *
 *   npm run benchmark:search -- --trec            TREC's nine cancer notes, once: refused if a result exists
 *   npm run benchmark:search -- --trec --check    rescore and compare with the latest result
 *
 * Deterministic: no model, no network, no clock. Every input is a committed file,
 * and the result names each one's sha256.
 */
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  scoreTrec,
  type TrecSearchResult,
  type TrecSummary,
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
import { nextRunFile } from "../evals/run-file.js";
import { loadVocabulary, type Vocabulary } from "../src/search/vocabulary.js";

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
  throw new Error("Say which benchmark: --trec.");
}

main();
