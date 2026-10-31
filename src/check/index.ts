/**
 * The deeper check (slice 0007): a picked trial's parsed rules, linked to the
 * facts the conversation settled, handed to the screening agent, and turned
 * into a record for the person and their oncologist. Nothing here builds a
 * model adapter; whoever starts a check passes one in.
 */
export { type ConversationAnswer, carriedFor } from "./carry.js";
export { LINK_THRESHOLD, type LinkedFact, linkCriteria, overlap } from "./link.js";
export {
  type CachedParse,
  CRITERIA_DATA_DIR,
  criteriaRunName,
  criteriaSha256,
  findParse,
  latestCriteriaRun,
  type ParseOutcome,
  parseCacheName,
  parseWithCache,
  readCachedParse,
} from "./parse-cache.js";
export {
  type RecordInput,
  type RecordLine,
  type RecordSection,
  recordFor,
  recordWithoutParse,
  type TrialRecord,
} from "./record.js";
export { type Check, type CheckInput, recordOf, startCheck } from "./run.js";
