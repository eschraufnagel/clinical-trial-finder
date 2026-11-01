/**
 * Reads the benchmarks' downloads into the committed, trimmed files (spec 0008 §2).
 *
 *   npm run benchmark:import -- --record   first run only: write data/benchmark/sources.json
 *   npm run benchmark:import               check the downloads against it, then write
 *                                          data/benchmark/{trec,trialbench}/
 *   npm run benchmark:import -- --pairs    draw the check's pairs from the committed labels into
 *                                          evals/cases/benchmark/pairs.json; refuses to overwrite
 *
 * The downloads are in local/benchmark/, put there by a person (docs/benchmark.md
 * says how). No network: nothing here fetches. Deterministic: the output is sorted
 * and pretty-printed, so a rerun on the same downloads writes the same bytes.
 */
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { BENCHMARK_CASES_DIR, drawPairs, PAIRS_PATH } from "../evals/benchmark/pairs.js";
import {
  BENCHMARK_DATA_DIR,
  buildManifest,
  checkSources,
  jsonText,
  LOCAL_BENCHMARK_DIR,
  readManifest,
  SOURCES_PATH,
} from "../evals/benchmark/sources.js";
import {
  isSelected,
  readCorpusTrial,
  readQrels,
  readTopics,
  TREC_DIR,
  TREC_TOPICS,
  type TrecJudgment,
  type TrecYear,
  topicKey,
  trialsGz,
} from "../evals/benchmark/trec.js";
import {
  type AnnotationRow,
  benchTrialFrom,
  labelsFrom,
  loadTrialBench,
  type PatientRow,
  type ReleaseTrial,
  readJsonl,
  type SearchSpaceRow,
  TRIALBENCH_DIR,
  vignettesFrom,
} from "../evals/benchmark/trialbench.js";

const YEARS: readonly TrecYear[] = ["2021", "2022"];

function main(argv: readonly string[]): void {
  if (argv.includes("--pairs")) {
    writePairs();
    return;
  }
  const root = LOCAL_BENCHMARK_DIR;
  if (!existsSync(root)) {
    throw new Error(`${root} doesn't exist. docs/benchmark.md says what to download into it.`);
  }

  if (argv.includes("--record")) {
    if (existsSync(SOURCES_PATH)) {
      throw new Error(`${SOURCES_PATH} exists. The manifest is recorded once.`);
    }
    mkdirSync(BENCHMARK_DATA_DIR, { recursive: true });
    console.log("Checksumming the downloads (the corpus zips take a while)…");
    writeFileSync(SOURCES_PATH, jsonText(buildManifest(root)));
    console.log(`Wrote ${SOURCES_PATH}.`);
  }

  const problems = checkSources(root, readManifest());
  if (problems.length > 0) {
    throw new Error(`The downloads don't match the manifest:\n${problems.join("\n")}`);
  }

  importTrec(root);
  importTrialBench(root);
}

function importTrec(root: string): void {
  const trec = join(root, "trec");
  const topics = YEARS.flatMap((year) =>
    readTopics(readFileSync(join(trec, `topics${year}.xml`), "utf8"), year),
  ).filter((t) => isSelected(topicKey(t.year, t.number)));
  const judgments: TrecJudgment[] = YEARS.flatMap((year) =>
    readQrels(readFileSync(join(trec, `qrels${year}.txt`), "utf8"), year),
  )
    .filter((j) => isSelected(j.topic))
    .sort((a, b) => compare(a.topic, b.topic) || compare(a.nctId, b.nctId));
  if (topics.length !== TREC_TOPICS.length) {
    throw new Error(`Found ${topics.length} of the ${TREC_TOPICS.length} notes.`);
  }

  const ids = [...new Set(judgments.map((j) => j.nctId))].sort();
  const corpus = join(trec, "corpus");
  const trials = ids.map((id) => readCorpusTrial(corpus, id));

  mkdirSync(TREC_DIR, { recursive: true });
  const source = "TREC 2021 and 2022 Clinical Trials Track; see ../sources.json";
  writeFileSync(join(TREC_DIR, "topics.json"), jsonText({ source, topics }));
  writeFileSync(join(TREC_DIR, "qrels.json"), jsonText({ source, judgments }));
  writeFileSync(join(TREC_DIR, "trials.jsonl.gz"), trialsGz(trials));
  const count = (n: number) => judgments.filter((j) => j.judgment === n).length;
  console.log(
    `TREC: ${topics.length} notes, ${judgments.length} judgments (${count(2)} eligible, ${count(1)} excluded, ${count(0)} not relevant), ${trials.length} trials.`,
  );
}

