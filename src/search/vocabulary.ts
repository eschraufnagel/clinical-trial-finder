import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import type { SnapshotTrial } from "../trials/snapshot-types.js";
import { containsTerm, normalizeText } from "./normalize.js";

/**
 * The words that put a trial in scope for a cancer type (spec 0001 §4), as
 * data under `data/cancer-types/`: one file per type, plus one shared list of
 * terms for trials open to many cancers.
 *
 * Amended in plan (step 9): the generic list has two parts. Multi-word
 * terms such as "solid tumor" match inside a condition. Single words such as
 * "cancer" match only a whole condition, because "cancer" inside "breast
 * cancer" would make every trial generic.
 */

export const DEFAULT_VOCABULARY_DIR = fileURLToPath(
  new URL("../../data/cancer-types", import.meta.url),
);

export interface CancerType {
  id: string;
  label: string;
  /** True only once a committed held-out result covers this type. */
  measured: boolean;
  /** Terms that name it, matched in conditions, keywords, titles and, for `rules`, eligibility text. */
  names: string[];
  /** MeSH headings that name it, matched exactly against a trial's condition MeSH terms. */
  meshHeadings: string[];
  /** Biomarkers typical of it, matched in conditions and keywords. */
  biomarkerNames: string[];
}

export interface GenericTerms {
  /** Matched anywhere inside a condition: "advanced solid tumors" contains "solid tumors". */
  containedTerms: string[];
  /** Matched only when they are the whole condition: "Cancer", not "Breast Cancer". */
  wholeConditions: string[];
}

export interface Vocabulary {
  type: CancerType;
  generic: GenericTerms;
  /** Of the type's file and the generic file, in that order, so a result names its vocabulary. */
  sha256: string;
}

export type Reason = "names" | "rules" | "generic";

export class VocabularyError extends Error {
  constructor(path: string, problems: readonly string[]) {
    super(`Invalid vocabulary ${path}:\n${problems.map((p) => `  - ${p}`).join("\n")}`);
    this.name = "VocabularyError";
  }
}

export function loadVocabulary(id: string, dir: string = DEFAULT_VOCABULARY_DIR): Vocabulary {
  if (!/^[a-z0-9-]+$/.test(id)) {
    throw new VocabularyError(id, [`${JSON.stringify(id)} isn't a cancer type id`]);
  }
  const typePath = join(dir, `${id}.json`);
  const genericPath = join(dir, "generic.json");
  const typeBytes = read(typePath, `No cancer type "${id}" in ${dir}.`);
  const genericBytes = read(genericPath, `No generic.json in ${dir}.`);
  const type = validateType(parse(typeBytes, typePath), typePath, id);
  const generic = validateGeneric(parse(genericBytes, genericPath), genericPath);
  const sha256 = createHash("sha256")
    .update(typeBytes)
    .update("\n")
    .update(genericBytes)
    .digest("hex");
  return { type, generic, sha256 };
}

/**
 * Why a trial is in scope for the type, or an empty list. Reasons come in a
 * fixed order (names, rules, generic), and a trial can have several.
 */
export function reasonsFor(trial: SnapshotTrial, vocabulary: Vocabulary): Reason[] {
  const { type, generic } = vocabulary;
  const reasons: Reason[] = [];

  const named = [
    ...trial.conditions,
    ...trial.keywords,
    trial.briefTitle,
    trial.officialTitle ?? "",
  ].map(normalizeText);
  const tagged = [...trial.conditions, ...trial.keywords].map(normalizeText);
  const mesh = new Set(trial.conditionMesh);
  if (
    named.some((field) => type.names.some((term) => containsTerm(field, term))) ||
    type.meshHeadings.some((heading) => mesh.has(heading)) ||
    tagged.some((field) => type.biomarkerNames.some((term) => containsTerm(field, term)))
  ) {
    reasons.push("names");
  }

  const rules = normalizeText(trial.eligibility.criteriaText);
  if (type.names.some((term) => containsTerm(rules, term))) {
    reasons.push("rules");
  }

  const conditions = trial.conditions.map(normalizeText);
  const whole = new Set(generic.wholeConditions.map(normalizeText));
  if (
    conditions.some(
      (condition) =>
        whole.has(condition) ||
        generic.containedTerms.some((term) => containsTerm(condition, term)),
    )
  ) {
    reasons.push("generic");
  }

  return reasons;
}

function read(path: string, missing: string): Buffer {
  try {
    return readFileSync(path);
  } catch {
    throw new VocabularyError(path, [missing]);
  }
}

function parse(bytes: Buffer, path: string): Record<string, unknown> {
  try {
    const value: unknown = JSON.parse(bytes.toString("utf8"));
    if (typeof value === "object" && value !== null && !Array.isArray(value)) {
      return value as Record<string, unknown>;
    }
  } catch {
    // reported below
  }
  throw new VocabularyError(path, ["not a JSON object"]);
}

function validateType(record: Record<string, unknown>, path: string, id: string): CancerType {
  const problems: string[] = [];
  if (record["id"] !== id) problems.push(`id is ${JSON.stringify(record["id"])}, not "${id}"`);
  if (typeof record["label"] !== "string" || record["label"] === "")
    problems.push("label is missing");
  if (typeof record["measured"] !== "boolean") problems.push("measured is not true or false");
  for (const field of ["names", "meshHeadings", "biomarkerNames"]) {
    checkTerms(record[field], field, problems, field !== "meshHeadings");
  }
  if (problems.length > 0) throw new VocabularyError(path, problems);
  return record as unknown as CancerType;
}

function validateGeneric(record: Record<string, unknown>, path: string): GenericTerms {
  const problems: string[] = [];
  checkTerms(record["containedTerms"], "containedTerms", problems, true);
  checkTerms(record["wholeConditions"], "wholeConditions", problems, true);
  if (problems.length > 0) throw new VocabularyError(path, problems);
  return record as unknown as GenericTerms;
}

/** A list of strings, none empty once normalized, none repeated. MeSH headings are compared verbatim. */
function checkTerms(value: unknown, field: string, problems: string[], normalized: boolean): void {
  if (!Array.isArray(value) || !value.every((item) => typeof item === "string")) {
    problems.push(`${field} is not a list of strings`);
    return;
  }
  const seen = new Set<string>();
  for (const term of value as string[]) {
    const key = normalized ? normalizeText(term) : term;
    if (key.trim() === "") {
      problems.push(`${field} has a term with no words: ${JSON.stringify(term)}`);
    } else if (seen.has(key)) {
      problems.push(`${field} repeats ${JSON.stringify(term)}`);
    }
    seen.add(key);
  }
}
