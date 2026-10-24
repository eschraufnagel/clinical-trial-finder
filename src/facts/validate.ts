import type { Fact, RejectedMapping } from "./types.js";
import { FactMappingError } from "./types.js";

/**
 * Reads what the mapping model returned, treating all of it as untrusted
 * (spec 0002 §3.2), in the style of `src/criteria/validate.ts`: every problem
 * collected, nothing coerced to a default, and the offending value kept.
 * Quotes are located afterwards, in `map.ts`.
 */

const POLARITIES: readonly string[] = ["inclusion", "exclusion"];

/** One mapping as the model returned it, after shape and vocabulary checks. */
export interface RawMapping {
  factId: string;
  rulesOut: string[];
  polarity: "inclusion" | "exclusion";
  quote: string;
  appliesTo: string | null;
}

export function readMappingEnvelope(
  content: unknown,
  facts: readonly Fact[],
  context: string,
): { valid: RawMapping[]; rejected: RejectedMapping[] } {
  if (typeof content !== "object" || content === null || Array.isArray(content)) {
    throw new FactMappingError(context, ["the response is not a JSON object"]);
  }
  const mappings = (content as Record<string, unknown>)["mappings"];
  if (!Array.isArray(mappings)) {
    throw new FactMappingError(context, ['the response has no "mappings" list']);
  }
  const byId = new Map(facts.map((f) => [f.id, f]));
  const valid: RawMapping[] = [];
  const rejected: RejectedMapping[] = [];
  for (const raw of mappings) {
    const problem = mappingProblem(raw, byId);
    const quote =
      typeof raw === "object" && raw !== null && typeof raw.quote === "string" ? raw.quote : null;
    if (problem === undefined) valid.push(normalizeMapping(raw as RawMapping));
    else rejected.push({ reason: problem, quote, raw });
  }
  return { valid, rejected };
}

function mappingProblem(raw: unknown, facts: ReadonlyMap<string, Fact>): string | undefined {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) return "not an object";
  const m = raw as Record<string, unknown>;
  if (typeof m["factId"] !== "string") return "factId is missing";
  const fact = facts.get(m["factId"]);
  if (fact === undefined) return `${m["factId"]} isn't a fact for this trial's cancer type`;
  const rulesOut = m["rulesOut"];
  if (!Array.isArray(rulesOut) || !rulesOut.every((a) => typeof a === "string"))
    return "rulesOut is not a list of answer ids";
  if (rulesOut.length === 0) return "rulesOut is empty";
  const answers = new Set(fact.answers.map((a) => a.id));
  const unknown = rulesOut.filter((a) => !answers.has(a));
  if (unknown.length > 0) return `${fact.id} has no answer ${unknown.join(", ")}`;
  if (new Set(rulesOut).size >= answers.size) return `rules out every answer of ${fact.id}`;
  if (typeof m["polarity"] !== "string" || !POLARITIES.includes(m["polarity"]))
    return "polarity is not inclusion or exclusion";
  if (typeof m["quote"] !== "string" || m["quote"].trim() === "") return "quote is missing";
  const appliesTo = m["appliesTo"];
  if (appliesTo !== null && appliesTo !== undefined && typeof appliesTo !== "string")
    return "appliesTo is not text or null";
  return undefined;
}

function normalizeMapping(raw: RawMapping & { appliesTo?: string | null }): RawMapping {
  const appliesTo =
    typeof raw.appliesTo === "string" && raw.appliesTo.trim() !== "" ? raw.appliesTo.trim() : null;
  return {
    factId: raw.factId,
    rulesOut: [...new Set(raw.rulesOut)],
    polarity: raw.polarity,
    quote: raw.quote,
    appliesTo,
  };
}
