import type { Profile } from "../../src/facts/status.js";
import type { FactVocabulary } from "../../src/facts/types.js";
import { factsFor } from "../../src/facts/vocabulary.js";
import {
  type ConversationResult,
  openQuestions,
  orderFor,
  runConversation,
} from "../../src/questions/conversation.js";
import { type TrialInput, UNKNOWN } from "../../src/questions/select.js";
import {
  type ConversationSettings,
  SCORERS,
  type ScorerName,
  skippedFacts,
} from "../../src/questions/settings.js";
import type { OrderEntry } from "../../src/shortlist/order.js";
import { shortlistOf } from "../../src/shortlist/order.js";
import {
  type ArmName,
  type ArmRow,
  agreement,
  CURVE_LENGTH,
  type CurvePoint,
  median,
  wouldFlag,
} from "./metrics.js";
import type { Patient, PatientSet } from "./patients.js";

/**
 * The arms of slice 0003's measurement (spec 0003 §6.1), for one patient,
 * from their search's trials. Deterministic: the patient's answers come from
 * their record and what they know, or from cached readings of their replies.
 */

/** What the person answers when asked a fact: an answer id, or `UNKNOWN`. */
export type AnswerSource = (patient: Patient, factId: string) => string;

/** The record's answer when the patient knows it; unknown otherwise. */
export const fromKnowledge: AnswerSource = (patient, factId) =>
  patient.knows.includes(factId) ? (patient.record[factId] ?? UNKNOWN) : UNKNOWN;

/** The record's answer whenever it has one: a patient who knows everything their record holds. */
export const fromRecord: AnswerSource = (patient, factId) => patient.record[factId] ?? UNKNOWN;

export interface ArmOptions {
  answer?: AnswerSource;
  /** The from-the-start arm, run on dev only. */
  fromStart?: boolean;
}

export function armsFor(
  patient: Patient,
  set: PatientSet,
  trials: readonly TrialInput[],
  vocabulary: FactVocabulary,
  settings: ConversationSettings,
  options: ArmOptions = {},
): ArmRow[] {
  const answer = options.answer ?? fromKnowledge;
  const cancerType = patient.search.cancerType;
  const size = settings.shortlistSize;
  const skipped = skippedFacts(settings, patient.search.sex);
  const ids = (entries: readonly OrderEntry[]) => entries.map((e) => e.candidate.nctId);

  const recordProfile: Record<string, string> = {};
  for (const fact of factsFor(vocabulary, cancerType)) {
    const value = patient.record[fact.id];
    if (value != null) recordProfile[fact.id] = value;
  }
  const recordOrder = orderFor(trials, recordProfile, vocabulary, settings.order);
  const recordList = ids(shortlistOf(recordOrder, size));
  const flagged = new Set(
    recordOrder.filter((e) => (e.status?.hints.length ?? 0) > 0).map((e) => e.candidate.nctId),
  );
  const noAnswerList = ids(shortlistOf(orderFor(trials, {}, vocabulary, settings.order), size));
  const mappings = new Map(trials.map((t) => [t.candidate.nctId, t.facts?.mappings.length ?? 0]));
  const meanMappings = (list: readonly string[]): number | null =>
    list.length === 0 ? null : list.reduce((n, id) => n + (mappings.get(id) ?? 0), 0) / list.length;
  const candidateMappings = meanMappings(trials.map((t) => t.candidate.nctId));
  const unmapped = new Set(
    trials
      .filter((t) => t.facts === null || t.facts.mappings.length === 0)
      .map((t) => t.candidate.nctId),
  );

  const curveOf = (result: ConversationResult): CurvePoint[] => {
    const lists: string[][] = [];
    const followUps = result.steps.filter((s) => s.phase === "follow-up");
    const intakeEnd = followUps[0]?.before ?? ids(shortlistOf(result.order, size));
    lists.push(intakeEnd);
    for (let k = 1; k <= CURVE_LENGTH; k++) {
      lists.push(followUps[k - 1]?.after ?? lists[k - 1] ?? intakeEnd);
    }
    return lists.map((list) => ({
      agreement: agreement(list, recordList),
      wouldFlag: wouldFlag(list, flagged),
    }));
  };

  const rowOf = (
    arm: ArmName,
    scorer: ScorerName | null,
    profile: Profile,
    order: readonly OrderEntry[],
    result: ConversationResult | null,
    curve: CurvePoint[] | null,
  ): ArmRow => {
    const shortlist = shortlistOf(order, size);
    const list = ids(shortlist);
    const byId = new Map(order.map((e) => [e.candidate.nctId, e]));
    const pushed = noAnswerList.filter((id) => !list.includes(id));
    const followUps = result?.steps.filter((s) => s.phase === "follow-up") ?? [];
    return {
      patient: patient.id,
      set,
      arm,
      scorer,
      candidates: trials.length,
      asked: result?.steps.map((s) => ({ factId: s.factId, reply: s.reply })) ?? [],
      followUps: followUps.length,
      dontKnows: followUps.filter((s) => s.reply === UNKNOWN).length,
      stop: result?.stop ?? null,
      shortlist: list,
      agreement: agreement(list, recordList),
      wouldFlag: wouldFlag(list, flagged),
      pushedDown: pushed.length,
      pushedDownHints: pushed.reduce((n, id) => {
        const status = byId.get(id)?.status;
        return n + (status?.hints.length ?? 0) + (status?.partHints.length ?? 0);
      }, 0),
      noMappingPlaces: list.filter((id) => unmapped.has(id)).length,
      openQuestions: openQuestions(shortlist, profile, vocabulary, skipped).length,
      shortlistMappings: meanMappings(list),
      candidateMappings,
      medianMiles: median(
        shortlist.flatMap((e) => {
          const miles = e.candidate.nearestSite?.miles;
          return miles === null || miles === undefined ? [] : [miles];
        }),
      ),
      curve,
    };
  };

  const converse = (scorer: ScorerName, source: AnswerSource, budget: number, intake = true) =>
    runConversation({
      trials,
      vocabulary,
      settings,
      cancerType,
      sex: patient.search.sex,
      answer: (factId) => source(patient, factId),
      scorer,
      budget,
      intake,
    });

  const rows: ArmRow[] = [];
  const intakeOnly = converse(settings.scorer, answer, 0);
  rows.push(rowOf("record", null, recordProfile, recordOrder, null, null));
  rows.push(rowOf("intake", null, intakeOnly.profile, intakeOnly.order, intakeOnly, null));
  for (const scorer of SCORERS) {
    const result = converse(scorer, answer, settings.budget);
    const curve = curveOf(converse(scorer, answer, CURVE_LENGTH));
    rows.push(rowOf("conversation", scorer, result.profile, result.order, result, curve));
  }
  for (const scorer of SCORERS) {
    const result = converse(scorer, fromRecord, settings.budget);
    const curve = curveOf(converse(scorer, fromRecord, CURVE_LENGTH));
    rows.push(rowOf("knows-all", scorer, result.profile, result.order, result, curve));
  }
  if (options.fromStart === true) {
    for (const scorer of SCORERS) {
      const result = converse(scorer, answer, settings.budget, false);
      rows.push(rowOf("from-start", scorer, result.profile, result.order, result, null));
    }
  }

  // Which trials on any of this patient's final short lists the record flags,
  // so would-flag can be re-derived from the rows. The curves are checked by
  // rerunning, not from the rows.
  const seen = new Set(rows.flatMap((r) => r.shortlist));
  const record = rows[0];
  if (record !== undefined) record.recordFlagged = [...seen].filter((id) => flagged.has(id)).sort();
  return rows;
}