function importTrialBench(root: string): void {
  const raw = join(root, "trialbench", "raw");
  const vignettes = vignettesFrom(
    readJsonl<PatientRow>(readFileSync(join(raw, "patients.jsonl"), "utf8")),
  );
  const labels = labelsFrom(
    readJsonl<AnnotationRow>(readFileSync(join(raw, "clinician_annotations.jsonl"), "utf8")),
  ).sort((a, b) => compare(a.patient, b.patient) || compare(a.nctId, b.nctId));
  const space = new Map(
    readJsonl<SearchSpaceRow>(readFileSync(join(raw, "trial_search_space.jsonl"), "utf8")).map(
      (row) => [row.trial_id, row],
    ),
  );

  const ids = [...new Set([...labels.map((l) => l.nctId), ...vignettes.map((v) => v.targetTrial)])];
  const releaseDir = join(root, "trialbench", "trials");
  const released = new Set(readdirSync(releaseDir));
  let differ = 0;
  const trials = ids.sort().map((id) => {
    const row = space.get(id);
    if (row === undefined) throw new Error(`${id} isn't in trial_search_space.jsonl.`);
    if (!released.has(`${id}.json`)) throw new Error(`${id} has no file in trials/.`);
    const release = JSON.parse(
      readFileSync(join(releaseDir, `${id}.json`), "utf8"),
    ) as ReleaseTrial;
    if (release.raw_criteria !== row.raw_criteria) differ += 1;
    return benchTrialFrom(row, release);
  });

  mkdirSync(TRIALBENCH_DIR, { recursive: true });
  const source = "NIH-TrialBench, NCI rows only; see ../sources.json";
  writeFileSync(join(TRIALBENCH_DIR, "vignettes.json"), jsonText({ source, vignettes }));
  writeFileSync(join(TRIALBENCH_DIR, "labels.json"), jsonText({ source, labels }));
  writeFileSync(join(TRIALBENCH_DIR, "trials.jsonl.gz"), trialsGz(trials));
  console.log(
    `NIH-TrialBench: ${vignettes.length} NCI vignettes, ${labels.length} labels, ${trials.length} trials; criteria in trials/ differ from the search space's for ${differ}.`,
  );
}

function writePairs(): void {
  if (existsSync(PAIRS_PATH)) throw new Error(`${PAIRS_PATH} exists. The pairs are drawn once.`);
  const pairs = drawPairs(loadTrialBench().labels);
  mkdirSync(BENCHMARK_CASES_DIR, { recursive: true });
  const note =
    "The deeper check's pairs (spec 0008 §7.1), drawn by `npm run benchmark:import -- --pairs` from data/benchmark/trialbench/labels.json.";
  writeFileSync(PAIRS_PATH, jsonText({ note, pairs }));
  const count = (set: string, label?: string) =>
    pairs.filter((p) => p.set === set && (label === undefined || p.label === label)).length;
  console.log(
    `${pairs.length} pairs over ${new Set(pairs.map((p) => p.nctId)).size} trials and ${new Set(pairs.map((p) => p.patient)).size} vignettes: dev ${count("dev")} (${count("dev", "ineligible")} ineligible), held-out ${count("heldout")} (${count("heldout", "ineligible")} ineligible).`,
  );
}

function compare(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

main(process.argv.slice(2));
