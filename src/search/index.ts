/**
 * Public surface of the search module (slice 0001): no model, no network,
 * no clock. `tests/boundary.test.ts` walks the graph reachable from here.
 */
export {
  DEFAULT_ZIP_FILE,
  loadZipPoints,
  milesBetween,
  type Point,
  pointForZip,
  UnknownZipError,
} from "./geo.js";
export { parseAgeLimit, recordFlags, searchTrials } from "./search.js";
export type {
  Candidate,
  Flag,
  FunnelStage,
  NearestSite,
  SearchRequest,
  SearchResult,
} from "./types.js";
export {
  type CancerType,
  DEFAULT_VOCABULARY_DIR,
  type GenericTerms,
  loadVocabulary,
  type Reason,
  reasonsFor,
  type Vocabulary,
  VocabularyError,
} from "./vocabulary.js";
