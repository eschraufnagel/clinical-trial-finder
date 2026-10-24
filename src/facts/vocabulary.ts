import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import type { Fact, FactVocabulary } from "./types.js";

/**
 * Loads `data/facts/vocabulary.json` (spec 0002 §2.1), checking every rule
 * and reporting every problem at once.
 *
 * Imports no model, so the labelling tools and the status function may use
 * it (`tests/boundary.test.ts`).
 */

export const DEFAULT_FACT_VOCABULARY = fileURLToPath(
  new URL("../../data/facts/vocabulary.json", import.meta.url),
);

const ID = /^[a-z][a-z0-9]*(?:_[a-z0-9]+)*$/;
const WHO_KNOWS = new Set(["patient", "oncologist", "records"]);

export class FactVocabularyError extends Error {
  constructor(path: string, problems: readonly string[]) {
    super(`Invalid fact vocabulary ${path}:\n${problems.map((p) => `  - ${p}`).join("\n")}`);
    this.name = "FactVocabularyError";
  }
}

export function loadFactVocabulary(path: string = DEFAULT_FACT_VOCABULARY): FactVocabulary {
  let bytes: Buffer;
  try {
    bytes = readFileSync(path);
  } catch {
    throw new FactVocabularyError(path, ["the file can't be read"]);
  }
  let value: unknown;
  try {
    value = JSON.parse(bytes.toString("utf8"));
  } catch {
    throw new FactVocabularyError(path, ["not JSON"]);
  }
  const problems = vocabularyProblems(value);
  if (problems.length > 0) throw new FactVocabularyError(path, problems);
  const { version, facts } = value as Omit<FactVocabulary, "sha256">;
  return { version, facts, sha256: createHash("sha256").update(bytes).digest("hex") };
}

/** The facts that apply to a cancer type: its own and the shared ones. */
export function factsFor(vocabulary: FactVocabulary, cancerType: string): Fact[] {
  return vocabulary.facts.filter(
    (f) => f.cancerTypes === "all" || f.cancerTypes.includes(cancerType),
  );
}

function vocabularyProblems(value: unknown): string[] {
  if (!isRecord(value)) return ["not a JSON object"];
  const problems: string[] = [];
  if (value["version"] !== 1) problems.push("version is not 1");
  const facts = value["facts"];
  if (!Array.isArray(facts) || facts.length === 0) {
    problems.push("facts is not a non-empty list");
    return problems;
  }
  const seen = new Set<string>();
  facts.forEach((fact: unknown, i) => {
    if (!isRecord(fact)) {
      problems.push(`fact ${i + 1} is not an object`);
      return;
    }
    const id = fact["id"];
    const name = typeof id === "string" ? id : `fact ${i + 1}`;
    if (typeof id !== "string" || !ID.test(id)) problems.push(`${name}: id is not snake_case`);
    else if (seen.has(id)) problems.push(`${name}: id is repeated`);
    else seen.add(id);
    if (typeof fact["question"] !== "string" || fact["question"].trim() === "")
      problems.push(`${name}: question is missing`);
    if (typeof fact["whoKnows"] !== "string" || !WHO_KNOWS.has(fact["whoKnows"]))
      problems.push(`${name}: whoKnows is not patient, oncologist or records`);
    const types = fact["cancerTypes"];
    if (
      types !== "all" &&
      !(
        Array.isArray(types) &&
        types.length > 0 &&
        types.every((t) => typeof t === "string" && t !== "")
      )
    )
      problems.push(`${name}: cancerTypes is not "all" or a list of cancer type ids`);
    problems.push(...answerProblems(name, fact["answers"]));
  });
  return problems;
}

function answerProblems(name: string, answers: unknown): string[] {
  if (!Array.isArray(answers) || answers.length < 2 || answers.length > 6) {
    return [`${name}: answers is not a list of 2 to 6`];
  }
  const problems: string[] = [];
  const seen = new Set<string>();
  answers.forEach((answer: unknown, i) => {
    const id = isRecord(answer) ? answer["id"] : undefined;
    if (typeof id !== "string" || !ID.test(id)) {
      problems.push(`${name}: answer ${i + 1}'s id is not snake_case`);
    } else if (id === "unknown") {
      problems.push(
        `${name}: "unknown" is listed as an answer; it is always allowed, never listed`,
      );
    } else if (seen.has(id)) {
      problems.push(`${name}: answer ${id} is repeated`);
    } else {
      seen.add(id);
    }
    const words = isRecord(answer) ? answer["words"] : undefined;
    if (typeof words !== "string" || words.trim() === "")
      problems.push(`${name}: answer ${i + 1} has no words`);
  });
  return problems;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export const DEFAULT_TRUSTED_FACTS = fileURLToPath(
  new URL("../../data/facts/trusted.json", import.meta.url),
);

/**
 * The facts whose mappings may rule a trial out (0002 Gate 2). A mapping on
 * any other fact is shown, but counts as unknown: the dev runs found the
 * model reliable on these facts only. Kept beside the vocabulary rather than
 * in it, so labels and runs keep naming the vocabulary they used.
 */
export function loadTrustedFacts(
  vocabulary: FactVocabulary,
  path: string = DEFAULT_TRUSTED_FACTS,
): ReadonlySet<string> {
  let value: unknown;
  try {
    value = JSON.parse(readFileSync(path, "utf8"));
  } catch {
    throw new FactVocabularyError(path, ["the file can't be read as JSON"]);
  }
  const facts = isRecord(value) ? value["facts"] : undefined;
  if (!Array.isArray(facts) || !facts.every((f) => typeof f === "string")) {
    throw new FactVocabularyError(path, ["facts is not a list of fact ids"]);
  }
  const known = new Set(vocabulary.facts.map((f) => f.id));
  const unknown = facts.filter((f) => !known.has(f));
  if (unknown.length > 0) {
    throw new FactVocabularyError(
      path,
      unknown.map((f) => `${f} isn't a fact`),
    );
  }
  return new Set(facts);
}
