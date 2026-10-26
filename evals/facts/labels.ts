import { createHash } from "node:crypto";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import type { FactVocabulary } from "../../src/facts/types.js";
import { factsFor } from "../../src/facts/vocabulary.js";

/**
 * Hand labels for slice 0002's measurement (spec 0002 §5): each trial's text
 * split into passages, each passage given the fact mappings a careful reader
 * would make, or a reason it maps to none. The convention is
 * `evals/cases/facts/ANNOTATION.md`.
 */

export const FACT_LABELS_DIR = fileURLToPath(new URL("../cases/facts", import.meta.url));

export type FactLabelSet = "dev" | "heldout";

export const UNMAPPED_CATEGORIES = [
  "organ-function",
  "procedure",
  "vocabulary-gap",
  "trial-specific",
  "not-a-rule",
] as const;
export type UnmappedCategory = (typeof UNMAPPED_CATEGORIES)[number];

export interface LabelMapping {
  factId: string;
  rulesOut: string[];
  /** The scope as the trial words it, or null for the whole trial. */
  appliesTo: string | null;
}

export interface LabelPassage {
  /** Exactly `criteriaText.slice(start, end)`. */
  quote: string;
  start: number;
  end: number;
  mappings: LabelMapping[];
  unmapped: UnmappedCategory | null;
  /** Required for `vocabulary-gap`; optional otherwise. */
  note?: string;
}

export interface FactLabels {
  nctId: string;
  set: FactLabelSet;
  criteriaTextSha: string;
  vocabularySha256: string;
  passages: LabelPassage[];
}

export class FactLabelError extends Error {
  constructor(where: string, problems: readonly string[]) {
    super(`Invalid fact labels ${where}:\n${problems.map((p) => `  - ${p}`).join("\n")}`);
    this.name = "FactLabelError";
  }
}

export function criteriaTextSha(text: string): string {
  return createHash("sha256").update(text).digest("hex");
}

/** A passage has been labelled once it has mappings or a category. */
export function isLabelled(passage: LabelPassage): boolean {
  return passage.mappings.length > 0 || passage.unmapped !== null;
}

export function isComplete(labels: FactLabels): boolean {
  return labels.passages.every(isLabelled);
}

/**
 * Every label file in `dir`, checked against the vocabulary and each trial's
 * text. Skeletons load too: completeness is a separate question, asked by
 * `isComplete`. Throws `FactLabelError` naming every problem in every file.
 */
export function loadFactLabels(
  dir: string,
  vocabulary: FactVocabulary,
  texts: ReadonlyMap<string, string>,
  cancerType = "nsclc",
): FactLabels[] {
  const files = readdirSync(dir)
    .filter((n) => /^NCT\d{8}\.json$/.test(n))
    .sort();
  const all: FactLabels[] = [];
  const problems: string[] = [];
  for (const file of files) {
    const labels = JSON.parse(readFileSync(join(dir, file), "utf8")) as FactLabels;
    for (const p of labelProblems(labels, vocabulary, texts, cancerType)) {
      problems.push(`${file}: ${p}`);
    }
    if (`${labels.nctId}.json` !== file) problems.push(`${file}: nctId is ${labels.nctId}`);
    all.push(labels);
  }
  if (problems.length > 0) throw new FactLabelError(dir, problems);
  return all;
}

/** The sha256 of every label file's bytes, in name order, so a result names its labels. */
export function factLabelsSha256(dir: string): string {
  const hash = createHash("sha256");
  for (const name of readdirSync(dir)
    .filter((n) => /^NCT\d{8}\.json$/.test(n))
    .sort()) {
    hash
      .update(name)
      .update("\n")
      .update(readFileSync(join(dir, name)));
  }
  return hash.digest("hex");
}

export function labelProblems(
  labels: FactLabels,
  vocabulary: FactVocabulary,
  texts: ReadonlyMap<string, string>,
  cancerType = "nsclc",
): string[] {
  const problems: string[] = [];
  if (labels.set !== "dev" && labels.set !== "heldout") problems.push("set is not dev or heldout");
  if (labels.vocabularySha256 !== vocabulary.sha256)
    problems.push("written against a different vocabulary");
  const text = texts.get(labels.nctId);
  if (text === undefined) {
    problems.push(`${labels.nctId} isn't in the snapshot`);
    return problems;
  }
  if (labels.criteriaTextSha !== criteriaTextSha(text))
    problems.push("the trial's eligibility text has changed since the skeleton was drawn");

  const facts = new Map(factsFor(vocabulary, cancerType).map((f) => [f.id, f]));
  labels.passages.forEach((passage, i) => {
    const at = `passage ${i + 1}`;
    if (text.slice(passage.start, passage.end) !== passage.quote)
      problems.push(`${at}: quote isn't the text at ${passage.start}-${passage.end}`);
    if (passage.mappings.length > 0 && passage.unmapped !== null)
      problems.push(`${at}: has both mappings and an unmapped category`);
    if (passage.unmapped !== null && !UNMAPPED_CATEGORIES.includes(passage.unmapped))
      problems.push(`${at}: unmapped category ${JSON.stringify(passage.unmapped)} isn't one`);
    if (passage.unmapped === "vocabulary-gap" && (passage.note ?? "").trim() === "")
      problems.push(`${at}: a vocabulary gap needs a note naming the missing fact`);
    for (const mapping of passage.mappings) {
      const fact = facts.get(mapping.factId);
      if (fact === undefined) {
        problems.push(`${at}: ${mapping.factId} isn't a fact for ${cancerType}`);
        continue;
      }
      const answers = new Set(fact.answers.map((a) => a.id));
      const unknown = mapping.rulesOut.filter((a) => !answers.has(a));
      if (unknown.length > 0)
        problems.push(`${at}: ${mapping.factId} has no answer ${unknown.join(", ")}`);
      if (mapping.rulesOut.length === 0)
        problems.push(`${at}: ${mapping.factId} rules out nothing`);
      if (new Set(mapping.rulesOut).size !== mapping.rulesOut.length)
        problems.push(`${at}: ${mapping.factId} repeats an answer`);
      if (mapping.rulesOut.length > 0 && answers.size === new Set(mapping.rulesOut).size)
        problems.push(`${at}: ${mapping.factId} rules out every answer`);
      if (mapping.appliesTo !== null && mapping.appliesTo.trim() === "")
        problems.push(`${at}: appliesTo is empty; use null for the whole trial`);
    }
  });
  return problems;
}
