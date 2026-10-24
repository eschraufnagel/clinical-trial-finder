import type { SourceSpan } from "../criteria/types.js";
import type { ModelRunMetadata } from "../models/types.js";

/**
 * The shared fact vocabulary (spec 0002 §2): facts about a person that many
 * trials ask about, each with a small closed set of answers. One answer then
 * settles every trial that depends on that fact.
 */

/** Who can usually answer: for wording later. It changes no status. */
export type WhoKnows = "patient" | "oncologist" | "records";

export interface FactAnswer {
  /** snake_case, unique within its fact. */
  id: string;
  /** How a person would say it. */
  words: string;
}

export interface Fact {
  /** snake_case, unique in the vocabulary. */
  id: string;
  /** The plain-language question. */
  question: string;
  /**
   * 2 to 6 answers. "Unknown" is never listed: it is the absence of an
   * answer, and it is always allowed.
   */
  answers: FactAnswer[];
  whoKnows: WhoKnows;
  /** "all", or cancer type ids from `data/cancer-types/`. */
  cancerTypes: "all" | string[];
}

export interface FactVocabulary {
  version: 1;
  facts: Fact[];
  /** Of the vocabulary file's bytes, so a mapping and a result name the vocabulary they used. */
  sha256: string;
}

/**
 * A trial's eligibility rules mapped onto the vocabulary (spec 0002 §3): for
 * each rule that maps, the fact and the answers that would make a person
 * ineligible under it. Rules that don't map aren't recorded here; they stay
 * in the trial's text for the stage-two screening agent.
 */
export interface FactMapping {
  factId: string;
  /** Answers that make the person ineligible under this rule. Never empty, never every answer. */
  rulesOut: string[];
  polarity: "inclusion" | "exclusion";
  /** Verbatim from the trial's text, located as the parser locates quotes. */
  source: SourceSpan;
  /** The scope as the trial words it, when the rule applies to part of the trial. */
  appliesTo?: string;
  /** Present when the quote matched only after allowing whitespace to differ. */
  loose?: true;
}

/** A mapping the model returned that didn't survive validation, kept for diagnosis. */
export interface RejectedMapping {
  reason: string;
  quote: string | null;
  raw: unknown;
}

export interface TrialFacts {
  nctId: string;
  mappings: FactMapping[];
  rejected: RejectedMapping[];
  run: ModelRunMetadata & {
    vocabularySha256: string;
    normalizeVersion: string;
    snapshotMonth: string;
    cancerType: string;
  };
}

/** Raised when a mapping can't be trusted as a whole: truncated or unreadable output. */
export class FactMappingError extends Error {
  readonly problems: readonly string[];

  constructor(context: string, problems: readonly string[]) {
    super(`${context}:\n${problems.map((p) => `  - ${p}`).join("\n")}`);
    this.name = "FactMappingError";
    this.problems = problems;
  }
}
