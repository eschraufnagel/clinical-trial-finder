import { readdirSync } from "node:fs";
import { readTrialFacts } from "../facts/run.js";
import type { TrialFacts } from "../facts/types.js";
import type { Point } from "../search/geo.js";
import { loadOthers } from "../search/other.js";
import { searchTrials } from "../search/search.js";
import type { SearchRequest } from "../search/types.js";
import { loadVocabulary } from "../search/vocabulary.js";
import type { Snapshot } from "../trials/snapshot-load.js";
import type { TrialInput } from "./select.js";

/**
 * The trials a conversation runs on: a search of the snapshot, with each
 * trial's mappings from a run (slice 0004). Moved here from
 * `scripts/questions-eval.ts`, so the page's server and the measurement
 * build them the same way and the server needn't import a script. Files
 * only: no model.
 */

/** A trial's mappings, or `undefined` when the run has none for it. */
export type TrialFactsLookup = (nctId: string) => TrialFacts | undefined;

/** What a conversation's search asks; the purpose is always treatment. */
export type ConversationSearch = Omit<SearchRequest, "purposes">;

/** A search, with each trial's mappings, or `null` where the run has none. */
export function trialsForSearch(
  request: ConversationSearch,
  snapshot: Snapshot,
  zips: ReadonlyMap<string, Point>,
  facts: TrialFactsLookup,
): TrialInput[] {
  const cancer = loadVocabulary(request.cancerType);
  const result = searchTrials(
    snapshot.trials,
    snapshot.manifest,
    cancer,
    zips,
    { ...request, purposes: ["TREATMENT"] },
    loadOthers(request.cancerType),
  );
  return result.candidates.map((candidate) => ({
    candidate,
    facts: facts(candidate.nctId) ?? null,
  }));
}

/** Every trial's mappings in a run, read once: for a server that runs many searches. */
export function loadAllTrialFacts(runDir: string): Map<string, TrialFacts> {
  const all = new Map<string, TrialFacts>();
  for (const name of readdirSync(runDir)) {
    const match = /^(NCT\d+)\.json$/.exec(name);
    const nctId = match?.[1];
    if (nctId === undefined) continue;
    const facts = readTrialFacts(runDir, nctId);
    if (facts !== undefined) all.set(nctId, facts);
  }
  return all;
}
