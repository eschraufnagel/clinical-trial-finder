/**
 * The deeper check (slice 0007): a picked trial's parsed rules, linked to the
 * facts the conversation settled, handed to the screening agent, and turned
 * into a record for the person and their oncologist. Nothing here builds a
 * model adapter; whoever starts a check passes one in.
 */
export { LINK_THRESHOLD, type LinkedFact, linkCriteria, overlap } from "./link.js";
