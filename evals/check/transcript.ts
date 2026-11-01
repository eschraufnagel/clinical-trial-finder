import type { ConversationAnswer } from "../../src/check/carry.js";
import type { LinkedFact } from "../../src/check/link.js";
import type { TrialRecord } from "../../src/check/record.js";
import type { SourceSpan } from "../../src/criteria/types.js";
import type { ModelRunMetadata } from "../../src/models/types.js";
import type {
  Carried,
  Finding,
  IgnoredReading,
  RejectedReading,
  ScreeningCriterion,
  Turn,
} from "../../src/screening/types.js";
import type { FidelityFlag } from "../participant/fidelity.js";
import type { PatientSet } from "../questions/patients.js";

/**
 * Everything one pair's check produced, as plain JSON (spec 0007 §7.3). One
 * file per pair, committed beside the result, so `check:eval -- --check`
 * regrades a result from its transcripts with no model.
 */

export interface ParticipantTurn {
  /** Transcript index of the participant's reply. */
  turn: number;
  usedFacts: string[];
  flags: FidelityFlag[];
}

export interface PairTranscript {
  patient: string;
  nctId: string;
  set: PatientSet;
  rank: number;
  /** The conversation's answers, by fact id, in the order asked. */
  conversation: Record<string, ConversationAnswer>;
  /** "parsed" when the check ran; "missing" when the run has no parse for the trial. */
  parse: "parsed" | "missing";
  criteria: ScreeningCriterion[];
  /** Each criterion's (or, with no parse, each mapping line's) passage in the trial's text. */
  sources: Record<string, SourceSpan>;
  links: Record<string, LinkedFact[]>;
  carried: Carried;
  findings: Finding[];
  transcript: Turn[];
  rejectedReadings: RejectedReading[];
  ignoredReadings: IgnoredReading[];
  replies: ParticipantTurn[];
  record: TrialRecord;
  /** The patient's order before and after the check: it must not move. */
  orderBefore: string[];
  orderAfter: string[];
  calls: { agent: number; participant: number; fidelity: number };
  run: ModelRunMetadata | null;
  /** Why the check stopped early, when it did. */
  error?: string;
}
