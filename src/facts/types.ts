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
