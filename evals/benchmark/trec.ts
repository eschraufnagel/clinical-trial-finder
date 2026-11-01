import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { gunzipSync, gzipSync } from "node:zlib";
import type { SnapshotTrial } from "../../src/trials/snapshot-types.js";
import { BENCHMARK_DATA_DIR, TREC_CORPUS_PARTS } from "./sources.js";
import { readTrecTrial } from "./trec-xml.js";

/**
 * TREC's nine cancer notes, their judgments and their judged trials (spec
 * 0008 §2.3, §3). 2021 and 2022 both have a topic 11, so a note is named by
 * year and number together, as `2022-11`.
 */

export const TREC_DIR = join(BENCHMARK_DATA_DIR, "trec");
export const TREC_TOPICS_PATH = join(TREC_DIR, "topics.json");
export const TREC_QRELS_PATH = join(TREC_DIR, "qrels.json");
export const TREC_TRIALS_PATH = join(TREC_DIR, "trials.jsonl.gz");
export const TREC_PROFILES_PATH = join(TREC_DIR, "profiles.json");

export type TrecYear = "2021" | "2022";

/** The notes about a cancer under treatment (spec §3.1). The only place the count is set. */
export const TREC_TOPICS: readonly { year: TrecYear; number: number }[] = [
  { year: "2021", number: 1 },
  { year: "2021", number: 4 },
  { year: "2021", number: 11 },
  { year: "2021", number: 15 },
  { year: "2021", number: 17 },
  { year: "2021", number: 25 },
  { year: "2021", number: 31 },
  { year: "2021", number: 61 },
  { year: "2022", number: 11 },
];

export const topicKey = (year: TrecYear, number: number) => `${year}-${number}`;
const SELECTED = new Set(TREC_TOPICS.map((t) => topicKey(t.year, t.number)));

export interface TrecTopic {
  year: TrecYear;
  number: number;
  /** Verbatim, as the topics file gives it. */
  text: string;
}

/** 0 not relevant, 1 excluded, 2 eligible, as TREC judges. */
export type Judgment = 0 | 1 | 2;

export interface TrecJudgment {
  topic: string;
  nctId: string;
  judgment: Judgment;
}

/** Every topic in one year's topics file. */
export function readTopics(xml: string, year: TrecYear): TrecTopic[] {
  return [...xml.matchAll(/<topic number="(\d+)">([\s\S]*?)<\/topic>/g)].map((m) => ({
    year,
    number: Number(m[1]),
    text: m[2] ?? "",
  }));
}

/** Every judgment in one year's qrels file: "topic 0 NCT judgment" per line. */
export function readQrels(text: string, year: TrecYear): TrecJudgment[] {
  return text
    .split("\n")
    .filter((line) => line.trim() !== "")
    .map((line) => {
      const [topic, , nctId, judgment] = line.trim().split(/\s+/);
      const value = Number(judgment);
      if (topic === undefined || nctId === undefined || ![0, 1, 2].includes(value)) {
        throw new Error(`An unreadable qrels line in ${year}: "${line}".`);
      }
      return { topic: topicKey(year, Number(topic)), nctId, judgment: value as Judgment };
    });
}

export const isSelected = (topic: string) => SELECTED.has(topic);

/** The corpus file for a trial: `corpus/ClinicalTrials.2021-04-27.partN/NCT0003xxxx/NCT00032383.xml`. */
export function corpusPath(corpusDir: string, nctId: string): string {
  const folder = `${nctId.slice(0, 7)}xxxx`;
  for (const part of TREC_CORPUS_PARTS) {
    const path = join(corpusDir, `ClinicalTrials.2021-04-27.part${part}`, folder, `${nctId}.xml`);
    if (existsSync(path)) return path;
  }
  throw new Error(`${nctId} isn't in the TREC corpus at ${corpusDir}.`);
}

export function readCorpusTrial(corpusDir: string, nctId: string): SnapshotTrial {
  return readTrecTrial(readFileSync(corpusPath(corpusDir, nctId), "utf8"));
}

/** Trials as gzipped JSON lines, sorted by NCT ID, so the same trials give the same bytes. */
export function trialsGz<T extends { nctId: string }>(trials: readonly T[]): Buffer {
  const sorted = [...trials].sort((a, b) => (a.nctId < b.nctId ? -1 : a.nctId > b.nctId ? 1 : 0));
  const text = sorted.map((t) => `${JSON.stringify(t)}\n`).join("");
  return gzipSync(Buffer.from(text, "utf8"), { level: 9 });
}

export function readTrialsGz<T>(path: string): T[] {
  return gunzipSync(readFileSync(path))
    .toString("utf8")
    .split("\n")
    .filter((line) => line !== "")
    .map((line) => JSON.parse(line) as T);
}

export interface TrecTopicsFile {
  source: string;
  topics: TrecTopic[];
}

export interface TrecQrelsFile {
  source: string;
  judgments: TrecJudgment[];
}

export interface TrecProfile {
  year: TrecYear;
  number: number;
  cancerType: string;
  age: number;
  sex: "female" | "male";
}

export interface TrecData {
  topics: TrecTopic[];
  judgments: TrecJudgment[];
  trials: SnapshotTrial[];
}

/** The committed TREC files, checked against each other. */
export function loadTrec(dir = TREC_DIR): TrecData {
  const topics = (JSON.parse(readFileSync(join(dir, "topics.json"), "utf8")) as TrecTopicsFile)
    .topics;
  const judgments = (JSON.parse(readFileSync(join(dir, "qrels.json"), "utf8")) as TrecQrelsFile)
    .judgments;
  const trials = readTrialsGz<SnapshotTrial>(join(dir, "trials.jsonl.gz"));
  const problems = trecProblems({ topics, judgments, trials });
  if (problems.length > 0) throw new Error(`The TREC files don't agree:\n${problems.join("\n")}`);
  return { topics, judgments, trials };
}

export function trecProblems(data: TrecData): string[] {
  const problems: string[] = [];
  const keys = new Set(data.topics.map((t) => topicKey(t.year, t.number)));
  for (const key of SELECTED) if (!keys.has(key)) problems.push(`Note ${key} is missing.`);
  for (const key of keys)
    if (!SELECTED.has(key)) problems.push(`Note ${key} isn't one of the nine.`);
  const ids = new Set(data.trials.map((t) => t.nctId));
  for (const j of data.judgments) {
    if (!SELECTED.has(j.topic)) problems.push(`A judgment is for note ${j.topic}.`);
    if (!ids.has(j.nctId)) problems.push(`${j.nctId}, judged for ${j.topic}, has no trial.`);
  }
  return problems;
}

export function readTrecProfiles(path = TREC_PROFILES_PATH): TrecProfile[] {
  return (JSON.parse(readFileSync(path, "utf8")) as { profiles: TrecProfile[] }).profiles;
}
