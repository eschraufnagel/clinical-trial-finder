import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import type { FactVocabulary } from "../facts/types.js";
import { factsFor } from "../facts/vocabulary.js";

/**
 * How the conversation runs (spec 0003 §3): the intake, the facts never asked
 * of one sex, the short list's size, the question budget and the scorer.
 * Its own file, because changing `data/facts/vocabulary.json` changes its
 * hash and orphans the mapping run.
 */

export const DEFAULT_SETTINGS_FILE = fileURLToPath(
  new URL("../../data/questions/conversation.json", import.meta.url),
);

export const SCORERS = ["fixed", "count", "shortlist"] as const;
export type ScorerName = (typeof SCORERS)[number];

export interface SkipRule {
  factId: string;
  /** The fact is never asked when the search's sex is this. Not asked is not answered. */
  sex: "female" | "male";
}

export interface ConversationSettings {
  version: 1;
  /** Always asked first, in this order. */
  intake: string[];
  skip: SkipRule[];
  shortlistSize: number;
  /** The most follow-up questions after the intake. */
  budget: number;
  scorer: ScorerName;
  /** Of the file's bytes, recorded on every result. */
  sha256: string;
}

export class ConversationSettingsError extends Error {
  constructor(where: string, problems: readonly string[]) {
    super(`Invalid conversation settings ${where}:\n${problems.map((p) => `  - ${p}`).join("\n")}`);
    this.name = "ConversationSettingsError";
  }
}

/** Throws `ConversationSettingsError` naming every problem. */
export function loadConversationSettings(
  vocabulary: FactVocabulary,
  path: string = DEFAULT_SETTINGS_FILE,
  cancerType = "nsclc",
): ConversationSettings {
  const bytes = readFileSync(path);
  let value: unknown;
  try {
    value = JSON.parse(bytes.toString("utf8"));
  } catch (error) {
    throw new ConversationSettingsError(path, [
      error instanceof Error ? error.message : String(error),
    ]);
  }
  const problems = settingsProblems(value, vocabulary, cancerType);
  if (problems.length > 0) throw new ConversationSettingsError(path, problems);
  const { version, intake, skip, shortlistSize, budget, scorer } = value as Omit<
    ConversationSettings,
    "sha256"
  >;
  return {
    version,
    intake,
    skip,
    shortlistSize,
    budget,
    scorer,
    sha256: createHash("sha256").update(bytes).digest("hex"),
  };
}

export function settingsProblems(
  value: unknown,
  vocabulary: FactVocabulary,
  cancerType: string,
): string[] {
  if (typeof value !== "object" || value === null || Array.isArray(value))
    return ["not a JSON object"];
  const v = value as Record<string, unknown>;
  const problems: string[] = [];
  const all = new Set(vocabulary.facts.map((f) => f.id));
  const applies = new Set(factsFor(vocabulary, cancerType).map((f) => f.id));
  if (v["version"] !== 1) problems.push("version is not 1");

  const intake = v["intake"];
  if (!Array.isArray(intake) || intake.length === 0)
    problems.push("intake is not a non-empty list");
  else {
    const seen = new Set<string>();
    for (const factId of intake) {
      if (typeof factId !== "string" || !all.has(factId))
        problems.push(`intake: ${String(factId)} isn't a fact`);
      else if (!applies.has(factId))
        problems.push(`intake: ${factId} isn't a fact for ${cancerType}`);
      if (seen.has(String(factId))) problems.push(`intake lists ${String(factId)} twice`);
      seen.add(String(factId));
    }
  }

  const skip = v["skip"];
  if (!Array.isArray(skip)) problems.push("skip is not a list");
  else {
    for (const rule of skip) {
      const r = (typeof rule === "object" && rule !== null ? rule : {}) as Record<string, unknown>;
      if (typeof r["factId"] !== "string" || !all.has(r["factId"]))
        problems.push(`skip: ${String(r["factId"])} isn't a fact`);
      if (r["sex"] !== "female" && r["sex"] !== "male")
        problems.push(`skip: sex ${String(r["sex"])} is not female or male`);
    }
  }

  for (const key of ["shortlistSize", "budget"] as const) {
    const n = v[key];
    if (!(typeof n === "number" && Number.isInteger(n) && n >= 1))
      problems.push(`${key} is not a whole number of at least 1`);
  }
  if (!SCORERS.includes(v["scorer"] as ScorerName))
    problems.push(`scorer ${String(v["scorer"])} is not one of ${SCORERS.join(", ")}`);
  return problems;
}
