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
export {
  inclusionSection,
  loadOthers,
  markFor,
  type OtherCancer,
  type OtherMark,
  type OtherRoute,
  type Others,
  ROUTES,
  routesFor,
} from "./other.js";
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
